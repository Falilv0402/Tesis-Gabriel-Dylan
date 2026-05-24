import io
from fastapi import APIRouter, File, HTTPException, UploadFile
import pandas as pd
from app.schemas import CsvError, CsvValidationResponse

router = APIRouter(prefix="/datos", tags=["Datos"])

REQUIRED_COLS = {"sexo", "ise", "Distrito", "M500_L", "M500_CN", "ID_IE"}

@router.post("/validar-csv", response_model=CsvValidationResponse)
async def validar_csv(file: UploadFile = File(...)) -> CsvValidationResponse:
    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el CSV: {exc}") from exc

    cols = set(df.columns.str.strip())
    missing = sorted(REQUIRED_COLS - cols)
    detected = list(df.columns)
    errors: list[CsvError] = [
        CsvError(fila=0, campo=c, error="Columna requerida ausente") for c in missing
    ]
    for idx, row in df.iterrows():
        row_num = int(str(idx)) + 2
        if "sexo" in df.columns:
            val = str(row.get("sexo", "")).strip()
            if val not in ("Hombre", "Mujer"):
                errors.append(CsvError(fila=row_num, campo="sexo", error=f"Valor invalido '{val}'"))
        if "ise" in df.columns:
            try:
                v = float(row["ise"])
                if not (0.0 <= v <= 5.0):
                    errors.append(CsvError(fila=row_num, campo="ise", error=f"Fuera de rango [0-5]: {v}"))
            except (ValueError, TypeError):
                errors.append(CsvError(fila=row_num, campo="ise", error="No es un numero valido"))
        for score_col in ("M500_L", "M500_CN"):
            if score_col in df.columns:
                try:
                    v = float(row[score_col])
                    if not (200.0 <= v <= 800.0):
                        errors.append(CsvError(fila=row_num, campo=score_col, error=f"Fuera de rango [200-800]: {v}"))
                except (ValueError, TypeError):
                    errors.append(CsvError(fila=row_num, campo=score_col, error="No es un numero valido"))
        if len(errors) >= 100:
            break
    error_rows = {e.fila for e in errors if e.fila > 0}
    valid_rows = max(0, len(df) - len(error_rows))
    return CsvValidationResponse(
        total_filas=len(df), filas_validas=valid_rows, errores=errors[:50],
        columnas_detectadas=detected, columnas_faltantes=missing,
    )
