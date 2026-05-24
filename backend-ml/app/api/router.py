"""Registro central de sub-routers del API v1."""
from fastapi import APIRouter
from app.services.model_service import model_service
from app.api.predicciones import router as predicciones_router
from app.api.modelo       import router as modelo_router
from app.api.datos        import router as datos_router
from app.api.colegios     import router as colegios_router

router = APIRouter()

@router.get("/health", tags=["Health"])
def health() -> dict:
    return {"status": "ok", **model_service.health()}

router.include_router(predicciones_router)
router.include_router(modelo_router)
router.include_router(datos_router)
router.include_router(colegios_router)
