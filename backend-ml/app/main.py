import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, RedirectResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.router import router
from app.core.config import get_settings
from app.core.limiter import limiter
from app.services.model_service import model_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cargar el modelo en background para no bloquear el startup.
    # Los endpoints lo cargan lazy si aún no terminó.
    asyncio.create_task(asyncio.to_thread(model_service.load))
    yield


settings = get_settings()

app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
)

# Rate limiting -- límite global por IP (120/min) contra fuerza bruta y
# ráfagas de requests; algunos endpoints puntuales (entrenar/subir Excel)
# tienen un límite más estricto propio, ver sus routers.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS — permitir desde localhost (desarrollo), Vercel (previews) y el dominio propio
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://(www\.)?satraapp\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/v1")


# api.satraapp.com es el backend, no la app -- no debe aparecer indexado en
# Google (Search Console lo encontró y lo listó como página rastreada). El
# robots.txt evita que se vuelva a rastrear, y el header en cada respuesta
# hace que, si ya quedó indexado, se retire en el próximo paso de Google.
@app.middleware("http")
async def no_index_backend(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    return response


@app.get("/robots.txt", include_in_schema=False)
def robots() -> PlainTextResponse:
    return PlainTextResponse("User-agent: *\nDisallow: /\n")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Redirige al Swagger UI."""
    return RedirectResponse(url="/docs")


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> RedirectResponse:
    return RedirectResponse(url="/docs")

