from fastapi import APIRouter, HTTPException
from app.services.currency_service import get_exchange_rates, convert_amount, SUPPORTED_CURRENCIES

router = APIRouter(prefix="/currencies", tags=["currencies"])


@router.get("/rates")
async def get_rates(base: str = "EUR"):
    """Taux de change depuis Frankfurter BCE. Cache RAM 24h."""
    if base not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Devise non supportee : {base}")
    rates = await get_exchange_rates(base)
    return {
        "base": base,
        "rates": {k: v for k, v in rates.items() if k in SUPPORTED_CURRENCIES},
        "supported_currencies": SUPPORTED_CURRENCIES,
    }


@router.get("/convert")
async def convert(
    amount: float,
    from_currency: str = "EUR",
    to_currency: str = "XOF",
):
    """Convertit un montant d'une devise a une autre."""
    result = await convert_amount(amount, from_currency, to_currency)
    return {
        "amount": amount,
        "from": from_currency,
        "to": to_currency,
        "converted": result,
    }
