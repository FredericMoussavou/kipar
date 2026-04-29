from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.trip import Trip
from app.models.flight import FlightTracking
from app.schemas.tracking import FlightTrackingResponse, SetFlightRequest
from app.services.flight_service import fetch_flight_status

router = APIRouter(prefix="/tracking", tags=["tracking"])


@router.post("/{trip_id}/flight", response_model=FlightTrackingResponse)
async def set_flight(
    trip_id: str,
    payload: SetFlightRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Le transporteur saisit son numéro de vol.
    Kipar interroge AviationStack et crée le suivi.
    """
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trajet introuvable")
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    # Vérifie si un tracking existe déjà
    result = await db.execute(
        select(FlightTracking).where(FlightTracking.trip_id == trip_id)
    )
    existing = result.scalar_one_or_none()

    # Interroge l'API de vols
    flight_data = await fetch_flight_status(payload.flight_number)

    if existing:
        # Met à jour le tracking existant
        existing.flight_number = payload.flight_number
        existing.airline = payload.airline
        if flight_data:
            existing.status = flight_data["status"]
            existing.arrival_estimated = flight_data.get("arrival_estimated")
        existing.last_checked_at = datetime.now(timezone.utc)
        return existing

    # Crée le tracking
    tracking = FlightTracking(
        trip_id=trip.id,
        flight_number=payload.flight_number,
        airline=payload.airline,
        status=flight_data["status"] if flight_data else "unknown",
        arrival_estimated=flight_data.get("arrival_estimated") if flight_data else None,
        last_checked_at=datetime.now(timezone.utc),
    )
    db.add(tracking)
    await db.flush()

    # Met à jour le trip avec le numéro de vol
    trip.flight_number = payload.flight_number
    trip.airline = payload.airline
    trip.status = "in_transit"

    return tracking


@router.get("/{trip_id}/flight", response_model=FlightTrackingResponse)
async def get_flight_status(
    trip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Récupère le statut actuel du vol."""
    result = await db.execute(
        select(FlightTracking).where(FlightTracking.trip_id == trip_id)
    )
    tracking = result.scalar_one_or_none()
    if not tracking:
        raise HTTPException(status_code=404, detail="Aucun suivi de vol pour ce trajet")
    return tracking
