from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_handler
from app.core.logging_config import setup_logging
from app.core.sentry import setup_sentry
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    setup_sentry()
    yield


app = FastAPI(
    title="KIPAR. API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
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
