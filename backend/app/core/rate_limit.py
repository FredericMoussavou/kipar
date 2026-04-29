from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse
from app.i18n.loader import t
from app.core.config import settings


def get_limit(limit: str):
    """Retourne la limite ou '9999/minute' en mode test."""
    if settings.ENVIRONMENT == "test":
        return "9999/minute"
    return limit


limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.ENVIRONMENT != "test",
)


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    seconds = 60
    lang = request.headers.get("Accept-Language", "fr")[:2]
    if lang not in ["fr", "en"]:
        lang = "fr"
    return JSONResponse(
        status_code=429,
        content={"detail": t("errors.rate_limit_exceeded", lang, seconds=seconds)}
    )
