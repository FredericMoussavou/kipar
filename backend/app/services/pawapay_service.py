import uuid
import httpx
from app.core.config import settings


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.PAWAPAY_API_TOKEN}",
        "Content-Type": "application/json",
    }


async def initiate_deposit(
    amount: float,
    currency: str,
    phone: str,
    provider: str,
    booking_id: str,
) -> dict:
    """Demande de paiement vers le wallet mobile de l'expediteur.
    Retourne {"depositId": ..., "status": "ACCEPTED"|"REJECTED", ...}
    """
    deposit_id = str(uuid.uuid4())
    payload = {
        "depositId": deposit_id,
        "amount": f"{amount:.2f}",
        "currency": currency,
        "payer": {
            "type": "MSISDN",
            "address": {"value": phone},
        },
        "correspondent": provider,
        "statementDescription": f"KIPAR-{booking_id[:8]}",
        "clientReferenceId": f"kipar_{booking_id}",
    }
    if not settings.PAWAPAY_API_TOKEN:
        # Mode simulation sandbox sans token
        return {"depositId": f"simulated_{deposit_id}", "status": "ACCEPTED"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.PAWAPAY_BASE_URL}/v1/deposits",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def initiate_refund(
    deposit_id: str,
    amount: float,
    booking_id: str,
) -> dict:
    """Remboursement d'un deposit PawaPay.
    Retourne {"refundId": ..., "status": "ACCEPTED"|"REJECTED"}
    """
    refund_id = str(uuid.uuid4())
    payload = {
        "refundId": refund_id,
        "depositId": deposit_id,
        "amount": f"{amount:.2f}",
        "statementDescription": f"REMB-{booking_id[:8]}",
    }
    if not settings.PAWAPAY_API_TOKEN:
        return {"refundId": f"simulated_{refund_id}", "status": "ACCEPTED"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.PAWAPAY_BASE_URL}/v1/refunds",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def initiate_payout(
    amount: float,
    currency: str,
    phone: str,
    provider: str,
    booking_id: str,
) -> dict:
    """Virement vers le wallet mobile du transporteur apres livraison.
    Retourne {"payoutId": ..., "status": "ACCEPTED"|"REJECTED"}
    """
    payout_id = str(uuid.uuid4())
    payload = {
        "payoutId": payout_id,
        "amount": f"{amount:.2f}",
        "currency": currency,
        "recipient": {
            "type": "MSISDN",
            "address": {"value": phone},
        },
        "correspondent": provider,
        "statementDescription": f"KIPAR-LIV-{booking_id[:8]}",
        "clientReferenceId": f"kipar_release_{booking_id}",
    }
    if not settings.PAWAPAY_API_TOKEN:
        return {"payoutId": f"simulated_{payout_id}", "status": "ACCEPTED"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.PAWAPAY_BASE_URL}/v1/payouts",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()
