from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.trip import Trip
from app.models.flight import FlightTracking
from app.schemas.tracking import FlightTrackingResponse, SetFlightRequest
from app.services.flight_service import fetch_flight_status
from app.i18n.loader import t

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.post("/{trip_id}/flight", response_model=FlightTrackingResponse)
async def set_flight(
    trip_id: str,
    payload: SetFlightRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    result = await db.execute(
        select(FlightTracking).where(FlightTracking.trip_id == trip_id)
    )
    existing = result.scalar_one_or_none()
    flight_data = await fetch_flight_status(payload.flight_number)

    if existing:
        existing.flight_number = payload.flight_number
        existing.airline = flight_data.get("airline_iata") or payload.airline
        if flight_data:
            existing.status = flight_data["status"]
            existing.arrival_estimated = flight_data.get("arrival_estimated")
            existing.departure_actual = flight_data.get("departure_actual")
            existing.dep_iata = flight_data.get("dep_iata")
            existing.arr_iata = flight_data.get("arr_iata")
            existing.delayed_minutes = flight_data.get("delayed")
        existing.last_checked_at = datetime.now(timezone.utc)
        return existing

    tracking = FlightTracking(
        trip_id=trip.id,
        flight_number=payload.flight_number,
        airline=(flight_data.get("airline_iata") if flight_data else None) or payload.airline,
        status=flight_data["status"] if flight_data else "unknown",
        departure_actual=flight_data.get("departure_actual") if flight_data else None,
        arrival_estimated=flight_data.get("arrival_estimated") if flight_data else None,
        dep_iata=flight_data.get("dep_iata") if flight_data else None,
        arr_iata=flight_data.get("arr_iata") if flight_data else None,
        delayed_minutes=flight_data.get("delayed") if flight_data else None,
        last_checked_at=datetime.now(timezone.utc),
    )
    db.add(tracking)
    await db.flush()
    trip.flight_number = payload.flight_number
    trip.airline = payload.airline
    trip.status = "in_transit"
    return tracking


@router.get("/{trip_id}/flight", response_model=FlightTrackingResponse)
async def get_flight_status(
    trip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(
        select(FlightTracking).where(FlightTracking.trip_id == trip_id)
    )
    tracking = result.scalar_one_or_none()
    if not tracking:
        raise HTTPException(status_code=404, detail=t("errors.flight_not_found", lang))
    return tracking
