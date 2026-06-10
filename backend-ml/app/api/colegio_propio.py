"""
colegio_propio.py — Endpoints para el módulo "Mi Colegio".
Sirve predicciones de riesgo basadas en los datos internos del colegio.
"""
import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import joblib
import shutil
import subprocess
import sys


def _validate_ie(codigo_ie: str) -> str:
    """Acepta solo códigos IE alfanuméricos (3-20 chars). Previene path traversal."""
    if not re.fullmatch(r"[A-Za-z0-9]{3,20}", codigo_ie):
        raise HTTPException(status_code=400, detail=f"Código IE inválido: '{codigo_ie}'")
    return codigo_ie

router = APIRouter(prefix="/colegio", tags=["Mi Colegio"])

# Resolución robusta de rutas: funciona tanto en Docker (WORKDIR=/app, código
# en /app/app → parents[2] = /app) como en desarrollo local (código en
# repo/backend-ml/app → la carpeta `modelo/` está un nivel más arriba, en
# parents[3] = raíz del repo). Probamos ambos candidatos y elegimos el que
# exista, para no depender del entorno de ejecución.
def _resolve_repo_path(*parts: str) -> Path:
    here = Path(__file__).resolve()
    for base in (here.parents[2], here.parents[3]):  # /app (Docker)  |  raíz repo (dev)
        candidate = base.joinpath(*parts)
        if candidate.exists():
            return candidate
    return here.parents[2].joinpath(*parts)  # fallback al layout de Docker

MODEL_DIR       = _resolve_repo_path("modelo", "model")
DATA_DIR        = _resolve_repo_path("modelo", "data")
COLEGIO_SCRIPTS = _resolve_repo_path("modelo", "colegio")


def _load_artefacto(codigo_ie: str) -> dict:
    # Intentar con el código tal cual, luego con cero inicial (0249) y sin él (249)
    candidates = [
        MODEL_DIR / f"colegio_{codigo_ie}.pkl",
        MODEL_DIR / f"colegio_{codigo_ie.zfill(4)}.pkl",   # 249 → 0249
        MODEL_DIR / f"colegio_{codigo_ie.lstrip('0')}.pkl", # 0249 → 249
    ]
    for path in candidates:
        if path.exists():
            return joblib.load(path)
    raise HTTPException(
        status_code=404,
        detail=f"No hay modelo entrenado para la IE {codigo_ie}. "
               "El administrador debe subir los Excel del colegio primero."
    )


# ─── GET /v1/colegio/{codigo_ie}/predicciones ─────────────────────────────────

@router.get("/{codigo_ie}/predicciones")
def get_predicciones(codigo_ie: str = Depends(_validate_ie), salon: str | None = None, nivel: str | None = None):
    """
    Devuelve el ranking de riesgo de los estudiantes del colegio.
    Filtros opcionales: salon (ej: 5A, P6B), nivel (ALTO, MEDIO, BAJO).
    """
    art = _load_artefacto(codigo_ie)
    preds = art["predicciones"]

    if salon:
        preds = [p for p in preds if str(p.get("salon", "")).upper() == salon.upper()]
    if nivel:
        preds = [p for p in preds if str(p.get("nivel_riesgo", "")).upper() == nivel.upper()]

    # Ordenar por probabilidad descendente
    preds = sorted(preds, key=lambda p: p.get("prob_riesgo") or 0, reverse=True)

    return {
        "codigo_ie":      codigo_ie,
        "nombre_colegio": art.get("nombre_colegio", codigo_ie),
        "total":          len(preds),
        "salones":        art["metricas"].get("salones", []),
        "metricas":       art["metricas"],
        "trained_at":     art.get("trained_at"),
        "predicciones":   preds,
    }


# ─── GET /v1/colegio/{codigo_ie}/resumen ──────────────────────────────────────

@router.get("/{codigo_ie}/resumen")
def get_resumen(codigo_ie: str = Depends(_validate_ie)):
    """KPIs rápidos del colegio: totales por nivel."""
    art = _load_artefacto(codigo_ie)
    m   = art["metricas"]
    preds = art["predicciones"]

    por_nivel = {"ALTO": 0, "MEDIO": 0, "BAJO": 0}
    por_salon: dict[str, dict] = {}
    for p in preds:
        nivel  = p.get("nivel_riesgo", "BAJO")
        por_nivel[nivel] = por_nivel.get(nivel, 0) + 1
        salon  = p.get("salon", "?")
        if salon not in por_salon:
            por_salon[salon] = {"ALTO": 0, "MEDIO": 0, "BAJO": 0, "total": 0}
        por_salon[salon][nivel] = por_salon[salon].get(nivel, 0) + 1
        por_salon[salon]["total"] += 1

    # n_riesgo / pct_riesgo se derivan de las predicciones reales mostradas
    # (niveles ALTO + MEDIO) para que el KPI coincida con la distribución por
    # nivel que se grafica al lado. Antes se tomaban de 'metricas', que reflejaba
    # la prevalencia del target de entrenamiento y no cuadraba con los niveles.
    n_alumnos = len(preds)
    n_riesgo  = por_nivel["ALTO"] + por_nivel["MEDIO"]
    pct_riesgo = round(100 * n_riesgo / n_alumnos, 1) if n_alumnos else 0.0

    return {
        "codigo_ie":      codigo_ie,
        "nombre_colegio": art.get("nombre_colegio", codigo_ie),
        "n_alumnos":      n_alumnos,
        "n_riesgo":       n_riesgo,
        "pct_riesgo":     pct_riesgo,
        "por_nivel":      por_nivel,
        "por_salon":      por_salon,
        "trained_at":     art.get("trained_at"),
        # Métricas completas para el panel de estadísticas del admin
        "metricas": {
            "auc_cv":            m.get("auc_cv"),
            "auc_train":         m.get("auc_train"),
            "f1_train":          m.get("f1_train"),
            "precision_train":   m.get("precision_train"),
            "recall_train":      m.get("recall_train"),
            "accuracy_train":    m.get("accuracy_train"),
            "n_splits_cv":       m.get("n_splits_cv"),
            "modo_prediccion":   m.get("modo_prediccion"),
            "salones":           m.get("salones", []),
            "nombre_colegio":    m.get("nombre_colegio", art.get("nombre_colegio", codigo_ie)),
            "nota_metodologica": m.get("nota_metodologica"),
            "n_alumnos_modelo":  m.get("n_alumnos_modelo", m.get("n_alumnos", 0)),
        },
    }


# ─── POST /v1/colegio/{codigo_ie}/procesar ────────────────────────────────────

@router.post("/{codigo_ie}/procesar")
async def procesar_excels(
    codigo_ie: str,
    notas_files: list[UploadFile] = File(...),
    conducta_files: list[UploadFile] = File(default=[]),
):
    """
    Recibe los Excel del colegio, los procesa y entrena el modelo de riesgo.
    Acepta múltiples archivos de notas y conducta.
    """
    upload_dir = DATA_DIR / f"colegio_{codigo_ie}_upload"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Guardar archivos subidos
    saved = []
    for f in notas_files + conducta_files:
        safe_name = Path(f.filename or "archivo.xlsx").name
        dest = upload_dir / safe_name
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)
        saved.append(str(dest))

    if not saved:
        raise HTTPException(status_code=400, detail="No se recibieron archivos.")

    # Ejecutar script de entrenamiento
    try:
        result = subprocess.run(
            [sys.executable, str(COLEGIO_SCRIPTS / "train_colegio_model.py"),
             "--ie", codigo_ie, "--carpeta", str(upload_dir)],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=120, cwd=str(COLEGIO_SCRIPTS),
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Error al procesar: {result.stderr or result.stdout}"
            )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Procesamiento tardó demasiado.")

    # Devolver resumen
    art = _load_artefacto(codigo_ie)
    return {
        "status":    "ok",
        "codigo_ie": codigo_ie,
        "archivos_procesados": len(saved),
        "metricas":  art["metricas"],
    }
