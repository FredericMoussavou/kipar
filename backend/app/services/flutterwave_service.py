import httpx
from app.core.config import settings


async def create_payment_link(
    amount: float,
    currency: str,
    booking_id: str,
    customer_email: str,
    redirect_url: str = "https://kipar.app/payment/callback",
) -> dict:
    if not settings.FLUTTERWAVE_SECRET_KEY:
        return {
            "status": "success",
            "data": {
                "link": f"https://sandbox.flutterwave.com/pay/simulated_{booking_id[:8]}",
                "tx_ref": f"simulated_{booking_id[:8]}",
            }
        }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            "https://api.flutterwave.com/v3/payments",
            headers={"Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}"},
            json={
                "tx_ref": f"kipar_{booking_id}",
                "amount": amount,
                "currency": currency,
                "redirect_url": redirect_url,
                "customer": {"email": customer_email},
                "meta": {"booking_id": booking_id},
                "customizations": {
                    "title": "KIPAR.",
                    "description": f"Paiement colis #{booking_id[:8]}",
                }
            }
        )
        return res.json()


async def verify_transaction(transaction_id: str) -> bool:
    """Vérifie qu'une transaction Flutterwave est bien complétée."""
    # Mode simulation — pas de clé ou tx simulée
    if not settings.FLUTTERWAVE_SECRET_KEY or transaction_id.startswith("simulated"):
        return True

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify",
            headers={"Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}"},
        )
        data = res.json()
        return data.get("data", {}).get("status") == "successful"
