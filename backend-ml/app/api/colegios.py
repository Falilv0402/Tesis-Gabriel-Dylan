from fastapi import APIRouter, HTTPException
from app.services.model_service import model_service

router = APIRouter(prefix="/colegios", tags=["Colegios"])

@router.get("")
def get_colegios():
    try: return model_service.get_colegios()
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.get("/distritos")
def get_distritos():
    try: return {"distritos": model_service.get_distritos()}
    except Exception as exc: raise HTTPException(status_code=500, detail=str(exc)) from exc
