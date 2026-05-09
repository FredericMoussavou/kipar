import httpx
import logging
from datetime import datetime, timezone, timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)

# Cache RAM 24h
_cache: dict = {"rates": {}, "updated_at": None}

SUPPORTED_CURRENCIES = [
    "EUR", "USD", "GBP", "XOF", "XAF", "MAD", "TND", "DZD",
    "NGN", "GHS", "KES", "ZAR", "SEN", "CMR", "CIV", "CAD",
    "CHF", "JPY", "CNY", "BRL"
]

async def get_exchange_rates(base: str = "EUR") -> dict:
    """Retourne les taux de change depuis Frankfurter BCE. Cache 24h."""
    now = datetime.now(timezone.utc)
    if _cache["updated_at"] and (now - _cache["updated_at"]) < timedelta(hours=24):
        return _cache["rates"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.frankfurter.app/latest",
                params={"from": base}
            )
            data = res.json()
            rates = data.get("rates", {})
            rates[base] = 1.0
            _cache["rates"] = rates
            _cache["updated_at"] = now
            logger.info(f"Taux de change mis a jour depuis Frankfurter - {len(rates)} devises")
            return rates
    except Exception as e:
        logger.error(f"Frankfurter API error: {e}")
        if _cache["rates"]:
            return _cache["rates"]
        # Fallback minimal si API indisponible et cache vide
        return {"EUR": 1.0, "USD": 1.08, "GBP": 0.85, "XOF": 655.96, "XAF": 655.96}


async def convert_amount(amount: float, from_currency: str, to_currency: str) -> float:
    """Convertit un montant d'une devise a une autre."""
    if from_currency == to_currency:
        return amount
    rates = await get_exchange_rates("EUR")
    # Convertir via EUR comme devise pivot
    if from_currency != "EUR":
        eur_rate = rates.get(from_currency)
        if not eur_rate:
            return amount
        amount_eur = amount / eur_rate
    else:
        amount_eur = amount
    if to_currency != "EUR":
        to_rate = rates.get(to_currency)
        if not to_rate:
            return amount
        return round(amount_eur * to_rate, 2)
    return round(amount_eur, 2)
