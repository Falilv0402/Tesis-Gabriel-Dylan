from fastapi import APIRouter, Depends, HTTPException, Header
from app.core.config import get_settings
from app.schemas import FeatureImportance, MetricResponse, RetrainResponse
from app.services.model_service import model_service

router = APIRouter(prefix="/modelo", tags=["Modelo"])


def verify_api_key(x_api_key: str = Header(default="")) -> None:
    """Verifica la clave de API para endpoints mutantes.
    Si SATRA_API_KEY no está configurada (desarrollo local), se omite la verificación.
    """
    expected = get_settings().satra_api_key
    if expected and x_api_key != expected:
        raise HTTPException(status_code=403, detail="API key inválida o ausente.")

@router.get("/metricas", response_model=MetricResponse)
def metricas():
    try: return model_service.get_metrics()
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.get("/importancia", response_model=list[FeatureImportance])
def importancia():
    try: return model_service.get_importance()
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.get("/evaluacion")
def evaluacion():
    try: return model_service.get_evaluation()
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.get("/diagnostico")
def diagnostico():
    try: return model_service.get_diagnostico()
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.post("/reentrenamiento", response_model=RetrainResponse,
             dependencies=[Depends(verify_api_key)])
def reentrenar():
    try: output = model_service.retrain()
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc
    return RetrainResponse(status="ok", detail=output[-1500:])
