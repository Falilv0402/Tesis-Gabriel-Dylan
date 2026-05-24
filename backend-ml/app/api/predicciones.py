from fastapi import APIRouter, HTTPException, Query
from app.schemas import PredictionRequest, PredictionResponse, ShapResponse
from app.services.model_service import model_service

router = APIRouter(prefix="/predicciones", tags=["Predicciones"])

@router.post("", response_model=PredictionResponse)
def predecir(payload: PredictionRequest) -> PredictionResponse:
    try:
        resultados = model_service.predict(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PredictionResponse(total=len(resultados), resultados=resultados)

@router.post("/dataset", response_model=PredictionResponse)
def predecir_dataset(
    limit: int = Query(default=1000, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    nivel: str | None = Query(default=None),
    distrito: str | None = Query(default=None),
    sexo: str | None = Query(default=None),
    id_ie: str | None = Query(default=None),
) -> PredictionResponse:
    try:
        total, resultados = model_service.query_dataset(
            limit=limit, offset=offset, nivel=nivel, distrito=distrito, sexo=sexo, id_ie=id_ie,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PredictionResponse(total=total, resultados=resultados)

@router.get("/resumen")
def dataset_resumen(
    nivel: str | None = Query(default=None),
    distrito: str | None = Query(default=None),
    sexo: str | None = Query(default=None),
    id_ie: str | None = Query(default=None),
) -> dict:
    try:
        return model_service.get_dataset_summary(nivel=nivel, distrito=distrito, sexo=sexo, id_ie=id_ie)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

@router.get("/{id_estudiante}/shap", response_model=ShapResponse)
def shap_estudiante(id_estudiante: str) -> dict:
    try:
        return model_service.get_student_shap(id_estudiante)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
