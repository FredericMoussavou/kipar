import logging
import httpx
import jwt as pyjwt
from app.core.config import settings

logger = logging.getLogger(__name__)


async def verify_google_token(id_token: str) -> dict | None:
    """
    Vérifie un token Google ID auprès de l'API Google.
    Retourne le payload (email, name, picture, sub) ou None si invalide.
    """
    if not settings.GOOGLE_CLIENT_ID or settings.ENVIRONMENT == "test":
        # Simulation pour les tests
        logger.info("[GOOGLE OAUTH SIMULATED]")
        return {
            "sub": "google_sim_123",
            "email": "sim_google@kipar.com",
            "given_name": "Google",
            "family_name": "User",
            "picture": None,
            "email_verified": True,
        }

    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests

        idinfo = google_id_token.verify_oauth2_token(
            id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        if idinfo.get("aud") != settings.GOOGLE_CLIENT_ID:
            logger.warning("Google token: audience mismatch")
            return None

        if not idinfo.get("email_verified"):
            logger.warning("Google token: email not verified")
            return None

        return {
            "sub": idinfo["sub"],
            "email": idinfo.get("email"),
            "given_name": idinfo.get("given_name", ""),
            "family_name": idinfo.get("family_name", ""),
            "picture": idinfo.get("picture"),
            "email_verified": True,
        }
    except Exception as e:
        logger.error(f"Google token verification failed: {e}")
        return None


async def verify_apple_token(identity_token: str) -> dict | None:
    """
    Vérifie un token Apple Sign In.
    Apple utilise des clés publiques JWK — on les récupère depuis leur endpoint.
    Retourne le payload (email, sub) ou None si invalide.
    """
    if not settings.APPLE_CLIENT_ID:
        logger.info("[APPLE OAUTH SIMULATED]")
        return {
            "sub": "apple_sim_456",
            "email": "sim_apple@kipar.com",
            "given_name": "Apple",
            "family_name": "User",
            "email_verified": True,
        }

    try:
        # Récupère les clés publiques Apple
        async with httpx.AsyncClient() as client:
            res = await client.get("https://appleid.apple.com/auth/keys")
            apple_keys = res.json()

        # Décode le header pour trouver la bonne clé
        header = pyjwt.get_unverified_header(identity_token)
        kid = header.get("kid")

        # Trouve la clé correspondante
        matching_key = None
        for key in apple_keys.get("keys", []):
            if key["kid"] == kid:
                matching_key = key
                break

        if not matching_key:
            logger.warning("Apple token: no matching key found")
            return None

        # Construit la clé publique RSA
        from jwt.algorithms import RSAAlgorithm
        public_key = RSAAlgorithm.from_jwk(matching_key)

        # Vérifie et décode le token
        payload = pyjwt.decode(
            identity_token,
            public_key,
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer="https://appleid.apple.com",
        )

        email = payload.get("email")
        if not email:
            logger.warning("Apple token: no email in payload")
            return None

        return {
            "sub": payload["sub"],
            "email": email,
            "given_name": "",
            "family_name": "",
            "email_verified": payload.get("email_verified", False),
        }

    except Exception as e:
        logger.error(f"Apple token verification failed: {e}")
        return None
