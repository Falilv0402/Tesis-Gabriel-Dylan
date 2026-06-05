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

# parents[2] = /app en Docker (WORKDIR) = raíz del proyecto en desarrollo
# Esto es consistente con model_loader.py que también usa parents[2]
MODEL_DIR = Path(__file__).resolve().parents[2] / "modelo" / "model"
DATA_DIR  = Path(__file__).resolve().parents[2] / "modelo" / "data"
COLEGIO_SCRIPTS = Path(__file__).resolve().parents[2] / "modelo" / "colegio"


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

    return {
        "codigo_ie":      codigo_ie,
        "nombre_colegio": art.get("nombre_colegio", codigo_ie),
        "n_alumnos":      m.get("n_alumnos", len(preds)),
        "n_riesgo":       m.get("n_riesgo", 0),
        "pct_riesgo":     m.get("pct_riesgo", 0.0),
        "por_nivel":      por_nivel,
        "por_salon":      por_salon,
        "trained_at":     art.get("trained_at"),
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

    # Guardar archivos subidos — Fix #12: sanitizar nombre para prevenir path traversal
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
