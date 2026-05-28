import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("kipar")

# Mapping statut AirLabs -> statut interne KIPAR
AIRLABS_STATUS_MAP = {
    "scheduled": "scheduled",
    "active": "active",
    "en-route": "active",
    "landed": "landed",
    "diverted": "delayed",
    "cancelled": "cancelled",
    "unknown": "unknown",
}


async def fetch_flight_status(flight_number: str) -> dict | None:
    """
    Interroge AirLabs pour recuperer le statut d'un vol.
    Retourne None si le vol est introuvable ou si l'API est indisponible.
    Documentation : https://airlabs.co/docs/flight
    """
    if not settings.AIRLABS_API_KEY:
        logger.warning("[FLIGHT] AIRLABS_API_KEY absent - statut simule en dev")
        return {
            "status": "scheduled",
            "departure_actual": None,
            "arrival_estimated": None,
            "arrival_actual": None,
            "dep_iata": None,
            "arr_iata": None,
            "delayed": None,
            "airline_iata": None,
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                "https://airlabs.co/api/v9/flight",
                params={
                    "flight_iata": flight_number.upper(),
                    "api_key": settings.AIRLABS_API_KEY,
                },
            )
            if res.status_code == 404:
                logger.info("[FLIGHT] Vol introuvable : %s", flight_number)
                return None
            if res.status_code != 200:
                logger.warning("[FLIGHT] AirLabs HTTP %s pour %s", res.status_code, flight_number)
                return None

            data = res.json()
            flight = data.get("response")
            if not flight:
                logger.info("[FLIGHT] Reponse vide AirLabs pour %s", flight_number)
                return None

            raw_status = (flight.get("status") or "unknown").lower()
            status = AIRLABS_STATUS_MAP.get(raw_status, "unknown")

            return {
                "status": status,
                "departure_actual": flight.get("dep_time_utc"),
                "arrival_estimated": flight.get("arr_estimated_utc") or flight.get("arr_time_utc"),
                "arrival_actual": flight.get("arr_time_utc") if raw_status == "landed" else None,
                "dep_iata": flight.get("dep_iata"),
                "arr_iata": flight.get("arr_iata"),
                "delayed": flight.get("delayed"),
                "airline_iata": flight.get("airline_iata"),
            }

    except Exception as e:
        logger.warning("[FLIGHT] Erreur AirLabs pour %s : %s", flight_number, str(e))
        return None


async def validate_flight_number(flight_number: str) -> bool:
    """
    Valide qu'un numero de vol existe (utilise a la soumission d'un trajet).
    Retourne True si le vol est trouve, False sinon.
    En dev (pas de cle), retourne toujours True.
    """
    if not settings.AIRLABS_API_KEY:
        logger.warning("[FLIGHT] AIRLABS_API_KEY absent - validation ignoree en dev")
        return True
    result = await fetch_flight_status(flight_number)
    return result is not None
