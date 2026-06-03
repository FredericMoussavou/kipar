from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/config", tags=["config"])


@router.get("")
async def get_public_config():
    """
    Expose les tarifs et seuils publics necessaires au frontend.
    Liste blanche explicite : aucun secret (cles API, SECRET_KEY, URLs) n'est expose.
    Source unique de verite = config.py (backend).
    """
    return {
        "fees": {
            "service_fee_sender_percent": settings.SERVICE_FEE_SENDER_PERCENT,
            "booking_flat_fee": settings.BOOKING_FLAT_FEE,
            "urgent_flat_fee": settings.URGENT_FLAT_FEE,
            "min_commission": settings.MIN_COMMISSION,
        },
        "small_package": {
            "max_kg": settings.SMALL_PACKAGE_MAX_KG,
            "kipar_fee": settings.SMALL_PACKAGE_KIPAR_FEE,
            "carrier_min": settings.SMALL_PACKAGE_CARRIER_MIN,
            "carrier_max": settings.SMALL_PACKAGE_CARRIER_MAX,
        },
        "trip": {
            "publish_urgent_min_hours": settings.TRIP_PUBLISH_URGENT_MIN_HOURS,
            "publish_normal_min_hours": settings.TRIP_PUBLISH_NORMAL_MIN_HOURS,
        },
        "booking": {
            "urgent_threshold_hours": settings.BOOKING_URGENT_THRESHOLD_HOURS,
            "min_hours_before_departure": settings.BOOKING_MIN_HOURS_BEFORE_DEPARTURE,
            "max_evidence_files": settings.MAX_EVIDENCE_FILES,
        },
        "insurance": {
            "enabled": settings.INSURANCE_ENABLED,
            "rate_type": settings.INSURANCE_RATE_TYPE,
            "rate_value": settings.INSURANCE_RATE_VALUE,
            "self_cover_max": settings.INSURANCE_SELF_COVER_MAX,
        },
    }
