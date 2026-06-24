from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse
from app.i18n.loader import t
from app.core.config import settings


def get_real_client_ip(request: Request) -> str:
    """
    IP réelle du client, sécurisée pour l'infra Kipar (Nginx sur Hetzner).
    On fait UNIQUEMENT confiance au header posé par notre propre Nginx :
    l'IP TCP réelle, non forgeable car Nginx l'écrase a chaque requete.
    Les en-têtes proxy envoyés par le client sont forgeables et ont été
    retirés : ils permettaient de contourner le rate-limit (codes PIN).
    """
    # IP TCP réelle posée par notre Nginx (non spoofable).
    if real_ip := request.headers.get("x-real-ip"):
        return real_ip.strip()

    # Fallback : connexion directe (dev local sans proxy).
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
