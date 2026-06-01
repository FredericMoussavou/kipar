from app.core.rate_limit import limiter
from fastapi import APIRouter, Depends, HTTPException, Query, Request
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



@router.get("/verify-flight")
async def verify_flight(
    flight_number: str,
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Valide qu'un numero de vol existe — appele a la soumission du formulaire new-trip."""
    import re
    # Validation format IATA : 2 lettres + 1-4 chiffres (ex: AF123, EK1234)
    if not flight_number or not re.match(r"^[A-Za-z]{2}\d{1,4}$", flight_number.strip()):
        return {"valid": False, "flight_number": flight_number.upper(), "advisory": False, "reason": "invalid_format"}
    # Validation non bloquante — AirLabs ne couvre pas tous les vols futurs
    try:
        found = await validate_flight_number(flight_number.upper())
    except Exception:
        found = None  # Inconnu — erreur API
    if found is True:
        return {"valid": True, "flight_number": flight_number.strip().upper(), "advisory": False, "reason": "ok"}
    if found is False:
        # Vol non trouve — advisory True = non bloquant
        return {"valid": False, "flight_number": flight_number.strip().upper(), "advisory": True, "reason": "not_found"}
    # found is None = erreur API — on laisse passer
    return {"valid": True, "flight_number": flight_number.strip().upper(), "advisory": True, "reason": "api_error"}

@router.post("", response_model=TripResponse, status_code=201)
@limiter.limit("5/minute")
async def create_trip(
    request: Request,
    payload: TripCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_verified_user),
    lang: str = Depends(get_lang),
):
    import os
    if os.environ.get("ENVIRONMENT") != "test" and current_user.kyc_status != "approved":
        raise HTTPException(status_code=403, detail=t("errors.kyc_required", lang))
    from app.api.v1.endpoints.premium import is_premium_active
    from sqlalchemy import func
    if not is_premium_active(current_user):
        active_trips_result = await db.execute(
            select(func.count()).where(
                Trip.carrier_id == current_user.id,
                Trip.status.in_(["open", "full"]),
                Trip.deleted_at.is_(None),
            )
        )
        if active_trips_result.scalar() >= 2:
            raise HTTPException(status_code=403, detail=t("errors.premium_trip_limit", lang))

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

    # Validation delai minimum avant depart
    from datetime import date as dclass2, time as tclass2, datetime as dtclass2, timezone as tz2
    dep_time2 = payload.departure_time if payload.departure_time else tclass2(0, 0)
    if isinstance(dep_time2, str):
        h2, m2 = dep_time2.split(':')[:2]
        dep_time2 = tclass2(int(h2), int(m2))
    dep_dt2 = dtclass2.combine(payload.departure_date, dep_time2).replace(tzinfo=tz2.utc)
    hours_until2 = (dep_dt2 - dtclass2.now(tz2.utc)).total_seconds() / 3600
    if hours_until2 <= 0:
        raise HTTPException(status_code=400, detail=t("errors.trip_departure_past", lang))
    accepts_urgent2 = payload.accepts_urgent if hasattr(payload, "accepts_urgent") else False
    if accepts_urgent2:
        from app.api.v1.endpoints.premium import is_premium_active
        if not is_premium_active(current_user):
            raise HTTPException(status_code=403, detail=t("errors.premium_required_urgent", lang))
        if hours_until2 < 72:
            raise HTTPException(status_code=400, detail=t("errors.trip_too_close_urgent", lang))
    else:
        if hours_until2 < 7 * 24:
            raise HTTPException(status_code=400, detail=t("errors.trip_too_close_normal", lang))

    # Validation : au moins price_per_kg ou small_package_price requis
    if payload.price_per_kg is None and payload.small_package_price is None:
        raise HTTPException(status_code=400, detail=t("errors.trip_price_required", lang))

    # Validation small_package_price
    if payload.small_package_price is not None:
        if payload.small_package_price < settings.SMALL_PACKAGE_CARRIER_MIN:
            raise HTTPException(status_code=400, detail=t("errors.small_package_price_too_low", lang))
        if payload.small_package_price > settings.SMALL_PACKAGE_CARRIER_MAX:
            raise HTTPException(status_code=400, detail=t("errors.small_package_price_too_high", lang))

    trip = Trip(
        carrier_id=current_user.id,
        origin_city=payload.origin_city,
        origin_airport_code=payload.origin_airport_code,
        destination_city=payload.destination_city,
        destination_airport_code=payload.destination_airport_code,
        departure_date=payload.departure_date,
        departure_time=payload.departure_time,
        arrival_date=payload.arrival_date if payload.arrival_date else None,
        arrival_time=payload.arrival_time,
        flight_number=payload.flight_number,
        airline=payload.airline,
        total_kg=payload.total_kg,
        remaining_kg=payload.total_kg,
        max_kg_per_package=payload.max_kg_per_package,
        price_per_kg=payload.price_per_kg or 0.0,
        small_package_price=payload.small_package_price,
        weight_unit=payload.weight_unit if hasattr(payload, "weight_unit") else "kg",
        currency=payload.currency if hasattr(payload, "currency") else "EUR",
        accepts_urgent=payload.accepts_urgent if hasattr(payload, "accepts_urgent") else False,
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
    if not trips:
        return []
    carrier_ids = list({t.carrier_id for t in trips})
    carriers_result = await db.execute(select(User).where(User.id.in_(carrier_ids)))
    carriers = {u.id: u for u in carriers_result.scalars().all()}
    enriched = []
    for trip in trips:
        carrier = carriers.get(trip.carrier_id)
        trip_dict = {
            "id": trip.id,
            "carrier_id": trip.carrier_id,
            "origin_city": trip.origin_city,
            "origin_airport_code": trip.origin_airport_code,
            "destination_city": trip.destination_city,
            "destination_airport_code": trip.destination_airport_code,
            "departure_date": trip.departure_date,
            "departure_time": trip.departure_time,
            "arrival_date": str(trip.arrival_date) if trip.arrival_date else None,
            "arrival_time": trip.arrival_time,
            "flight_number": trip.flight_number,
            "airline": trip.airline,
            "total_kg": trip.total_kg,
            "remaining_kg": trip.remaining_kg,
            "max_kg_per_package": trip.max_kg_per_package,
            "price_per_kg": trip.price_per_kg,
            "weight_unit": trip.weight_unit,
            "currency": trip.currency,
            "status": trip.status,
            "trust_score": carrier.trust_score if carrier else 50.0,
            "carrier_username": carrier.username if carrier else None,
            "carrier_avatar_url": carrier.avatar_url if carrier else None,
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

    # Verifier que toutes les reservations sont en statut terminal
    bookings_result = await db.execute(
        select(Booking).where(Booking.trip_id == trip.id)
    )
    bookings = bookings_result.scalars().all()
    TERMINAL = {"cancelled", "cancelled_by_sender", "cancelled_by_carrier", "refused", "refunded", "delivered"}
    active = [b for b in bookings if b.status not in TERMINAL]
    if active:
        raise HTTPException(
            status_code=400,
            detail=t("errors.trip_has_active_bookings", lang)
        )

    # Soft delete du trip
    trip.deleted_at = datetime.now(timezone.utc)
    trip.status = "cancelled"
    await db.flush()
    return None


@router.get("/corridors")
async def get_corridors(
    db: AsyncSession = Depends(get_db),
    limit: int = 5,
):
    """Top corridors par activité (90 derniers jours, tous statuts)."""
    from datetime import date, timedelta
    from sqlalchemy import func
    from app.core.config import settings

    cutoff = date.today() - timedelta(days=settings.PRICE_SUGGESTION_WINDOW_DAYS)

    result = await db.execute(
        select(
            Trip.origin_airport_code,
            Trip.origin_city,
            Trip.destination_airport_code,
            Trip.destination_city,
            func.count(Trip.id).label("trip_count"),
        ).where(
            Trip.departure_date >= cutoff,
            Trip.deleted_at.is_(None),
        ).group_by(
            Trip.origin_airport_code,
            Trip.origin_city,
            Trip.destination_airport_code,
            Trip.destination_city,
        ).order_by(
            func.count(Trip.id).desc()
        ).limit(limit)
    )
    rows = result.fetchall()
    return [
        {
            "origin": row.origin_airport_code,
            "destination": row.destination_airport_code,
            "label": f"{row.origin_airport_code} → {row.destination_airport_code}",
            "origin_city": row.origin_city,
            "destination_city": row.destination_city,
            "trip_count": row.trip_count,
        }
        for row in rows
    ]


@router.get("/price-suggestion")
async def get_price_suggestion(
    origin: str,
    destination: str,
    db: AsyncSession = Depends(get_db),
):
    """Fourchette de prix suggeree pour un corridor.
    Percentile 25/75 sur les 90 derniers jours, min 5 echantillons.
    Si donnees insuffisantes : fourchette globale plateforme.
    """
    from datetime import date, timedelta
    from sqlalchemy import func
    from app.core.config import settings

    cutoff = date.today() - timedelta(days=settings.PRICE_SUGGESTION_WINDOW_DAYS)

    # Prix sur ce corridor
    corridor_result = await db.execute(
        select(Trip.price_per_kg).where(
            Trip.origin_airport_code.ilike(f"%{origin}%"),
            Trip.destination_airport_code.ilike(f"%{destination}%"),
            Trip.departure_date >= cutoff,
            Trip.deleted_at.is_(None),
            Trip.status != "cancelled",
        )
    )
    prices = [row[0] for row in corridor_result.fetchall() if row[0] and row[0] > 0]

    if len(prices) >= settings.PRICE_SUGGESTION_MIN_SAMPLES:
        prices_sorted = sorted(prices)
        n = len(prices_sorted)
        p25_idx = max(0, int(n * 0.25) - 1)
        p75_idx = min(n - 1, int(n * 0.75))
        return {
            "corridor": f"{origin} → {destination}",
            "price_low": round(prices_sorted[p25_idx], 2),
            "price_high": round(prices_sorted[p75_idx], 2),
            "sample_count": n,
            "is_corridor_data": True,
            "window_days": settings.PRICE_SUGGESTION_WINDOW_DAYS,
        }

    # Fallback : fourchette globale plateforme
    global_result = await db.execute(
        select(Trip.price_per_kg).where(
            Trip.departure_date >= cutoff,
            Trip.deleted_at.is_(None),
            Trip.status != "cancelled",
        )
    )
    global_prices = sorted([r[0] for r in global_result.fetchall() if r[0] and r[0] > 0])

    if len(global_prices) >= settings.PRICE_SUGGESTION_MIN_SAMPLES:
        n = len(global_prices)
        p25_idx = max(0, int(n * 0.25) - 1)
        p75_idx = min(n - 1, int(n * 0.75))
        return {
            "corridor": f"{origin} → {destination}",
            "price_low": round(global_prices[p25_idx], 2),
            "price_high": round(global_prices[p75_idx], 2),
            "sample_count": n,
            "is_corridor_data": False,
            "window_days": settings.PRICE_SUGGESTION_WINDOW_DAYS,
            "note": "Estimation indicative - donnees corridor insuffisantes",
        }

    # Aucune donnee disponible
    return {
        "corridor": f"{origin} → {destination}",
        "price_low": None,
        "price_high": None,
        "sample_count": 0,
        "is_corridor_data": False,
        "note": "Aucune donnee disponible pour ce corridor",
    }


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
        arrival_date=str(trip.arrival_date) if trip.arrival_date else None,
        arrival_time=trip.arrival_time,
        flight_number=trip.flight_number,
        airline=trip.airline,
        total_kg=trip.total_kg,
        remaining_kg=trip.remaining_kg,
        max_kg_per_package=trip.max_kg_per_package,
        price_per_kg=trip.price_per_kg,
        weight_unit=trip.weight_unit,
        currency=trip.currency,
        status=trip.status,
        trust_score=carrier.trust_score if carrier else 50.0,
        carrier_full_name=carrier.full_name if carrier else None,
        carrier_avatar_url=carrier.avatar_url if carrier else None,
        carrier_kyc_status=carrier.kyc_status if carrier else None,
        carrier_member_since=carrier.created_at.year if carrier else None,
        carrier_trip_count=trip_count,
        carrier_avg_rating=round(float(avg_rating), 1) if avg_rating else None,
        carrier_review_count=review_count or 0,
        carrier_username=carrier.username if carrier else None,
    )
