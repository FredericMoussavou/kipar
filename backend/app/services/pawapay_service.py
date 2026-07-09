"""Service PawaPay - API Merchant v2.

Docs : https://docs.pawapay.io/v2
Sandbox : https://api.sandbox.pawapay.io - Prod : https://api.pawapay.io
Sans PAWAPAY_API_TOKEN => mode simulation (dev / tests unitaires).
L'API est asynchrone : ACCEPTED != paye. Le statut final (COMPLETED/FAILED)
s'obtient via callback ou polling (check_*_status).
"""
import uuid
import httpx
from app.core.config import settings


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.PAWAPAY_API_TOKEN}",
        "Content-Type": "application/json",
    }


def _fmt_amount(amount: float) -> str:
    """Formate le montant : pas de decimales si valeur entiere.

    Certains operateurs (XAF/XOF notamment) refusent les decimales.
    """
    if float(amount) == int(float(amount)):
        return str(int(float(amount)))
    return f"{float(amount):.2f}"


def _msg(prefix: str, ref: str) -> str:
    """customerMessage : 4-22 caracteres alphanumeriques."""
    return f"{prefix}{str(ref)[:8].replace('-', '')}"[:22]


async def _post(path: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.PAWAPAY_BASE_URL}{path}",
            headers=_headers(),
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


async def _get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{settings.PAWAPAY_BASE_URL}{path}",
            headers=_headers(),
        )
        resp.raise_for_status()
        return resp.json()


async def initiate_deposit(
    amount: float,
    currency: str,
    phone: str,
    provider: str,
    booking_id: str,
) -> dict:
    """Demande de paiement vers le wallet mobile de l'expediteur (v2).

    phone : chiffres uniquement, indicatif pays inclus, sans '+' ni 0 initial.
    Retourne {"depositId": ..., "status": "ACCEPTED"|"REJECTED"|"DUPLICATE_IGNORED", ...}
    """
    deposit_id = str(uuid.uuid4())
    if not settings.PAWAPAY_API_TOKEN:
        # Mode simulation sans token
        return {"depositId": f"simulated_{deposit_id}", "status": "ACCEPTED"}
    payload = {
        "depositId": deposit_id,
        "amount": _fmt_amount(amount),
        "currency": currency,
        "payer": {
            "type": "MMO",
            "accountDetails": {"phoneNumber": phone, "provider": provider},
        },
        "clientReferenceId": f"kipar_{booking_id}",
        "customerMessage": _msg("KIPAR", booking_id),
        "metadata": [{"bookingId": str(booking_id)}],
    }
    return await _post("/v2/deposits", payload)


async def initiate_refund(
    deposit_id: str,
    amount: float | None,
    booking_id: str,
    currency: str | None = None,
) -> dict:
    """Remboursement d'un deposit PawaPay (v2).

    amount=None => remboursement total. Pour un remboursement partiel,
    fournir amount ET currency.
    Retourne {"refundId": ..., "status": "ACCEPTED"|"REJECTED"}
    """
    refund_id = str(uuid.uuid4())
    if not settings.PAWAPAY_API_TOKEN:
        return {"refundId": f"simulated_{refund_id}", "status": "ACCEPTED"}
    payload = {
        "refundId": refund_id,
        "depositId": deposit_id,
    }
    if amount is not None:
        payload["amount"] = _fmt_amount(amount)
        if currency:
            payload["currency"] = currency
    return await _post("/v2/refunds", payload)


async def initiate_payout(
    amount: float,
    currency: str,
    phone: str,
    provider: str,
    booking_id: str,
) -> dict:
    """Virement vers le wallet mobile du transporteur apres livraison (v2).

    Retourne {"payoutId": ..., "status": "ACCEPTED"|"REJECTED"|"ENQUEUED", ...}
    """
    payout_id = str(uuid.uuid4())
    if not settings.PAWAPAY_API_TOKEN:
        return {"payoutId": f"simulated_{payout_id}", "status": "ACCEPTED"}
    payload = {
        "payoutId": payout_id,
        "amount": _fmt_amount(amount),
        "currency": currency,
        "recipient": {
            "type": "MMO",
            "accountDetails": {"phoneNumber": phone, "provider": provider},
        },
        "clientReferenceId": f"kipar_release_{booking_id}",
        "customerMessage": _msg("KIPARLIV", booking_id),
        "metadata": [{"bookingId": str(booking_id)}],
    }
    return await _post("/v2/payouts", payload)


async def check_deposit_status(deposit_id: str) -> dict:
    """GET /v2/deposits/{id}. Retourne {"status": "FOUND"|"NOT_FOUND", "data": {...}}.

    data.status : ACCEPTED | SUBMITTED | COMPLETED | FAILED
    """
    if not settings.PAWAPAY_API_TOKEN or deposit_id.startswith("simulated_"):
        return {"status": "FOUND", "data": {"depositId": deposit_id, "status": "COMPLETED"}}
    return await _get(f"/v2/deposits/{deposit_id}")


async def check_payout_status(payout_id: str) -> dict:
    """GET /v2/payouts/{id}."""
    if not settings.PAWAPAY_API_TOKEN or payout_id.startswith("simulated_"):
        return {"status": "FOUND", "data": {"payoutId": payout_id, "status": "COMPLETED"}}
    return await _get(f"/v2/payouts/{payout_id}")


async def check_refund_status(refund_id: str) -> dict:
    """GET /v2/refunds/{id}."""
    if not settings.PAWAPAY_API_TOKEN or refund_id.startswith("simulated_"):
        return {"status": "FOUND", "data": {"refundId": refund_id, "status": "COMPLETED"}}
    return await _get(f"/v2/refunds/{refund_id}")


async def predict_provider(phone: str) -> dict:
    """POST /v2/predict-provider : valide + assainit le numero, predit l'operateur.

    Retourne {"country": ..., "provider": ..., "phoneNumber": ...}
    """
    if not settings.PAWAPAY_API_TOKEN:
        return {}
    return await _post("/v2/predict-provider", {"phoneNumber": phone})


async def get_availability(country: str | None = None) -> dict | list:
    """GET /v2/availability : disponibilite des operateurs (DEPOSIT/PAYOUT)."""
    if not settings.PAWAPAY_API_TOKEN:
        return []
    qs = f"?country={country}" if country else ""
    return await _get(f"/v2/availability{qs}")
