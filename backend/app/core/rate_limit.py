from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse
from app.i18n.loader import t
from app.core.config import settings


def get_real_client_ip(request: Request) -> str:
    """
    Récupère l'IP réelle de l'utilisateur, même derrière le reverse proxy 
    de Railway, Vercel, Cloudflare ou un Nginx.
    """
    # 1. Si tu utilises Cloudflare (fortement recommandé pour Kipar)
    if cf_ip := request.headers.get("cf-connecting-ip"):
        return cf_ip
        
    # 2. Proxy standard (Railway, AWS ALB, etc.)
    if x_forwarded_for := request.headers.get("x-forwarded-for"):
        # Le header peut contenir une chaîne "client, proxy1, proxy2". On isole le client (le premier).
        return x_forwarded_for.split(",")[0].strip()
        
    # 3. Fallback en dev local (direct IP)
    return get_remote_address(request)


# Initialisation du Limiter avec la fonction d'IP intelligente
limiter = Limiter(
    key_func=get_real_client_ip,
    enabled=settings.ENVIRONMENT != "test",
)


async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Gestionnaire global du dépassement de limite de requêtes.
    """
    lang = request.headers.get("Accept-Language", "fr")[:2]
    if lang not in ["fr", "en"]:
        lang = "fr"
        
    # On ne hardcode plus les secondes pour éviter de mentir à l'utilisateur
    return JSONResponse(
        status_code=429,
        content={"detail": t("errors.rate_limit_exceeded", lang)}
    )
