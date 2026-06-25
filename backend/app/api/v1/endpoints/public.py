from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from datetime import date as dclass
from app.core.database import get_db
from app.models.trip import Trip
from app.models.user import User
from app.schemas.trip import PublicTripResponse

# Routeur PUBLIC : aucune dependance d'authentification. Donnees expurgees uniquement.
router = APIRouter(prefix='/public', tags=['public'])

PUBLIC_LIMIT = 20


def _available_filter():
    # Disponible = non supprime, futur, et :
    #   - status 'open' avec capacite kg restante, OU
    #   - accepte le petit colis (small_package_price non null) meme si 'full'
    return and_(
        Trip.deleted_at.is_(None),
        Trip.departure_date >= dclass.today(),
        Trip.status.in_(['open', 'full']),
        or_(
            and_(Trip.status == 'open', Trip.remaining_kg > 0),
            Trip.small_package_price.isnot(None),
        ),
    )


def _to_public(trip: Trip, trust: float | None) -> dict:
    return {
        'id': trip.id,
        'origin_city': trip.origin_city,
        'origin_airport_code': trip.origin_airport_code,
        'destination_city': trip.destination_city,
        'destination_airport_code': trip.destination_airport_code,
        'departure_date': trip.departure_date,
        'departure_time': trip.departure_time,
        'arrival_date': trip.arrival_date,
        'arrival_time': trip.arrival_time,
        'flight_number': trip.flight_number,
        'airline': trip.airline,
        'total_kg': trip.total_kg,
        'remaining_kg': trip.remaining_kg,
        'max_kg_per_package': trip.max_kg_per_package,
        'price_per_kg': trip.price_per_kg,
        'small_package_price': trip.small_package_price,
        'weight_unit': trip.weight_unit,
        'currency': trip.currency,
        'status': trip.status,
        'trust_score': trust,
    }


@router.get('/trips', response_model=list[PublicTripResponse])
async def public_list_trips(
    origin: str | None = None,
    destination: str | None = None,
    date_min: str | None = None,
    limit: int = PUBLIC_LIMIT,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    # Bornage anti-abus : limit dans [1, 50], offset >= 0
    limit = max(1, min(limit, 50))
    offset = max(0, offset)
    query = select(Trip).where(_available_filter())
    if origin:
        query = query.where(Trip.origin_airport_code == origin.upper())
    if destination:
        query = query.where(Trip.destination_airport_code == destination.upper())
    if date_min:
        try:
            query = query.where(Trip.departure_date >= dclass.fromisoformat(date_min))
        except ValueError:
            raise HTTPException(status_code=400, detail='invalid_date_min')
    query = query.order_by(Trip.departure_date.asc()).limit(limit).offset(offset)
    result = await db.execute(query)
    trips = result.scalars().all()
    if not trips:
        return []
    carrier_ids = list({t.carrier_id for t in trips})
    carriers_result = await db.execute(select(User).where(User.id.in_(carrier_ids)))
    trust_map = {u.id: u.trust_score for u in carriers_result.scalars().all()}
    return [_to_public(t, trust_map.get(t.carrier_id, 50.0)) for t in trips]


@router.get('/trips/{trip_id}', response_model=PublicTripResponse)
async def public_get_trip(trip_id: str, db: AsyncSession = Depends(get_db)):
    query = select(Trip).where(Trip.id == trip_id).where(_available_filter())
    result = await db.execute(query)
    trip = result.scalar_one_or_none()
    if trip is None:
        raise HTTPException(status_code=404, detail='trip_not_available')
    carrier_result = await db.execute(select(User).where(User.id == trip.carrier_id))
    carrier = carrier_result.scalar_one_or_none()
    return _to_public(trip, carrier.trust_score if carrier else 50.0)
