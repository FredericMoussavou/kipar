import httpx
from app.core.config import settings


async def fetch_flight_status(flight_number: str) -> dict | None:
    """
    Interroge AviationStack pour récupérer le statut d'un vol.
    Retourne None si le vol est introuvable ou si l'API est indisponible.
    """
    if not settings.AVIATIONSTACK_API_KEY:
        # Pas de clé API configurée — retourne un statut simulé en dev
        return {
            "status": "scheduled",
            "departure_actual": None,
            "arrival_estimated": None,
            "arrival_actual": None,
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                "http://api.aviationstack.com/v1/flights",
                params={
                    "access_key": settings.AVIATIONSTACK_API_KEY,
                    "flight_iata": flight_number,
                }
            )
            data = res.json()
            if not data.get("data"):
                return None

            flight = data["data"][0]
            return {
                "status": flight.get("flight_status", "unknown"),
                "departure_actual": flight.get("departure", {}).get("actual"),
                "arrival_estimated": flight.get("arrival", {}).get("estimated"),
                "arrival_actual": flight.get("arrival", {}).get("actual"),
            }
    except Exception:
        return None
