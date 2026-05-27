import httpx
from app.core.config import settings


async def fetch_flight_status(flight_number: str) -> dict | None:
    """
    Interroge AeroDataBox (via RapidAPI) pour recuperer le statut d'un vol.
    Retourne None si le vol est introuvable ou si l'API est indisponible.
    Documentation : https://rapidapi.com/aedbx-aedbx/api/aerodatabox
    """
    if not settings.RAPIDAPI_KEY:
        # Pas de cle API — retourne un statut simule en dev
        return {
            "status": "scheduled",
            "departure_actual": None,
            "arrival_estimated": None,
            "arrival_actual": None,
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://aerodatabox.p.rapidapi.com/flights/iata/{flight_number}",
                headers={
                    "X-RapidAPI-Key": settings.RAPIDAPI_KEY,
                    "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
                },
            )
            if res.status_code == 404:
                return None
            data = res.json()
            # AeroDataBox retourne une liste
            if not data:
                return None
            flight = data[0] if isinstance(data, list) else data

            # Mapping statut AeroDataBox -> statut interne
            raw_status = flight.get("status", "unknown").lower()
            status_map = {
                "scheduled": "scheduled",
                "active": "active",
                "landed": "landed",
                "diverted": "delayed",
                "cancelled": "cancelled",
                "unknown": "unknown",
            }
            status = status_map.get(raw_status, "unknown")

            departure = flight.get("departure", {})
            arrival = flight.get("arrival", {})

            return {
                "status": status,
                "departure_actual": departure.get("actualTimeUtc") or departure.get("scheduledTimeUtc"),
                "arrival_estimated": arrival.get("estimatedTimeUtc") or arrival.get("scheduledTimeUtc"),
                "arrival_actual": arrival.get("actualTimeUtc"),
            }
    except Exception:
        return None


async def validate_flight_number(flight_number: str) -> bool:
    """
    Valide qu'un numero de vol existe (utilise a la soumission d'un trajet).
    Retourne True si le vol est trouve, False sinon.
    En dev (pas de cle), retourne toujours True.
    """
    if not settings.RAPIDAPI_KEY or settings.RAPIDAPI_KEY.startswith(b"test"):
        import logging
        logging.getLogger("kipar").warning("[FLIGHT] Cle RAPIDAPI absente ou placeholder")
        return True
    result = await fetch_flight_status(flight_number)
    return result is not None
