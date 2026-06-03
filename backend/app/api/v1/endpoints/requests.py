from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user, get_optional_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.trip import Trip
from app.models.package_request import PackageRequest, Application
from app.models.booking import Booking
from app.models.package import Package
from app.schemas.package_request import PackageRequestCreate, PackageRequestResponse, ApplicationResponse
from app.i18n.loader import t
from app.services.notif_db_service import notify_new_application

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("", response_model=PackageRequestResponse, status_code=201)
async def create_request(
    payload: PackageRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    from app.api.v1.endpoints.premium import is_premium_active
    from sqlalchemy import func
    if not is_premium_active(current_user):
        active_req_result = await db.execute(
            select(func.count()).where(
                PackageRequest.sender_id == current_user.id,
                PackageRequest.status == "open",
                PackageRequest.deleted_at.is_(None),
            )
        )
        if active_req_result.scalar() >= 2:
            raise HTTPException(status_code=403, detail=t("errors.premium_request_limit", lang))

    req = PackageRequest(
        sender_id=current_user.id,
        origin_city=payload.origin_city,
        origin_airport_code=payload.origin_airport_code,
        destination_city=payload.destination_city,
        destination_airport_code=payload.destination_airport_code,
        content_description=payload.content_description,
        weight_kg=payload.weight_kg,
        declared_value=payload.declared_value,
        budget_per_kg=payload.budget_per_kg,
        photos=payload.photos,
        receiver_email_or_phone=payload.receiver_email_or_phone,
        deadline_date=payload.deadline_date,
    )
    db.add(req)
    await db.flush()
    return _enrich_request(req, current_user, 0)


@router.get("", response_model=list[PackageRequestResponse])
async def list_requests(
    origin: str | None = None,
    destination: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    from datetime import date as dclass
    query = select(PackageRequest).where(
        PackageRequest.status == "open",
        PackageRequest.deadline_date >= dclass.today(),
        PackageRequest.deleted_at.is_(None),
    )
    if origin:
        query = query.where(PackageRequest.origin_airport_code == origin.upper())
    if destination:
        query = query.where(PackageRequest.destination_airport_code == destination.upper())
    query = query.order_by(PackageRequest.deadline_date.asc())
    result = await db.execute(query)
    requests = result.scalars().all()
    if not requests:
        return []
    sender_ids = list({r.sender_id for r in requests})
    req_ids = [r.id for r in requests]
    senders_res = await db.execute(select(User).where(User.id.in_(sender_ids)))
    senders = {u.id: u for u in senders_res.scalars().all()}
    apps_res = await db.execute(select(Application).where(Application.package_request_id.in_(req_ids)))
    all_apps = apps_res.scalars().all()
    apps_by_req: dict = {}
    for a in all_apps:
        apps_by_req.setdefault(a.package_request_id, []).append(a)
    enriched = []
    for req in requests:
        sender = senders.get(req.sender_id)
        apps = apps_by_req.get(req.id, [])
        apps_count = len(apps)
        has_applied = any(a.carrier_id == current_user.id for a in apps) if current_user else False
        enriched.append(_enrich_request(req, sender, apps_count, has_applied))
    return enriched


@router.get("/mine", response_model=list[PackageRequestResponse])
async def list_my_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PackageRequest)
        .where(PackageRequest.sender_id == current_user.id, PackageRequest.deleted_at.is_(None))
        .order_by(PackageRequest.created_at.desc())
    )
    requests = result.scalars().all()
    if not requests:
        return []
    req_ids = [r.id for r in requests]
    apps_res = await db.execute(select(Application).where(Application.package_request_id.in_(req_ids)))
    apps_count_map = {}
    for a in apps_res.scalars().all():
        apps_count_map[a.package_request_id] = apps_count_map.get(a.package_request_id, 0) + 1
    enriched = []
    for req in requests:
        enriched.append(_enrich_request(req, current_user, apps_count_map.get(req.id, 0)))
    return enriched


@router.get("/{request_id}", response_model=PackageRequestResponse)
async def get_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await db.execute(
        select(PackageRequest).where(
            PackageRequest.id == request_id,
            PackageRequest.deleted_at.is_(None),
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Not found")
    sender_result = await db.execute(select(User).where(User.id == req.sender_id))
    sender = sender_result.scalar_one_or_none()
    apps_result = await db.execute(
        select(Application).where(Application.package_request_id == req.id)
    )
    apps = apps_result.scalars().all()
    apps_count = len(apps)
    has_applied = any(a.carrier_id == current_user.id for a in apps) if current_user else False
    return _enrich_request(req, sender, apps_count, has_applied)


@router.delete("/{request_id}", status_code=204)
async def delete_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(PackageRequest).where(PackageRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail=t("errors.not_found", lang))
    if req.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    # Delai minimum 24h si des candidatures ont ete recues
    from app.core.config import settings
    from app.models.package_request import Application
    from datetime import timedelta
    apps_result = await db.execute(
        select(Application).where(Application.package_request_id == req.id)
    )
    applications = apps_result.scalars().all()
    if applications:
        last_app = max(applications, key=lambda a: a.created_at)
        min_delete_time = last_app.created_at + timedelta(hours=settings.LISTING_MIN_DELAY_HOURS)
        if datetime.now(timezone.utc) < min_delete_time:
            raise HTTPException(
                status_code=400,
                detail=t("errors.listing_delete_too_soon", lang)
            )
        from app.services.notif_db_service import create_notification
        for app in applications:
            await create_notification(
                db=db,
                user_id=app.carrier_id,
                type="request_deleted",
                title="Annonce supprimee",
                body="L'annonce sur laquelle vous avez candidaté a été supprimée.",
                link="/carrier",
            )

    req.deleted_at = datetime.now(timezone.utc)
    req.status = "cancelled"
    await db.flush()
    return None


@router.post("/{request_id}/apply", response_model=ApplicationResponse, status_code=201)
async def apply_to_request(
    request_id: str,
    trip_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    # Verif request
    result = await db.execute(select(PackageRequest).where(PackageRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req or req.status != "open" or req.deleted_at is not None:
        raise HTTPException(status_code=404, detail=t("errors.not_found", lang))
    if req.sender_id == current_user.id:
        raise HTTPException(status_code=400, detail=t("errors.carrier_cannot_send", lang))

    # Verif trip
    trip_result = await db.execute(select(Trip).where(Trip.id == trip_id))
    trip = trip_result.scalar_one_or_none()
    if not trip or trip.carrier_id != current_user.id or trip.deleted_at is not None:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))
    # Verif corridor : le trajet doit relier les memes aeroports que la demande
    if (trip.origin_airport_code != req.origin_airport_code
            or trip.destination_airport_code != req.destination_airport_code):
        raise HTTPException(status_code=400, detail=t("errors.trip_corridor_mismatch", lang))
    if trip.price_per_kg > req.budget_per_kg:
        raise HTTPException(status_code=400, detail=t("errors.price_above_budget", lang))
    if trip.remaining_kg < req.weight_kg:
        raise HTTPException(status_code=400, detail=t("errors.insufficient_kg", lang))

    # Regle delai minimum 36h avant depart du trip
    from datetime import date as dclass, time as tclass, datetime as dtclass, timezone
    dep_time = trip.departure_time if hasattr(trip, 'departure_time') and trip.departure_time else tclass(0, 0)
    if isinstance(dep_time, str):
        h, m = dep_time.split(':')[:2]
        dep_time = tclass(int(h), int(m))
    dep_dt = dtclass.combine(trip.departure_date, dep_time).replace(tzinfo=timezone.utc)
    hours_until_dep = (dep_dt - dtclass.now(timezone.utc)).total_seconds() / 3600
    if hours_until_dep <= settings.BOOKING_MIN_HOURS_BEFORE_DEPARTURE:
        raise HTTPException(status_code=400, detail=t("errors.trip_too_close", lang))
    if hours_until_dep <= settings.BOOKING_URGENT_THRESHOLD_HOURS and not trip.accepts_urgent:        
        raise HTTPException(status_code=400, detail=t("errors.trip_not_urgent", lang))

    # Pas de double candidature
    existing = await db.execute(
        select(Application).where(
            Application.package_request_id == req.id,
            Application.carrier_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=t("errors.already_applied", lang))

    app = Application(
        package_request_id=req.id,
        carrier_id=current_user.id,
        trip_id=trip.id,
    )
    db.add(app)
    await db.flush()

    # Notifie l'expéditeur de la nouvelle candidature
    await notify_new_application(
        db=db,
        user_id=req.sender_id,
        request_id=req.id,
        carrier_name=current_user.full_name,
        lang=lang,
    )

    await db.commit()
    await db.refresh(app)
    return _enrich_application(app, current_user, trip)


@router.get("/{request_id}/applications", response_model=list[ApplicationResponse])
async def list_applications(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(PackageRequest).where(PackageRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail=t("errors.not_found", lang))
    if req.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    apps_result = await db.execute(
        select(Application).where(Application.package_request_id == req.id)
        .order_by(Application.created_at.asc())
    )
    apps = apps_result.scalars().all()
    if not apps:
        return []
    carrier_ids = list({a.carrier_id for a in apps})
    trip_ids = list({a.trip_id for a in apps if a.trip_id})
    carriers_res = await db.execute(select(User).where(User.id.in_(carrier_ids)))
    carriers = {u.id: u for u in carriers_res.scalars().all()}
    trips_res = await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))
    trips_map = {t.id: t for t in trips_res.scalars().all()}
    enriched = []
    for app in apps:
        carrier = carriers.get(app.carrier_id)
        trip = trips_map.get(app.trip_id)
        enriched.append(_enrich_application(app, carrier, trip))
    return enriched


@router.post("/{request_id}/applications/{app_id}/accept", status_code=200)
async def accept_application(
    request_id: str,
    app_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    import secrets
    from datetime import timedelta

    result = await db.execute(select(PackageRequest).where(PackageRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req or req.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    app_result = await db.execute(select(Application).where(Application.id == app_id))
    app = app_result.scalar_one_or_none()
    if not app or app.package_request_id != req.id:
        raise HTTPException(status_code=404, detail=t("errors.not_found", lang))

    trip_result = await db.execute(select(Trip).where(Trip.id == app.trip_id))
    trip = trip_result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))

    # Refuser toutes les autres candidatures
    await db.execute(
        update(Application)
        .where(Application.package_request_id == req.id, Application.id != app.id)
        .values(status="refused")
    )
    app.status = "accepted"
    req.status = "matched"

    # Créer le package
    pkg = Package(
        sender_id=current_user.id,
        content_description=req.content_description,
        weight_kg=req.weight_kg,
        declared_value=req.declared_value or 0.0,
        photo_urls=req.photos,
    )
    db.add(pkg)
    await db.flush()

    # Calculer montant (15% commission expediteur + forfait dossier 1.5EUR ou 5EUR si urgent)
    from datetime import time as tclass, datetime as dtclass, timezone
    dep_time = trip.departure_time if hasattr(trip, 'departure_time') and trip.departure_time else tclass(0, 0)
    if isinstance(dep_time, str):
        h, m = dep_time.split(':')[:2]
        dep_time = tclass(int(h), int(m))
    dep_dt = dtclass.combine(trip.departure_date, dep_time).replace(tzinfo=timezone.utc)
    hours_until_dep = (dep_dt - dtclass.now(timezone.utc)).total_seconds() / 3600
    is_urgent = hours_until_dep <= settings.BOOKING_URGENT_THRESHOLD_HOURS
    flat_fee = settings.URGENT_FLAT_FEE if is_urgent else settings.BOOKING_FLAT_FEE
    transport = req.weight_kg * trip.price_per_kg
    amount = round(transport * (1 + settings.SERVICE_FEE_SENDER_PERCENT) + flat_fee, 2)

    # Creer booking en pending - l'expediteur doit payer
    booking = Booking(
        trip_id=trip.id,
        package_id=pkg.id,
        sender_id=current_user.id,
        amount=amount,
        status="pending",
        package_request_id=req.id,
        is_urgent=is_urgent,
        booking_flat_fee_amount=flat_fee,
    )
    db.add(booking)
    await db.flush()

    # Résoudre le récepteur après flush (booking.id disponible en DB)
    from app.api.v1.endpoints.bookings import find_or_invite_receiver
    receiver_id = await find_or_invite_receiver(
        req.receiver_email_or_phone, current_user.id, booking.id,
        db, current_user, trip, pkg,
    )
    if receiver_id:
        booking.receiver_id = receiver_id

    # Déduire kg du trip
    trip.remaining_kg -= req.weight_kg
    if trip.remaining_kg <= 0:
        trip.status = "full"

    await db.flush()
    return {"booking_id": str(booking.id), "amount": amount, "trip_id": str(trip.id)}


def _enrich_request(req: PackageRequest, sender: User | None, apps_count: int, has_applied: bool = False) -> dict:
    return {
        "id": req.id,
        "sender_id": req.sender_id,
        "origin_city": req.origin_city,
        "origin_airport_code": req.origin_airport_code,
        "destination_city": req.destination_city,
        "destination_airport_code": req.destination_airport_code,
        "content_description": req.content_description,
        "weight_kg": req.weight_kg,
        "declared_value": req.declared_value,
        "budget_per_kg": req.budget_per_kg,
        "photos": req.photos or [],
        "receiver_email_or_phone": req.receiver_email_or_phone,
        "deadline_date": req.deadline_date,
        "status": req.status,
        "created_at": req.created_at,
        "sender_first_name": sender.first_name if sender else None,
        "sender_last_name": sender.last_name if sender else None,
        "sender_trust_score": sender.trust_score if sender else None,
        "applications_count": apps_count,
        "has_applied": has_applied,
    }


def _enrich_application(app: Application, carrier: User | None, trip: Trip | None) -> dict:
    return {
        "id": app.id,
        "package_request_id": app.package_request_id,
        "carrier_id": app.carrier_id,
        "trip_id": app.trip_id,
        "status": app.status,
        "created_at": app.created_at,
        "carrier_first_name": carrier.first_name if carrier else None,
        "carrier_last_name": carrier.last_name if carrier else None,
        "carrier_trust_score": carrier.trust_score if carrier else None,
        "carrier_kyc_status": carrier.kyc_status if carrier else None,
        "trip_departure_date": trip.departure_date if trip else None,
        "trip_price_per_kg": trip.price_per_kg if trip else None,
        "trip_flight_number": trip.flight_number if trip else None,
    }


@router.delete("/{request_id}", status_code=204)
async def delete_request(
    request_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Soft delete d'une annonce expéditeur — tous statuts autorisés."""
    result = await db.execute(
        select(PackageRequest).where(PackageRequest.id == request_id)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail=t("errors.request_not_found", lang))
    if req.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    req.deleted_at = datetime.now(timezone.utc)
    req.status = "cancelled"
    await db.commit()
