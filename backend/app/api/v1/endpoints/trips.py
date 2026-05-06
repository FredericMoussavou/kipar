from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_verified_user, get_current_user, get_optional_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.trip import Trip
from app.schemas.trip import TripCreate, TripResponse
from app.i18n.loader import t
from app.models.package_request import PackageRequest
from app.services.notif_db_service import notify_trip_match

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("", response_model=TripResponse, status_code=201)
async def create_trip(
    payload: TripCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    lang: str = Depends(get_lang),
):
    # Contrainte unicite : meme transporteur, meme corridor, meme date+heure
    dup_query = select(Trip).where(
        Trip.carrier_id == current_user.id,
        Trip.origin_airport_code == payload.origin_airport_code,
        Trip.destination_airport_code == payload.destination_airport_code,
        Trip.departure_date == payload.departure_date,
        Trip.deleted_at.is_(None),
    )
    if payload.departure_time:
        dup_query = dup_query.where(Trip.departure_time == payload.departure_time)
    dup_result = await db.execute(dup_query)
    if dup_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=t("errors.trip_duplicate", lang))

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
        remaining_kg=payload.total_kg,
        max_kg_per_package=payload.max_kg_per_package,
        price_per_kg=payload.price_per_kg,
    )
    db.add(trip)
    await db.flush()

    # Matching — notifie les expéditeurs dont l'annonce correspond à ce trajet
    matching = await db.execute(
        select(PackageRequest).where(
            PackageRequest.origin_airport_code == payload.origin_airport_code,
            PackageRequest.destination_airport_code == payload.destination_airport_code,
            PackageRequest.status == "open",
        )
    )
    matched_requests = matching.scalars().all()
    route = f"{payload.origin_airport_code} -> {payload.destination_airport_code}"
    for req in matched_requests:
        if req.sender_id != current_user.id:
            await notify_trip_match(
                db=db,
                user_id=req.sender_id,
                route=route,
                trip_id=trip.id,
                lang=lang,
            )

    await db.commit()
    await db.refresh(trip)
    return trip


@router.get("", response_model=list[TripResponse], response_model_exclude_none=False)
async def search_trips(
    origin: str | None = None,
    destination: str | None = None,
    date: str | None = None,
    sort_by: str | None = None,
    mine: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    if mine and current_user:
        query = select(Trip).where(Trip.carrier_id == current_user.id, Trip.deleted_at.is_(None)).order_by(Trip.created_at.desc())
    else:
        from datetime import date as dclass
        query = select(Trip).where(Trip.status == "open", Trip.departure_date >= dclass.today(), Trip.deleted_at.is_(None))
        if origin:
            query = query.where(Trip.origin_airport_code == origin.upper())
        if destination:
            query = query.where(Trip.destination_airport_code == destination.upper())
        if date:
            query = query.where(Trip.departure_date == dclass.fromisoformat(date))
        if sort_by == "price_asc":
            query = query.order_by(Trip.price_per_kg.asc())
        elif sort_by == "price_desc":
            query = query.order_by(Trip.price_per_kg.desc())
        else:
            query = query.order_by(Trip.departure_date.asc())
    result = await db.execute(query)
    trips = result.scalars().all()
    enriched = []
    for trip in trips:
        carrier_result = await db.execute(select(User).where(User.id == trip.carrier_id))
        carrier = carrier_result.scalar_one_or_none()
        trip_dict = {
            "id": trip.id,
            "carrier_id": trip.carrier_id,
            "origin_city": trip.origin_city,
            "origin_airport_code": trip.origin_airport_code,
            "destination_city": trip.destination_city,
            "destination_airport_code": trip.destination_airport_code,
            "departure_date": trip.departure_date,
            "departure_time": trip.departure_time,
            "arrival_time": trip.arrival_time,
            "flight_number": trip.flight_number,
            "airline": trip.airline,
            "total_kg": trip.total_kg,
            "remaining_kg": trip.remaining_kg,
            "max_kg_per_package": trip.max_kg_per_package,
            "price_per_kg": trip.price_per_kg,
            "status": trip.status,
            "trust_score": carrier.trust_score if carrier else 50.0,
        }
        enriched.append(trip_dict)
    return enriched


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(
    trip_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    from datetime import datetime, timezone
    from sqlalchemy import update
    from app.models.booking import Booking

    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if trip.deleted_at is not None:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))

    # Annuler les bookings actifs
    await db.execute(
        update(Booking)
        .where(
            Booking.trip_id == trip.id,
            Booking.status.in_(["pending", "accepted", "paid", "in_transit"])
        )
        .values(status="cancelled")
    )

    # Soft delete du trip
    trip.deleted_at = datetime.now(timezone.utc)
    trip.status = "cancelled"
    await db.flush()
    return None


@router.get("/{trip_id}", response_model=TripResponse)
async def get_trip(
    trip_id: str,
    db: AsyncSession = Depends(get_db),
    lang: str = Query("fr"),
):
    from sqlalchemy import func
    from app.models.review import Review

    result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))

    carrier_result = await db.execute(select(User).where(User.id == trip.carrier_id))
    carrier = carrier_result.scalar_one_or_none()

    trip_count_result = await db.execute(
        select(func.count()).where(Trip.carrier_id == trip.carrier_id, Trip.deleted_at.is_(None))
    )
    trip_count = trip_count_result.scalar() or 0

    rating_result = await db.execute(
        select(func.avg(Review.score), func.count(Review.id))
        .where(Review.reviewed_id == trip.carrier_id)
    )
    avg_rating, review_count = rating_result.one()

    return TripResponse(
        id=trip.id,
        carrier_id=trip.carrier_id,
        origin_city=trip.origin_city,
        origin_airport_code=trip.origin_airport_code,
        destination_city=trip.destination_city,
        destination_airport_code=trip.destination_airport_code,
        departure_date=trip.departure_date,
        departure_time=trip.departure_time,
        arrival_time=trip.arrival_time,
        flight_number=trip.flight_number,
        airline=trip.airline,
        total_kg=trip.total_kg,
        remaining_kg=trip.remaining_kg,
        max_kg_per_package=trip.max_kg_per_package,
        price_per_kg=trip.price_per_kg,
        status=trip.status,
        trust_score=carrier.trust_score if carrier else 50.0,
        carrier_full_name=carrier.full_name if carrier else None,
        carrier_avatar_url=carrier.avatar_url if carrier else None,
        carrier_kyc_status=carrier.kyc_status if carrier else None,
        carrier_member_since=carrier.created_at.year if carrier else None,
        carrier_trip_count=trip_count,
        carrier_avg_rating=round(float(avg_rating), 1) if avg_rating else None,
        carrier_review_count=review_count or 0,
    )
