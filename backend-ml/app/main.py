from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api.router import router
from app.core.config import get_settings
from app.services.model_service import model_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    model_service.load()
    yield


settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/v1")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Redirige al Swagger UI."""
    return RedirectResponse(url="/docs")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> RedirectResponse:
    return RedirectResponse(url="/docs")

