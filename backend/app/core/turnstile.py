"""
Verification Cloudflare Turnstile (anti-bot).

verify_turnstile(token, ip) -> bool
  POST vers l'endpoint siteverify de Cloudflare avec le secret serveur.
  - Si TURNSTILE_SECRET est vide (dev local sans config) : bypass -> retourne True.
  - Si le token est absent/invalide : retourne False.
"""
import httpx
from app.core.config import settings

SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str | None, remote_ip: str | None = None) -> bool:
    secret = getattr(settings, "TURNSTILE_SECRET", "") or ""
    # Bypass en dev / si non configure cote serveur.
    if not secret:
        return True
    if not token:
        return False
    data = {"secret": secret, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(SITEVERIFY_URL, data=data)
        result = resp.json()
        return bool(result.get("success"))
    except Exception:
        # En cas d'erreur reseau cote Cloudflare, on refuse par securite.
        return False