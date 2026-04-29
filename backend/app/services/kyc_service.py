import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

ONFIDO_BASE_URL = "https://api.eu.onfido.com/v3.6"


async def create_applicant(
    first_name: str,
    last_name: str,
    email: str,
) -> dict | None:
    """
    Crée un applicant Onfido — première étape du KYC.
    Retourne l'applicant_id à stocker sur le User.
    En simulation (pas de clé), retourne un ID fictif.
    """
    if not settings.ONFIDO_API_TOKEN:
        logger.info(f"[KYC SIMULATED] Applicant créé pour {email}")
        return {"id": f"simulated_applicant_{email[:8]}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            f"{ONFIDO_BASE_URL}/applicants",
            headers={
                "Authorization": f"Token token={settings.ONFIDO_API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
            }
        )
        if res.status_code == 201:
            return res.json()
        logger.error(f"Onfido applicant creation failed: {res.text}")
        return None


async def create_sdk_token(applicant_id: str) -> str | None:
    """
    Génère un SDK token Onfido.
    Le frontend l'utilise pour afficher l'interface de vérification Onfido.
    """
    if applicant_id.startswith("simulated_"):
        return f"simulated_sdk_token_{applicant_id}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            f"{ONFIDO_BASE_URL}/sdk_token",
            headers={
                "Authorization": f"Token token={settings.ONFIDO_API_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "applicant_id": applicant_id,
                "application_id": "com.kipar.app",
            }
        )
        if res.status_code == 200:
            return res.json().get("token")
        return None


async def process_webhook(payload: dict) -> dict | None:
    """
    Traite le webhook Onfido après vérification.
    Retourne {"applicant_id": ..., "status": "verified"|"rejected"}
    """
    resource_type = payload.get("payload", {}).get("resource_type")
    action = payload.get("payload", {}).get("action")

    if resource_type != "check" or action not in ("check.completed",):
        return None

    check = payload.get("payload", {}).get("object", {})
    applicant_id = check.get("applicant_id")
    result = check.get("result")

    if not applicant_id:
        return None

    status = "verified" if result == "clear" else "rejected"
    return {"applicant_id": applicant_id, "status": status}
