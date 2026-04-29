from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.deps import get_verified_user
from app.models.user import User
from app.models.trip import Trip
from app.schemas.trip import TripCreate, TripResponse

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("", response_model=TripResponse, status_code=201)
async def create_trip(
    payload: TripCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
):
    """Publier un trajet — réservé aux utilisateurs KYC vérifiés."""
    trip = Trip(
        carrier_id=current_user.id,
        origin_city=payload.origin_city,
        origin_airport_code=payload.origin_airport_code,
        destination_city=payload.destination_city,
        destination_airport_code=payload.destination_airport_code,
        departure_date=payload.departure_date,
        flight_number=payload.flight_number,
        airline=payload.airline,
        total_kg=payload.total_kg,
        remaining_kg=payload.total_kg,  # au départ = total
        max_kg_per_package=payload.max_kg_per_package,
        price_per_kg=payload.price_per_kg,
    )
    db.add(trip)
    await db.flush()
    return trip


@router.get("", response_model=list[TripResponse])
async def search_trips(
    origin: str | None = None,
    destination: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Rechercher des trajets disponibles — public, pas besoin d'être connecté."""
    query = select(Trip).where(Trip.status == "open")

    if origin:
        query = query.where(
            Trip.origin_airport_code == origin.upper()
        )
    if destination:
        query = query.where(
            Trip.destination_airport_code == destination.upper()
        )

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(trip_id: str, db: AsyncSession = Depends(get_db)):
    """Détail d'un trajet."""
    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trajet introuvable")
    return trip
