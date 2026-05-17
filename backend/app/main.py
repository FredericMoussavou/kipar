from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_handler
from app.core.logging_config import setup_logging
from app.core.sentry import setup_sentry
from app.api.v1.router import api_router
from app.i18n.loader import t


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    setup_sentry()
    if settings.is_production and settings.SECRET_KEY == "dev-secret-change-in-production":
        raise RuntimeError("[SECURITY] SECRET_KEY non configurée en production !")
    if settings.is_production and not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("[SECURITY] STRIPE_SECRET_KEY manquante en production !")
    yield


app = FastAPI(
    title="KIPAR. API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Intercepte les erreurs de validation Pydantic.
    Traduit les erreurs IATA_INVALID dans la langue de la requête.
    """
    lang = request.headers.get("Accept-Language", "fr")[:2]
    errors = []

    for error in exc.errors():
        msg = error.get("msg", "")

        # Traduit l'erreur IATA
        if "IATA_INVALID:" in msg:
            code = msg.split("IATA_INVALID:")[1].strip()
            msg = t("errors.airport_iata_invalid", lang, code=code)

        errors.append({
            "field": " → ".join(str(x) for x in error.get("loc", [])),
            "message": msg,
        })

    return JSONResponse(
        status_code=422,
        content={"detail": errors}
    )


# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if not settings.is_production else settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted hosts en production
if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["kipar.app", "*.kipar.app"]
    )

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.ENVIRONMENT}
