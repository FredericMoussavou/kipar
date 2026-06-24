import hmac
import hashlib
import json
import logging
import base64
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


def _auth_header() -> str:
    """Basic auth : base64(api_key:api_secret)"""
    credentials = f"{settings.IDENFY_API_KEY}:{settings.IDENFY_API_SECRET}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return f"Basic {encoded}"


async def create_verification_session(
    client_id: str,
    first_name: str,
    last_name: str,
    email: str,
) -> dict | None:
    """
    Crée une session de vérification iDenfy.
    """
    if not settings.IDENFY_API_KEY or not settings.IDENFY_API_SECRET:
        logger.info(f"[KYC SIMULATED] Session créée pour {email}")
        return {
            "authToken": f"simulated_token_{client_id[:8]}",
            "scanRef": f"simulated_scan_{client_id[:8]}",
            "url": f"https://ivs.idenfy.com/api/v2/redirect?authToken=simulated_token_{client_id[:8]}",
        }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            f"{settings.IDENFY_BASE_URL}/api/v2/token",
            headers={
                "Authorization": _auth_header(),
                "Content-Type": "application/json",
            },
            json={
                "clientId": client_id,
                "firstName": first_name,
                "lastName": last_name,
                "email": email,
                "callbackUrl": "https://api.kipar.app/api/v1/kyc/webhook",
                "generateDigitString": False,
            }
        )
        if res.status_code == 201:
            data = res.json()
            return {
                "authToken": data.get("authToken"),
                "scanRef": data.get("scanRef"),
                "url": f"https://ivs.idenfy.com/api/v2/redirect?authToken={data.get('authToken')}",
            }
        logger.error(f"iDenfy session creation failed: {res.status_code} {res.text}")
        return None


async def process_webhook(raw_body: bytes, signature: str) -> dict | None:
    """
    Vérifie la signature HMAC SHA-256 et traite le webhook iDenfy.
    """
    # Si les clés ne sont pas configurées (Dev/Simu), on ignore la vérification de signature
    if not settings.IDENFY_API_KEY or not settings.IDENFY_API_SECRET:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            return None
    else:
        if not signature:
            logger.warning("Missing Idenfy-Signature header while keys are configured.")
            return None

        # Calcul de la signature attendue
        computed_sig = hmac.new(
            settings.IDENFY_API_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        # Comparaison sécurisée contre les attaques temporelles (Timing Attacks)
        if not hmac.compare_digest(computed_sig, signature):
            logger.error("iDenfy webhook signature verification failed.")
            return None

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception:
            return None

    client_id = payload.get("clientId")
    status = payload.get("status")

    if not client_id or not status:
        return None

    kyc_status = {
        "APPROVED": "approved",
        "DENIED": "rejected",
        "SUSPECTED": "in_review",
        "EXPIRED": "rejected",
    }.get(status)

    if not kyc_status:
        return None

    return {"applicant_id": client_id, "status": kyc_status}
