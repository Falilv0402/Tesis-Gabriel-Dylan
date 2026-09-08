"""
colegio_propio.py — Endpoints para el módulo "Mi Colegio".
Sirve predicciones de riesgo basadas en los datos internos del colegio.
"""
import os
import re
from pathlib import Path
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File
import httpx
import joblib
import subprocess
import sys


def _validate_ie(codigo_ie: str) -> str:
    """Acepta solo códigos IE alfanuméricos (3-20 chars). Previene path traversal."""
    if not re.fullmatch(r"[A-Za-z0-9]{3,20}", codigo_ie):
        raise HTTPException(status_code=400, detail=f"Código IE inválido: '{codigo_ie}'")
    return codigo_ie

router = APIRouter(prefix="/colegio", tags=["Mi Colegio"])


# ─── Autenticación para endpoints que MUTAN datos (entrenar modelo) ───────────
# El resto del backend no valida sesión (los endpoints de lectura no exponen
# datos sensibles fuera del propio front autenticado por Supabase), pero
# "/procesar" ejecuta un entrenamiento con los datos que se le suban — sin
# esta verificación, cualquiera que alcance la URL pública podría reentrenar
# el modelo de cualquier colegio con datos arbitrarios. Reutiliza la sesión de
# Supabase ya emitida al usuario (no requiere ningún secreto nuevo: la anon key
# es pública por diseño, y RLS ya permite que cada usuario lea su propio perfil).
SUPABASE_URL      = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")


async def require_admin_de_colegio(
    codigo_ie: str = Depends(_validate_ie),
    authorization: str = Header(default=""),
) -> dict:
    """Verifica que quien llama tenga un rol autorizado a cargar datos del
    colegio (admin/director/coordinador de ESE colegio, o superadmin sin
    restricción de IE) y esté activo. Devuelve {codigo_ie, token} — el token
    se reutiliza para consultar a los destinatarios de la alerta proactiva
    (HU019) respetando RLS, sin necesitar ningún secreto adicional en el
    backend."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Falta el token de autenticación.")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Backend sin configurar (SUPABASE_URL/ANON_KEY).")
    token = authorization.split(" ", 1)[1].strip()

    async with httpx.AsyncClient(timeout=10) as client:
        user_res = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        )
        if user_res.status_code != 200:
            raise HTTPException(status_code=401, detail="Sesión inválida o expirada.")
        user_id = user_res.json().get("id")

        prof_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"id": f"eq.{user_id}", "select": "rol,codigo_ie,activo"},
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        )
    perfiles = prof_res.json() if prof_res.status_code == 200 else []
    if not perfiles:
        raise HTTPException(status_code=403, detail="Perfil no encontrado.")
    perfil = perfiles[0]
    if not perfil.get("activo", True):
        raise HTTPException(status_code=403, detail="Cuenta inactiva.")
    if perfil.get("rol") not in ("admin", "superadmin", "director", "coordinador"):
        raise HTTPException(status_code=403, detail="Tu rol no puede cargar datos del colegio.")
    if perfil.get("rol") != "superadmin":
        perfil_ie = str(perfil.get("codigo_ie") or "")
        if not perfil_ie or perfil_ie.lstrip("0") != codigo_ie.lstrip("0"):
            raise HTTPException(status_code=403, detail="Solo puedes cargar datos de tu propio colegio.")
    return {"codigo_ie": codigo_ie, "token": token}

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
    # Intentar con el código tal cual, sin ceros iniciales, y con cero(s)
    # iniciales para las dos convenciones vistas: códigos cortos históricos
    # (249 → 0249, 4 dígitos) y códigos modulares reales de MINEDU (831305 →
    # 0831305, 7 dígitos) — el frontend normaliza con parseInt() en varios
    # lugares, lo que quita el cero inicial antes de llamar a la API.
    sin_ceros = codigo_ie.lstrip("0") or "0"
    candidates = [
        MODEL_DIR / f"colegio_{codigo_ie}.pkl",
        MODEL_DIR / f"colegio_{sin_ceros}.pkl",
        MODEL_DIR / f"colegio_{sin_ceros.zfill(4)}.pkl",  # 249 → 0249
        MODEL_DIR / f"colegio_{sin_ceros.zfill(7)}.pkl",  # 831305 → 0831305
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
            "confusion_matrix":  m.get("confusion_matrix"),
            "roc_fpr":           m.get("roc_fpr"),
            "roc_tpr":           m.get("roc_tpr"),
            "modo_prediccion":   m.get("modo_prediccion"),
            "salones":           m.get("salones", []),
            "nombre_colegio":    m.get("nombre_colegio", art.get("nombre_colegio", codigo_ie)),
            "nota_metodologica": m.get("nota_metodologica"),
            "n_alumnos_modelo":  m.get("n_alumnos_modelo", m.get("n_alumnos", 0)),
            "advertencias_carga": m.get("advertencias_carga", []),
        },
    }


# ─── POST /v1/colegio/{codigo_ie}/procesar ────────────────────────────────────

def _nivel_por_alumno(art: dict) -> dict[str, str]:
    """{'<codigo_ie>-<salon>-<n_alumno>': nivel_riesgo} para comparar entre versiones."""
    out: dict[str, str] = {}
    for p in art.get("predicciones", []):
        clave = f"{p.get('codigo_ie')}-{p.get('salon')}-{p.get('n_alumno')}"
        out[clave] = p.get("nivel_riesgo", "")
    return out


async def _alertar_nuevos_alto(codigo_ie: str, token: str, antes: dict[str, str]) -> int:
    """HU019: tras reentrenar, compara contra el nivel de riesgo previo y
    avisa por correo (vía la misma Edge Function que usa el front) a
    admin/director/coordinador del colegio si aparecen alumnos NUEVOS en
    ALTO — no requiere que nadie entre a revisar manualmente el dashboard."""
    try:
        art_nuevo = _load_artefacto(codigo_ie)
    except HTTPException:
        return 0
    despues = _nivel_por_alumno(art_nuevo)
    nuevos_alto = [
        clave for clave, nivel in despues.items()
        if nivel == "ALTO" and antes.get(clave) != "ALTO"
    ]
    if not nuevos_alto or not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return len(nuevos_alto)

    async with httpx.AsyncClient(timeout=10) as client:
        # RLS ya limita esto a los perfiles del mismo colegio (o todos, si
        # quien sube es superadmin) — reutiliza el token de quien disparó
        # el reentrenamiento, sin necesitar ningún secreto extra.
        dest_res = await client.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={
                "codigo_ie": f"eq.{codigo_ie}",
                "rol": "in.(admin,director,coordinador)",
                "activo": "eq.true",
                "select": "email,nombre",
            },
            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
        )
        destinatarios = [d["email"] for d in dest_res.json()] if dest_res.status_code == 200 else []
        if not destinatarios:
            return len(nuevos_alto)

        nombre_colegio = art_nuevo.get("nombre_colegio", codigo_ie)
        html = (
            f"<div style='font-family:Arial,sans-serif;max-width:560px'>"
            f"<h2 style='color:#dc2626'>⚠️ Nuevos alumnos en riesgo ALTO</h2>"
            f"<p>El modelo de <strong>{nombre_colegio}</strong> se acaba de actualizar y detectó "
            f"<strong>{len(nuevos_alto)}</strong> alumno(s) que ahora está(n) en nivel de riesgo "
            f"<strong style='color:#dc2626'>ALTO</strong> y antes no lo estaban.</p>"
            f"<p>Ingresa a SATRA para revisar el detalle y registrar intervenciones.</p>"
            f"<p style='color:#64748b;font-size:12px'>SATRA · Alerta automática de reentrenamiento</p>"
            f"</div>"
        )
        try:
            await client.post(
                f"{SUPABASE_URL}/functions/v1/send-alert",
                json={
                    "to": destinatarios,
                    "subject": f"[SATRA] {len(nuevos_alto)} nuevo(s) alumno(s) en riesgo ALTO — {nombre_colegio}",
                    "html": html,
                },
                headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY},
            )
        except Exception:
            pass  # la alerta es best-effort; no debe romper la respuesta del entrenamiento
    return len(nuevos_alto)


async def _registrar_version_modelo(codigo_ie: str, token: str, art: dict) -> None:
    """HU034: cada reentrenamiento queda como una fila en modelos_versiones
    (antes la tabla existía en el schema pero nunca se escribía en ella —
    no había forma de ver el historial de cambios del modelo). También sirve
    de base para el seguimiento histórico de riesgo en el tiempo (HU024/026):
    cada fila es una foto de la distribución de riesgo en ese momento.
    Best-effort: si la migración 0012 (columnas nuevas) todavía no se aplicó,
    o la tabla no existe, esto falla en silencio y no rompe la respuesta.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return
    m = art.get("metricas", {})
    por_nivel: dict[str, int] = {}
    for p in art.get("predicciones", []):
        nivel = p.get("nivel_riesgo", "BAJO")
        por_nivel[nivel] = por_nivel.get(nivel, 0) + 1
    payload = {
        "version":         art.get("trained_at") or codigo_ie,
        "codigo_ie":       codigo_ie,
        "nombre_colegio":  art.get("nombre_colegio"),
        "accuracy":        m.get("accuracy_train"),
        "precision_score": m.get("precision_train"),
        "recall":          m.get("recall_train"),
        "f1":              m.get("f1_train"),
        "auc_roc":         m.get("auc_cv") or m.get("auc_train"),
        "n_alumnos":       m.get("n_alumnos"),
        "n_alto":          por_nivel.get("ALTO", 0),
        "n_medio":         por_nivel.get("MEDIO", 0),
        "n_bajo":          por_nivel.get("BAJO", 0),
        "modo_prediccion": m.get("modo_prediccion"),
        "activo":          True,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/modelos_versiones",
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
            )
    except Exception:
        pass


@router.post("/{codigo_ie}/procesar")
async def procesar_excels(
    auth_ctx: dict = Depends(require_admin_de_colegio),
    notas_files: list[UploadFile] = File(...),
    conducta_files: list[UploadFile] = File(default=[]),
):
    """
    Recibe los Excel del colegio, los procesa y entrena el modelo de riesgo.
    Acepta múltiples archivos de notas y conducta.
    """
    codigo_ie = auth_ctx["codigo_ie"]
    upload_dir = DATA_DIR / f"colegio_{codigo_ie}_upload"
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Estado ANTES de reentrenar (para detectar nuevos ALTO — HU019). Si no
    # hay modelo previo (primera carga de este colegio), queda vacío y nadie
    # se marca como "nuevo" — no tiene sentido alertar en la primera carga.
    nivel_antes: dict[str, str] = {}
    try:
        nivel_antes = _nivel_por_alumno(_load_artefacto(codigo_ie))
    except HTTPException:
        pass

    # Guardar archivos subidos — validando extensión (previene subir tipos
    # arbitrarios) y tamaño máximo por archivo (previene un upload gigante
    # usado como DoS; un Excel de notas real nunca se acerca a este límite).
    MAX_BYTES_POR_ARCHIVO = 20 * 1024 * 1024  # 20 MB
    CHUNK = 1024 * 1024
    saved = []
    for f in notas_files + conducta_files:
        safe_name = Path(f.filename or "archivo.xlsx").name
        if Path(safe_name).suffix.lower() not in (".xlsx", ".xls"):
            raise HTTPException(status_code=400, detail=f"Tipo de archivo no permitido: '{safe_name}' (solo .xlsx/.xls).")
        dest = upload_dir / safe_name
        total = 0
        with open(dest, "wb") as out:
            while chunk := await f.read(CHUNK):
                total += len(chunk)
                if total > MAX_BYTES_POR_ARCHIVO:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"'{safe_name}' supera el tamaño máximo permitido (20 MB).",
                    )
                out.write(chunk)
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

    n_nuevos_alto = await _alertar_nuevos_alto(codigo_ie, auth_ctx["token"], nivel_antes)

    # Devolver resumen
    art = _load_artefacto(codigo_ie)
    await _registrar_version_modelo(codigo_ie, auth_ctx["token"], art)
    return {
        "status":    "ok",
        "codigo_ie": codigo_ie,
        "archivos_procesados": len(saved),
        "metricas":  art["metricas"],
        "nuevos_alto": n_nuevos_alto,  # HU019: cuántos alumnos pasaron a ALTO recién ahora
    }
