from app.core.rate_limit import limiter
from fastapi import UploadFile, File, APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from datetime import datetime, timezone, timedelta, date
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.trip import Trip
from app.models.package import Package
from app.models.booking import Booking
from app.models.receiver_invitation import ReceiverInvitation
from app.schemas.booking import BookingCreate, BookingResponse, BookingDetailResponse, BookingUpdate
from app.schemas.delivery import MeetingDateRequest, PickupCodeResponse, ValidatePickupRequest
from app.services.delivery_service import generate_and_hash_code, verify_code
from app.i18n.loader import t
from app.services.notification_service import notify_booking_received, notify_booking_accepted, notify_delivery_confirmed, notify_delivery_code
from app.services.resend_service import send_receiver_invitation
from app.services.notif_db_service import (
    notify_booking_received_db,
    notify_booking_accepted_db,
    notify_booking_refused_db,
    notify_in_transit_db,
    notify_booking_cancelled_by_sender_db,
    notify_booking_cancelled_by_carrier_db,
    create_notification,
)

class CancelPayload(BaseModel):
    reason: str = ""

class ReasonPayload(BaseModel):
    reason: str

router = APIRouter(prefix="/bookings", tags=["bookings"])

BOOKING_TERMINAL_STATUSES = {
    "delivered", "cancelled", "cancelled_by_sender",
    "cancelled_by_carrier", "refused", "expired", "kyc_expired",
}
from app.services.stripe_service import settle_cancellation_refund



async def find_or_invite_receiver(
    contact: str, sender_id: uuid.UUID, booking_id: uuid.UUID,
    db: AsyncSession, sender: User, trip: "Trip", pkg: "Package",
) -> uuid.UUID | None:
    # Optimisé : Recherche combinée par email OU téléphone en une seule passe
    result = await db.execute(
        select(User).where(or_(User.email == contact, User.phone == contact))
    )
    user = result.scalar_one_or_none()
    if user:
        return user.id
    token = ReceiverInvitation.generate_token()
    invitation = ReceiverInvitation(
        booking_id=booking_id,
        sender_id=sender_id,
        contact=contact,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(invitation)
    # Envoi email lien magique (best-effort, ne bloque pas le booking)
    try:
        await send_receiver_invitation(
            to_email=contact,
            receiver_first_name=contact.split("@")[0].capitalize(),
            sender_full_name=sender.full_name,
            origin=trip.origin_airport_code,
            destination=trip.destination_airport_code,
            content_description=pkg.content_description,
            token=token,
            temp_password=None,
            lang=sender.language,
        )
    except Exception as e:
        print(f"[RESEND] Erreur envoi invitation: {e}")
    return None


@router.post("", response_model=BookingResponse, status_code=201)
@limiter.limit("5/minute")
async def create_booking(
    request: Request,
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    import os
    _kyc_ok = os.environ.get("ENVIRONMENT") == "test" or current_user.kyc_status == "approved"
    from app.api.v1.endpoints.premium import is_premium_active
    from sqlalchemy import func
    if not is_premium_active(current_user):
        active_count_result = await db.execute(
            select(func.count()).where(
                Booking.sender_id == current_user.id,
                Booking.status.in_(["pending", "pending_kyc", "accepted", "paid", "in_transit"]),
            )
        )
        if active_count_result.scalar() >= 3:
            raise HTTPException(status_code=403, detail=t("errors.premium_booking_limit", lang))

    result = await db.execute(select(Trip).where(Trip.id == payload.trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))
    # Determination du type de colis
    is_small = payload.weight_kg < settings.SMALL_PACKAGE_MAX_KG

    # Verification du statut du trajet
    if trip.status == "full":
        # Trajet complet (kg epuises) : n'accepte plus que les petits colis
        if not (is_small and trip.has_small_package):
            raise HTTPException(status_code=400, detail=t("errors.trip_full_small_only", lang))
    elif trip.status != "open":
        raise HTTPException(status_code=400, detail=t("errors.trip_not_open", lang))

    # Empêche l'auto-expédition
    if trip.carrier_id == current_user.id:
        raise HTTPException(status_code=400, detail=t("errors.carrier_cannot_send", lang))
    if payload.receiver_email_or_phone in (current_user.email, current_user.phone):
        raise HTTPException(status_code=400, detail=t("errors.cannot_send_to_self", lang))

    # Regle delai minimum avant depart
    from datetime import date as dclass, time as tclass, datetime as dtclass, timezone as tz
    dep_time = trip.departure_time if hasattr(trip, 'departure_time') and trip.departure_time else tclass(0, 0)
    if isinstance(dep_time, str):
        h, m = dep_time.split(':')[:2]
        dep_time = tclass(int(h), int(m))
    dep_dt = dtclass.combine(trip.departure_date, dep_time).replace(tzinfo=tz.utc)
    hours_until_dep = (dep_dt - dtclass.now(tz.utc)).total_seconds() / 3600
    is_urgent = hours_until_dep <= settings.BOOKING_URGENT_THRESHOLD_HOURS
    if is_urgent and not trip.accepts_urgent:
        raise HTTPException(status_code=400, detail=t("errors.trip_not_urgent", lang))
    if hours_until_dep <= settings.BOOKING_MIN_HOURS_BEFORE_DEPARTURE:
        raise HTTPException(status_code=400, detail=t("errors.trip_too_close", lang))

    # Calcul prix selon type de colis
    if is_small:
        if not trip.has_small_package:
            raise HTTPException(status_code=400, detail=t("errors.trip_no_small_package", lang))
        # Petit colis : forfait fixe (prix transporteur + part KIPAR)
        from app.services.pricing_service import compute_small_amount
        _pricing = compute_small_amount(trip.small_package_price)
        flat_fee = _pricing["flat_fee"]
        base_amount = _pricing["base"]
        amount = _pricing["total"]
    else:
        if not trip.has_kg_capacity:
            raise HTTPException(status_code=400, detail=t("errors.trip_small_package_only", lang))
        # Colis au kg : verifications de capacite
        if payload.weight_kg > trip.remaining_kg:
            raise HTTPException(status_code=400, detail=t(
                "errors.weight_exceeds_capacity", lang,
                requested=payload.weight_kg, available=trip.remaining_kg
            ))
        if payload.weight_kg > trip.max_kg_per_package:
            raise HTTPException(status_code=400, detail=t(
                "errors.weight_exceeds_max", lang, max=trip.max_kg_per_package
            ))
        from app.services.pricing_service import compute_kg_amount
        _pricing = compute_kg_amount(payload.weight_kg, trip.price_per_kg, is_urgent)
        flat_fee = _pricing["flat_fee"]
        base_amount = _pricing["base"]
        amount = _pricing["total"]
    package = Package(
        sender_id=current_user.id,
        weight_kg=payload.weight_kg,
        content_description=payload.content_description,
        declared_value=payload.declared_value,
        photo_urls=payload.photos or [],
    )
    db.add(package)
    await db.flush()

    booking = Booking(
        trip_id=trip.id,
        package_id=package.id,
        sender_id=current_user.id,
        amount=amount,
        insurance_subscribed=payload.insurance_subscribed,
        reminder_hours=payload.reminder_hours,
        status="pending",
        is_urgent=is_urgent,
        package_mode='small' if is_small else 'kg',
        booking_flat_fee_amount=flat_fee,
        base_amount=base_amount,
    )
    db.add(booking)
    await db.flush()

    receiver_id = await find_or_invite_receiver(
        payload.receiver_email_or_phone, current_user.id, booking.id,
        db, current_user, trip, package,
    )
    if receiver_id:
        booking.receiver_id = receiver_id
        package.receiver_id = receiver_id
    else:
        booking.status = "awaiting_receiver"

    if not _kyc_ok:
        booking.status = "pending_kyc"
        booking.pending_kyc_expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.PENDING_KYC_TTL_HOURS)
        if not is_small:
            trip.remaining_kg = max(0.0, trip.remaining_kg - payload.weight_kg)
            if trip.remaining_kg <= 0:
                trip.status = "full"
            booking.kg_held = True
        return booking

    return booking


@router.patch("/{booking_id}/accept", response_model=BookingResponse)
async def accept_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    # OPTIMISÉ : Jointure Booking + Trip immédiate pour diviser les requêtes par deux
    row_result = await db.execute(
        select(Booking, Trip)
        .join(Trip, Booking.trip_id == Trip.id)
        .where(Booking.id == booking_id)
    )
    row = row_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    booking, trip = row
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status != "paid":
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    # Capture Stripe si paiement en escrow
    if booking.escrow_ref and booking.payment_rail == "stripe":
        from app.services.stripe_service import capture_payment_intent
        captured = await capture_payment_intent(booking.escrow_ref)
        if not captured:
            raise HTTPException(status_code=400, detail=t("errors.payment_capture_failed", lang))

    # Récupère le poids réel depuis le package
    pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
    pkg = pkg_result.scalar_one_or_none()
    weight = pkg.weight_kg if pkg else round(booking.amount / (trip.price_per_kg * (1 + settings.SERVICE_FEE_SENDER_PERCENT)), 3)
    if not booking.kg_held:
        trip.remaining_kg = max(0.0, trip.remaining_kg - weight)
        if trip.remaining_kg <= 0:
            trip.status = "full"
        booking.kg_held = True

    booking.status = "accepted"
    booking.accepted_at = datetime.now(timezone.utc)
    # Heriter weight_unit et currency du trip
    booking.weight_unit = trip.weight_unit if trip else "kg"
    booking.currency = trip.currency if trip else "EUR"
    # Assurance optionnelle - si souscrite et feature activee
    if booking.insurance_subscribed and settings.INSURANCE_ENABLED:
        from app.models.insurance import Insurance
        declared_value = getattr(booking, "declared_value", booking.amount)
        premium = max(
            declared_value * settings.INSURANCE_RATE_DEFAULT,
            declared_value * settings.INSURANCE_RATE_MIN
        )
        insurance = Insurance(
            booking_id=booking.id,
            user_id=booking.sender_id,
            declared_value=declared_value,
            rate=settings.INSURANCE_RATE_DEFAULT,
            premium=premium,
            is_self_covered=declared_value <= settings.INSURANCE_SELF_COVER_MAX,
        )
        db.add(insurance)
        print(f"[INSURANCE] Assurance souscrite booking {booking.id} prime={premium:.2f}EUR")
    elif booking.insurance_subscribed and not settings.INSURANCE_ENABLED:
        # Feature desactivee - ignorer silencieusement
        booking.insurance_subscribed = False
    # Forfait dossier 1.50EUR - acquis definitvement a la confirmation
    booking.booking_fee_collected = True
    print(f"[ESCROW] Forfait dossier {settings.BOOKING_FLAT_FEE}EUR preleve booking {booking.id}")
    # TODO Sprint 4 : prelevement reel Stripe/Flutterwave

    # Notifie le récepteur que la réservation est acceptée
    if booking.receiver_id:
        recv_result = await db.execute(select(User).where(User.id == booking.receiver_id))
        receiver = recv_result.scalar_one_or_none()
        if receiver:
            try:
                await notify_delivery_code(
                    receiver_fcm_token=receiver.fcm_token,
                    receiver_phone=receiver.phone,
                    receiver_email=receiver.email,
                    code=booking.delivery_code_plain or "",
                    carrier_name=current_user.full_name,
                    flight_number=trip.flight_number,
                    lang=receiver.language,
                )
            except Exception as e:
                print(f"[NOTIF] Erreur code remise: {e}")

    # Notifie l'expéditeur
    result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender = result.scalar_one_or_none()
    await notify_booking_accepted(
        sender_fcm_token=sender.fcm_token,
        sender_phone=sender.phone,
        sender_email=sender.email,
        lang=sender.language,
        notify_email=sender.notify_by_email,
        notify_push=sender.notify_by_push,
        notify_sms=sender.notify_by_sms,
    )

    await notify_booking_accepted_db(
        db=db,
        sender_id=sender.id,
        booking_id=booking.id,
        lang=sender.language or "fr",
    )

    return booking


@router.patch("/{booking_id}/refuse", response_model=BookingResponse)
async def refuse_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    # OPTIMISÉ : Jointure Booking + Trip immédiate pour diviser les requêtes par deux
    row_result = await db.execute(
        select(Booking, Trip)
        .join(Trip, Booking.trip_id == Trip.id)
        .where(Booking.id == booking_id)
    )
    row = row_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    booking, trip = row
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("pending", "awaiting_receiver", "paid"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    # Remboursement 100% quel que soit le statut (paid/pending/awaiting_receiver)
    if booking.escrow_ref and booking.payment_rail == "stripe":
        import stripe
        from app.core.config import settings
        from app.services.stripe_service import cancel_payment_intent
        if not booking.escrow_ref.startswith("pi_simulated") and settings.STRIPE_SECRET_KEY:
            try:
                pi = stripe.PaymentIntent.retrieve(booking.escrow_ref)
                if pi.status == "succeeded":
                    # Charge capturee - remboursement integral
                    stripe.Refund.create(
                        payment_intent=booking.escrow_ref,
                        amount=int(booking.amount * 100),
                    )
                elif pi.status in ("requires_capture", "requires_confirmation", "requires_payment_method"):
                    # Autorisation non capturee (hold) - on annule pour liberer le hold
                    await cancel_payment_intent(booking.escrow_ref)
                # si deja canceled : rien a faire
            except stripe.StripeError as e:
                raise HTTPException(status_code=400, detail=str(e))
        booking.booking_fee_collected = False

    booking.status = "refused"
    sender_ref_result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender_ref = sender_ref_result.scalar_one_or_none()
    if sender_ref:
        await notify_booking_refused_db(
            db=db,
            sender_id=sender_ref.id,
            booking_id=booking.id,
            lang=sender_ref.language or "fr",
        )
    return booking


@router.get("", response_model=list[BookingResponse])
async def list_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste toutes les réservations de l'utilisateur connecté (expéditeur ou récepteur)."""
    from sqlalchemy import or_
    result = await db.execute(
        select(Booking)
        .where(or_(
            Booking.sender_id == current_user.id,
            Booking.receiver_id == current_user.id,
        ))
        .where(Booking.deleted_at.is_(None))
        .order_by(Booking.created_at.desc())
    )
    return result.scalars().all()

@router.get("/carrier", response_model=list[BookingResponse])
async def list_carrier_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste les réservations des trajets dont l'utilisateur est transporteur."""
    from app.models.package import Package
    # Récupère tous les trajets du transporteur
    trips_result = await db.execute(
        select(Trip).where(Trip.carrier_id == current_user.id)
    )
    trips = trips_result.scalars().all()
    trip_ids = [t.id for t in trips]
    if not trip_ids:
        return []
    # Récupère toutes les réservations de ces trajets
    bookings_result = await db.execute(
        select(Booking)
        .where(Booking.trip_id.in_(trip_ids))
        .order_by(Booking.created_at.desc())
    )
    bookings = bookings_result.scalars().all()
    if not bookings:
        return []
    pkg_ids = [b.package_id for b in bookings]
    pkgs_result = await db.execute(select(Package).where(Package.id.in_(pkg_ids)))
    pkgs = {p.id: p for p in pkgs_result.scalars().all()}
    responses = []
    for b in bookings:
        pkg = pkgs.get(b.package_id)
        _ad = None
        if b.status == "paid" and b.paid_at:
            _ttl = settings.CARRIER_ACCEPT_TTL_URGENT_HOURS if b.is_urgent else settings.CARRIER_ACCEPT_TTL_HOURS
            _ad = b.paid_at + timedelta(hours=_ttl)
        responses.append(BookingResponse(
            id=b.id,
            trip_id=b.trip_id,
            package_id=b.package_id,
            sender_id=b.sender_id,
            receiver_id=b.receiver_id,
            amount=b.amount,
            insurance_subscribed=b.insurance_subscribed,
            status=b.status,
            payment_rail=b.payment_rail,
            weight_kg=pkg.weight_kg if pkg else None,
            content_description=pkg.content_description if pkg else None,
            declared_value=pkg.declared_value if pkg else None,
            is_urgent=b.is_urgent,
            booking_flat_fee_amount=b.booking_flat_fee_amount,
            base_amount=b.base_amount,
            currency=b.currency,
            weight_unit=b.weight_unit,
            package_mode=b.package_mode,
            acceptance_deadline=_ad,
        ))
    return responses


@router.get("/detail")
async def list_my_bookings_detailed(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    origin: str | None = None,
    destination: str | None = None,
    include_terminal: bool = False,
):
    """Liste enrichie avec les données du package, paginée et filtrable."""
    from app.models.package import Package
    base = select(Booking).where(or_(
        Booking.sender_id == current_user.id,
        Booking.receiver_id == current_user.id,
    ))
    if status:
        base = base.where(Booking.status == status)
    if not include_terminal and not status:
        base = base.where(Booking.status.not_in(BOOKING_TERMINAL_STATUSES))
    if date_from:
        base = base.where(func.date(Booking.created_at) >= date_from)
    if date_to:
        base = base.where(func.date(Booking.created_at) <= date_to)
    if origin or destination:
        base = base.join(Trip, Booking.trip_id == Trip.id)
        if origin:
            base = base.where(Trip.origin_airport_code.ilike(f"%{origin.upper()}%"))
        if destination:
            base = base.where(Trip.destination_airport_code.ilike(f"%{destination.upper()}%"))
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    result = await db.execute(
        base.order_by(Booking.created_at.desc()).limit(limit).offset(offset)
    )
    bookings = result.scalars().all()
    if not bookings:
        return {"items": [], "total": total or 0}
    pkg_ids = [b.package_id for b in bookings]
    pkgs_result = await db.execute(select(Package).where(Package.id.in_(pkg_ids)))
    pkgs = {p.id: p for p in pkgs_result.scalars().all()}
    trip_ids = [b.trip_id for b in bookings]
    trips_result = await db.execute(select(Trip).where(Trip.id.in_(trip_ids)))
    trips = {tr.id: tr for tr in trips_result.scalars().all()}
    responses = []
    for b in bookings:
        pkg = pkgs.get(b.package_id)
        tr = trips.get(b.trip_id)
        _pd = None
        if b.status == "pending":
            _base_dt = b.promoted_at or b.created_at
            if _base_dt:
                _pd = _base_dt + timedelta(hours=settings.PENDING_BOOKING_TTL_HOURS)
        responses.append(BookingResponse(
            id=b.id,
            trip_id=b.trip_id,
            package_id=b.package_id,
            sender_id=b.sender_id,
            receiver_id=b.receiver_id,
            amount=b.amount,
            insurance_subscribed=b.insurance_subscribed,
            status=b.status,
            payment_rail=b.payment_rail,
            weight_kg=pkg.weight_kg if pkg else None,
            content_description=pkg.content_description if pkg else None,
            declared_value=pkg.declared_value if pkg else None,
            is_urgent=b.is_urgent,
            booking_flat_fee_amount=b.booking_flat_fee_amount,
            base_amount=b.base_amount,
            currency=b.currency,
            weight_unit=b.weight_unit,
            package_mode=b.package_mode,
            payment_deadline=_pd,
            origin_airport_code=tr.origin_airport_code if tr else None,
            destination_airport_code=tr.destination_airport_code if tr else None,
        ))
    return {"items": responses, "total": total or 0}


@router.get("/{booking_id}/full", response_model=BookingDetailResponse)
async def get_booking_full(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Détail complet d'une réservation — transporteur, récepteur, colis, KiparScan."""
    from app.models.package import Package
    from app.models.trip import Trip
    from app.schemas.booking import BookingDetailResponse

    # REQUÊTE 1 : Fusion immédiate du Booking et du Trip (Évite 2 requêtes séparées)
    row_result = await db.execute(
        select(Booking, Trip)
        .join(Trip, Booking.trip_id == Trip.id)
        .where(Booking.id == booking_id)
    )
    row = row_result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    b, trip = row

    if current_user.id not in (b.sender_id, b.receiver_id, trip.carrier_id):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    # REQUÊTE 2 : Récupération du Package
    pkg_result = await db.execute(select(Package).where(Package.id == b.package_id))
    pkg = pkg_result.scalar_one_or_none()

    # REQUÊTE 3 : Chargement BATCH de tous les profils utilisateurs en un seul coup
    user_ids = [uid for uid in [b.sender_id, b.receiver_id, trip.carrier_id] if uid]
    users_map = {}
    if user_ids:
        users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in users_res.scalars().all()}

    sender = users_map.get(b.sender_id)
    receiver = users_map.get(b.receiver_id)
    carrier = users_map.get(trip.carrier_id)

    receiver_contact = (receiver.email or receiver.phone) if receiver else None
    if not receiver_contact:
        _inv = (await db.execute(
            select(ReceiverInvitation).where(ReceiverInvitation.booking_id == b.id)
        )).scalars().first()
        if _inv:
            receiver_contact = _inv.contact

    return BookingDetailResponse(
        id=b.id, trip_id=b.trip_id, package_id=b.package_id,
        sender_id=b.sender_id, receiver_id=b.receiver_id,
        amount=b.amount, insurance_subscribed=b.insurance_subscribed,
        status=b.status, payment_rail=b.payment_rail,
        weight_kg=pkg.weight_kg if pkg else None,
        content_description=pkg.content_description if pkg else None,
        declared_value=pkg.declared_value if pkg else None,
        is_urgent=b.is_urgent,
        booking_flat_fee_amount=b.booking_flat_fee_amount,
        base_amount=b.base_amount,
        currency=b.currency,
        weight_unit=b.weight_unit,
        package_mode=b.package_mode,
        ai_scan_result=pkg.ai_scan_result if pkg else None,
        ai_prohibited_flag=pkg.ai_prohibited_flag if pkg else None,
        origin_airport_code=trip.origin_airport_code if trip else None,
        destination_airport_code=trip.destination_airport_code if trip else None,
        departure_date=str(trip.departure_date) if trip else None,
        departure_time=trip.departure_time if trip else None,
        arrival_date=str(trip.arrival_date) if trip and trip.arrival_date else None,
        arrival_time=trip.arrival_time if trip else None,
        flight_number=trip.flight_number if trip else None,
        carrier_id=trip.carrier_id if trip else None,
        carrier_first_name=carrier.first_name if carrier else None,
        carrier_last_name=carrier.last_name if carrier else None,
        carrier_trust_score=carrier.trust_score if carrier else None,
        carrier_kyc_status=carrier.kyc_status if carrier else None,
        receiver_first_name=receiver.first_name if receiver else None,
        receiver_last_name=receiver.last_name if receiver else None,
        receiver_email=receiver.email if receiver else None,
        receiver_email_or_phone=receiver_contact,
        sender_first_name=sender.first_name if sender else None,
        sender_last_name=sender.last_name if sender else None,
        sender_email=sender.email if sender else None,
        cancellation_reason=b.cancellation_reason,
        photo_urls=pkg.photo_urls if pkg else None,
        # Pickup
        pickup_meeting_date=b.pickup_meeting_date.isoformat() if b.pickup_meeting_date else None,
        proposed_pickup_date=b.proposed_pickup_date.isoformat() if b.proposed_pickup_date else None,
        proposed_pickup_by=str(b.proposed_pickup_by) if b.proposed_pickup_by else None,
        pickup_reschedule_count=b.pickup_reschedule_count or 0,
        pickup_meeting_confirmed_by_sender=b.pickup_meeting_confirmed_by_sender or False,
        pickup_meeting_confirmed_by_carrier=b.pickup_meeting_confirmed_by_carrier or False,
        pickup_code_plain=b.pickup_code_plain,
        pickup_qr_token=b.pickup_qr_token,
        # Delivery
        delivery_meeting_date=b.delivery_meeting_date.isoformat() if b.delivery_meeting_date else None,
        proposed_delivery_date=b.proposed_delivery_date.isoformat() if b.proposed_delivery_date else None,
        proposed_delivery_by=str(b.proposed_delivery_by) if b.proposed_delivery_by else None,
        delivery_reschedule_count=b.delivery_reschedule_count or 0,
        delivery_alternative_proof_url=b.delivery_alternative_proof_url,
        reminder_hours=b.reminder_hours,
    )


@router.patch("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: str,
    payload: CancelPayload = CancelPayload(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Annulation par l'expéditeur ou le transporteur."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()

    is_sender = booking.sender_id == current_user.id
    is_carrier = trip and trip.carrier_id == current_user.id

    if not is_sender and not is_carrier:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if is_sender and booking.status not in ("pending", "pending_kyc", "awaiting_receiver", "paid", "accepted"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))
    if is_carrier and booking.status not in ("accepted",):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))


    import stripe as stripe_lib
    from datetime import date as dclass
    from app.core.config import settings as s
    # C4 bareme annulation : forfait mode-aware (small = 5EUR, kg = forfait du booking)
    if booking.package_mode == "small":
        FLAT_FEE = s.SMALL_PACKAGE_KIPAR_FEE
    else:
        FLAT_FEE = booking.booking_flat_fee_amount or s.BOOKING_FLAT_FEE

    refund_amount = 0.0
    carrier_amount = 0.0

    if is_sender:
        original_status = booking.status
        booking.status = "cancelled_by_sender"
        if original_status in ("pending", "awaiting_receiver") or not booking.escrow_ref:
            # Pas encore paye - rien a rembourser
            refund_amount = 0.0
        elif booking.cancellation_justified:
            # Force majeure (flag admin) -> remboursement 100%
            refund_amount = booking.amount
        elif booking.accepted_at and trip and trip.departure_date:
            if original_status in ("paid",):
                # Statut paid -> remboursement 100% toujours
                refund_amount = booking.amount
            elif booking.is_urgent:
                # Urgence : regles specifiques independantes du delai
                # Expediteur annule -> rembourse montant - 10EUR (6 carrier + 4 kipar)
                refund_amount = round(booking.amount - settings.URGENT_FLAT_FEE, 2)
                carrier_amount = settings.URGENT_FEE_CARRIER
            else:
                # Classique : tableau 72h/24h
                hours_until = (trip.departure_date - dclass.today()).days * 24
                if hours_until >= s.LATE_CANCEL_HOURS:
                    # accepted >= 72h -> remboursement montant - 1.50EUR
                    refund_amount = round(booking.amount - FLAT_FEE, 2)
                    carrier_amount = 0.0
                elif hours_until > s.SENDER_CANCEL_MID_HOURS:
                    # accepted <72h et >24h -> exp 50%, tra 25%, kipar 25% + 1.50EUR
                    base = round(booking.amount - FLAT_FEE, 2)
                    refund_amount = round(base * s.SENDER_CANCEL_MID_REFUND_PERCENT, 2)
                    carrier_amount = round(base * s.SENDER_CANCEL_MID_CARRIER_PERCENT, 2)
                else:
                    # accepted <=24h -> exp 0%, tra 83% de la base, kipar 17% + forfait
                    refund_amount = 0.0
                    _base_late = round(booking.amount - FLAT_FEE, 2)
                    carrier_amount = round(_base_late * s.SENDER_CANCEL_LATE_CARRIER_PERCENT, 2)
        else:
            refund_amount = booking.amount

        # Remboursement Stripe expediteur (selon etat reel du PaymentIntent)
        if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and s.STRIPE_SECRET_KEY:
            carrier_acct = None
            if carrier_amount > 0 and trip:
                carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
                carrier_u = carrier_r.scalar_one_or_none()
                carrier_acct = carrier_u.stripe_account_id if carrier_u else None
            try:
                await settle_cancellation_refund(booking.escrow_ref, refund_amount, carrier_amount, carrier_acct, booking_id)
            except stripe_lib.StripeError as e:
                raise HTTPException(status_code=400, detail=str(e))

        print(f"[ESCROW] Annulation expediteur booking {booking_id} - remboursement {refund_amount:.2f}EUR transporteur {carrier_amount:.2f}EUR")

    else:
        # Transporteur -> remboursement 100% expediteur + pending_review
        booking.status = "cancelled_by_carrier"
        booking.cancellation_review_status = "pending_review"
        booking.carrier_penalty_due = s.CARRIER_CANCEL_FEE_MIN  # 5.0EUR par defaut
        # Annulation par le transporteur -> remboursement 100% expediteur (urgent comme classique)
        refund_amount = booking.amount

        # Remboursement immediat expediteur (selon etat reel du PaymentIntent)
        if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and s.STRIPE_SECRET_KEY:
            try:
                await settle_cancellation_refund(booking.escrow_ref, refund_amount, 0.0, None, booking_id)
            except stripe_lib.StripeError as e:
                raise HTTPException(status_code=400, detail=str(e))

        print(f"[ESCROW] Annulation transporteur booking {booking_id} - remboursement 100% expediteur - pending_review")

    if payload.reason:
        booking.cancellation_reason = payload.reason

    # Restituer les kg au trip
    if trip:
        pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
        pkg = pkg_result.scalar_one_or_none()
        if pkg and booking.kg_held:
            trip.remaining_kg += pkg.weight_kg
            if trip.status == "full":
                trip.status = "open"
            booking.kg_held = False

    # Reouverture annonce (booking issu d'une candidature)
    if booking.package_request_id:
        from app.models.package_request import PackageRequest, Application
        _req = (await db.execute(select(PackageRequest).where(PackageRequest.id == booking.package_request_id))).scalar_one_or_none()
        if _req and _req.status == "matched":
            _req.status = "open"
        _apps = (await db.execute(select(Application).where(
            Application.package_request_id == booking.package_request_id,
            Application.status == "accepted",
        ))).scalars().all()
        for _app in _apps:
            _app.status = "refused"

    await db.commit()

    # Notifications annulation
    carrier_result = await db.execute(select(User).where(User.id == trip.carrier_id)) if trip else None
    carrier_notif = carrier_result.scalar_one_or_none() if carrier_result else None
    sender_result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender_notif = sender_result.scalar_one_or_none()

    if is_sender and carrier_notif:
        await notify_booking_cancelled_by_sender_db(
            db=db,
            carrier_id=carrier_notif.id,
            booking_id=booking.id,
            lang=carrier_notif.language or "fr",
        )
        await db.commit()
    elif is_carrier and sender_notif:
        await notify_booking_cancelled_by_carrier_db(
            db=db,
            sender_id=sender_notif.id,
            receiver_id=booking.receiver_id,
            booking_id=booking.id,
            lang=sender_notif.language or "fr",
        )
        await db.commit()

    return {"status": booking.status, "refund_amount": refund_amount, "carrier_amount": carrier_amount, "amount": booking.amount}

@router.patch("/{booking_id}")
async def update_booking(
    booking_id: str,
    payload: BookingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Modifier une reservation PENDING (poids, description, valeur, assurance).
    Recalcule le prix et reajuste les kg tenus si le poids change."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("pending", "pending_kyc", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail=t("errors.booking_not_editable", lang))

    trip = (await db.execute(select(Trip).where(Trip.id == booking.trip_id))).scalar_one_or_none()
    pkg = (await db.execute(select(Package).where(Package.id == booking.package_id))).scalar_one_or_none()
    if not trip or not pkg:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    # Valeurs cibles (payload ou conservees)
    new_weight = payload.weight_kg if payload.weight_kg is not None else pkg.weight_kg
    new_desc = payload.content_description if payload.content_description is not None else pkg.content_description
    new_value = payload.declared_value if payload.declared_value is not None else pkg.declared_value
    new_ins = payload.insurance_subscribed if payload.insurance_subscribed is not None else booking.insurance_subscribed
    new_is_small = new_weight < settings.SMALL_PACKAGE_MAX_KG

    # Etat initial : le booking tenait-il deja des kg ?
    was_held = booking.kg_held
    # Liberer les kg actuellement tenus (avant revalidation)
    if was_held:
        trip.remaining_kg += pkg.weight_kg
        if trip.status == "full":
            trip.status = "open"
        booking.kg_held = False

    # Recalcul prix + revalidation capacite
    if new_is_small:
        if not trip.has_small_package:
            raise HTTPException(status_code=400, detail=t("errors.trip_no_small_package", lang))
        from app.services.pricing_service import compute_small_amount
        _pricing = compute_small_amount(trip.small_package_price)
        booking.kg_held = False
    else:
        if new_weight > trip.remaining_kg:
            raise HTTPException(status_code=400, detail=t(
                "errors.weight_exceeds_capacity", lang,
                requested=new_weight, available=trip.remaining_kg
            ))
        if new_weight > trip.max_kg_per_package:
            raise HTTPException(status_code=400, detail=t(
                "errors.weight_exceeds_max", lang, max=trip.max_kg_per_package
            ))
        from app.services.pricing_service import compute_kg_amount
        _pricing = compute_kg_amount(new_weight, trip.price_per_kg, booking.is_urgent)
        # Re-tenir les kg UNIQUEMENT si le booking les tenait deja
        if was_held:
            trip.remaining_kg -= new_weight
            if trip.remaining_kg <= 0:
                trip.status = "full"
            booking.kg_held = True

    # Mise a jour package + booking
    pkg.weight_kg = new_weight
    pkg.content_description = new_desc
    pkg.declared_value = new_value
    booking.amount = _pricing["total"]
    booking.base_amount = _pricing["base"]
    booking.booking_flat_fee_amount = _pricing["flat_fee"]
    booking.insurance_subscribed = new_ins
    booking.package_mode = 'small' if new_is_small else 'kg'
    await db.flush()

    return {
        "id": str(booking.id),
        "status": booking.status,
        "amount": booking.amount,
        "base_amount": booking.base_amount,
        "booking_flat_fee_amount": booking.booking_flat_fee_amount,
        "weight_kg": pkg.weight_kg,
        "package_mode": booking.package_mode,
    }


@router.patch("/{booking_id}/in-transit")
async def mark_in_transit(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Le transporteur confirme avoir récupéré le colis — passe à in_transit."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status not in ("accepted", "paid"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))
    if not booking.receiver_id:
        raise HTTPException(status_code=400, detail=t("errors.receiver_required_for_transit", lang))

    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()
    if not trip or trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    booking.status = "in_transit"
    sender_t_result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender_t = sender_t_result.scalar_one_or_none()
    await db.commit()
    if sender_t:
        await notify_in_transit_db(
            db=db,
            sender_id=booking.sender_id,
            receiver_id=booking.receiver_id,
            booking_id=booking.id,
            lang=sender_t.language or "fr",
        )
    return {"status": "in_transit"}

@router.patch("/{booking_id}/pickup-failed")
async def mark_pickup_failed(
    booking_id: str,
    payload: ReasonPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Declare un pickup_failed.
    - Transporteur : colis non pret / expediteur absent
    - Expediteur : transporteur absent
    Commentaire obligatoire. Horodatage serveur. Fenetre 48h pour justification.
    """
    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail=t("errors.reason_required", lang))

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status not in ("in_transit", "accepted", "paid"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()

    is_carrier = trip and trip.carrier_id == current_user.id
    is_sender = booking.sender_id == current_user.id
    if not is_carrier and not is_sender:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    booking.status = "pickup_failed"
    booking.pickup_failed_at = now
    booking.pickup_failed_reason = reason
    booking.pickup_failed_by = "carrier" if is_carrier else "sender"
    booking.incident_response_deadline = now + timedelta(hours=settings.INCIDENT_RESPONSE_HOURS)
    await db.commit()

    if is_carrier:
        await create_notification(
            db=db,
            user_id=booking.sender_id,
            type="pickup_failed",
            title="Colis non remis",
            body=f"Le transporteur signale que votre colis n'a pas pu etre remis : {reason}. Vous avez 48h pour contester.",
            link=f"/packages/{booking.id}",
        )
    else:
        result_carrier = await db.execute(select(User).where(User.id == trip.carrier_id))
        carrier = result_carrier.scalar_one_or_none()
        if carrier:
            await create_notification(
                db=db,
                user_id=carrier.id,
                type="pickup_failed",
                title="Pickup non effectue",
                body=f"L'expediteur signale que vous ne vous etes pas presente : {reason}. Vous avez 48h pour contester.",
                link=f"/carrier",
            )
    await db.commit()
    return {
        "status": "pickup_failed",
        "declared_by": booking.pickup_failed_by,
        "response_deadline": booking.incident_response_deadline.isoformat(),
    }


@router.patch("/{booking_id}/pickup-failed/respond")
async def respond_pickup_failed(
    booking_id: str,
    payload: ReasonPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """La partie mise en cause repond dans la fenetre de 48h.
    - Si contestation (payload.reason non vide) -> litige ouvert automatiquement.
    - Si acceptation (payload.reason = "accept") -> declarant favorise, remboursement.
    """
    from datetime import datetime, timezone
    from app.models.dispute import Dispute

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail=t("errors.reason_required", lang))

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "pickup_failed":
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    # Verifier que c'est bien la partie mise en cause qui repond
    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()
    is_carrier = trip and trip.carrier_id == current_user.id
    is_sender = booking.sender_id == current_user.id
    declared_by = booking.pickup_failed_by
    # La partie mise en cause est l'opposee du declarant
    if declared_by == "carrier" and not is_sender:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if declared_by == "sender" and not is_carrier:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    # Verifier que la fenetre 48h n'est pas expiree
    now = datetime.now(timezone.utc)
    if booking.incident_response_deadline and now > booking.incident_response_deadline:
        raise HTTPException(status_code=400, detail=t("errors.incident_response_expired", lang))

    if reason.lower() == "accept":
        # Acceptation -> declarant favorise, booking annule, remboursement
        booking.status = "cancelled"
        booking.cancellation_reason = f"pickup_failed_accepted_by_respondent"
        # C3c refund integral pickup accepte
        from app.core.config import settings as _cfg7
        if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and _cfg7.STRIPE_SECRET_KEY:
            try:
                await settle_cancellation_refund(booking.escrow_ref, booking.amount, 0.0, None, str(booking.id))
            except Exception as e:
                import logging
                logging.getLogger("kipar").error(f"[PICKUP_ACCEPTED] Refund booking {booking.id}: {e}")
        await db.commit()
        # Notifie le declarant
        notif_user_id = booking.sender_id if declared_by == "sender" else trip.carrier_id
        await create_notification(
            db=db,
            user_id=notif_user_id,
            type="pickup_failed_resolved",
            title="Incident resolu",
            body="L'autre partie a reconnu les faits. Le remboursement va etre traite.",
            link=f"/packages/{booking.id}",
        )
        await db.commit()
        return {"status": "cancelled", "resolution": "accepted_by_respondent"}
    else:
        # Contestation -> litige ouvert automatiquement
        existing = await db.execute(select(Dispute).where(Dispute.booking_id == booking.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=t("errors.dispute_already_exists", lang))
        booking.status = "disputed"
        dispute = Dispute(
            booking_id=booking.id,
            initiated_by=current_user.id,
            reason=f"Contestation pickup_failed : {reason}",
            status="open",
        )
        db.add(dispute)
        await db.commit()
        await create_notification(
            db=db,
            user_id=booking.sender_id,
            type="dispute_opened",
            title="Litige ouvert",
            body="La contestation a ete enregistree. L'equipe Kipar va examiner le dossier.",
            link=f"/packages/{booking.id}",
        )
        await db.commit()
        return {"status": "disputed", "dispute_id": str(dispute.id)}


async def confirm_pickup_failed(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """L'expediteur confirme que le colis n'a pas ete remis — annulation sans remboursement."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "pickup_failed":
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    booking.status = "cancelled"
    booking.cancellation_reason = "pickup_failed_confirmed"
    await db.commit()

    await create_notification(
        db=db,
        user_id=booking.sender_id,
        type="booking_cancelled",
        title="Réservation annulée",
        body="Vous avez confirmé la non-remise du colis. La réservation est annulée.",
        link=f"/packages/{booking.id}",
    )
    return {"status": "cancelled"}


@router.patch("/{booking_id}/dispute")
async def open_dispute(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    from app.models.dispute import Dispute
    from app.models.package import Package
    reason = (payload.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail=t("errors.reason_required", lang))
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()
    is_sender   = booking.sender_id == current_user.id
    is_carrier  = trip and trip.carrier_id == current_user.id
    is_receiver = booking.receiver_id == current_user.id
    if not is_sender and not is_carrier and not is_receiver:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("pickup_failed", "delivery_failed", "in_transit", "paid", "accepted", "delivered"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))
    existing = await db.execute(select(Dispute).where(Dispute.booking_id == booking.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=t("errors.dispute_already_exists", lang))
    pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
    pkg = pkg_result.scalar_one_or_none()
    declared_value = payload.get("declared_value") or (pkg.declared_value if pkg else None)
    role = "carrier" if is_carrier else "receiver" if is_receiver else "sender"
    booking.status = "disputed"
    dispute = Dispute(
        booking_id=booking.id,
        initiated_by=current_user.id,
        initiated_by_role=role,
        incident_type=payload.get("incident_type", "other"),
        incident_stage=payload.get("incident_stage", "delivery"),
        reason=reason,
        evidence_urls=payload.get("evidence_urls", []),
        declared_value=declared_value,
        has_insurance=booking.insurance_subscribed,
        status="open",
    )
    db.add(dispute)
    await db.commit()
    await db.refresh(dispute)
    await create_notification(
        db=db, user_id=booking.sender_id,
        type="dispute_opened", title="Litige ouvert",
        body="Un litige a ete ouvert. Notre equipe va examiner la situation.",
        link=f"/packages/{booking.id}",
    )
    if booking.insurance_subscribed and settings.INSURANCE_ENABLED:
        from app.services.resend_service import send_email
        try:
            html = ("<h2>Sinistre KIPAR</h2>"
                + "<p>Booking : " + str(booking.id) + "</p>"
                + "<p>Declarant : " + role + " - " + current_user.email + "</p>"
                + "<p>Type : " + dispute.incident_type + "</p>"
                + "<p>Motif : " + reason + "</p>"
                + "<p>Valeur declaree : " + str(declared_value) + " EUR</p>")
            await send_email(to="assureur@kipar.app",
                subject="Sinistre KIPAR " + str(booking.id)[:8], html=html)
            dispute.insurer_dossier_sent = True
            from datetime import datetime, timezone
            dispute.insurer_dossier_sent_at = datetime.now(timezone.utc)
            await db.commit()
        except Exception as e:
            print(f"[INSURER] Erreur envoi dossier: {e}")
    await db.commit()
    return {
        "status": "disputed", "dispute_id": str(dispute.id),
        "has_insurance": dispute.has_insurance,
        "insurer_notified": dispute.insurer_dossier_sent, "role": role,
    }

@router.post("/{booking_id}/pickup-meeting")
async def set_pickup_meeting(booking_id: str, payload: MeetingDateRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b or b.status != "accepted": raise HTTPException(400, "Statut invalide pour un RDV")
    t_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = t_res.scalar_one_or_none()
    if current_user.id not in (b.sender_id, trip.carrier_id): raise HTTPException(403)
    if trip.departure_date and trip.departure_time:
        dep_dt = datetime.combine(trip.departure_date, datetime.strptime(trip.departure_time, "%H:%M").time()).replace(tzinfo=timezone.utc)
        if payload.meeting_date.replace(tzinfo=timezone.utc) > dep_dt.replace(tzinfo=timezone.utc) - timedelta(hours=3): raise HTTPException(400, "Le RDV doit être au moins 3h avant le vol")
    b.pickup_meeting_date = payload.meeting_date
    await db.commit()
    return {"status": "success", "pickup_meeting_date": b.pickup_meeting_date}

@router.post("/{booking_id}/pickup/generate-code", response_model=PickupCodeResponse)
@limiter.limit("5/minute")
async def generate_pickup_code(request: Request, booking_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    if current_user.id != trip_res.scalar_one().carrier_id: raise HTTPException(403)
    code, hashed = generate_and_hash_code()
    b.pickup_code_hash = hashed
    b.pickup_code_plain = code
    await db.commit()
    return {"booking_id": b.id, "code": code}

@router.post("/{booking_id}/pickup/validate")
@limiter.limit("5/minute")
async def validate_pickup(request: Request, booking_id: str, payload: ValidatePickupRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if current_user.id != b.sender_id: raise HTTPException(403)
    if not b.pickup_code_hash or not verify_code(payload.code, b.pickup_code_hash): raise HTTPException(400, "Code invalide")
    b.status = "in_transit"
    b.pickup_code_plain = None
    await db.commit()
    return {"status": "in_transit"}

# ==========================================
# ROUTES : NÉGOCIATION DE COLLECTE (PING-PONG)
# ==========================================

@router.post("/{booking_id}/pickup/respond")
async def respond_pickup_meeting(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    if not booking.proposed_pickup_date:
        raise HTTPException(status_code=400, detail="Aucune proposition en attente")

    if str(booking.proposed_pickup_by) == str(current_user.id):
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas valider votre propre proposition")

    action = payload.get("action") # 'accept' ou 'refuse'
    
    if action == "accept":
        booking.pickup_meeting_date = booking.proposed_pickup_date
        booking.proposed_pickup_date = None
        booking.proposed_pickup_by = None
    elif action == "refuse":
        booking.proposed_pickup_date = None
        booking.proposed_pickup_by = None
    else:
        raise HTTPException(status_code=400, detail="Action invalide")

    await db.commit()
    return {"status": "success", "action": action}

# ==========================================
# ROUTES : NÉGOCIATION DE LIVRAISON (PING-PONG)
# ==========================================

@router.post("/{booking_id}/delivery/respond")
async def respond_delivery_meeting(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    if not booking.proposed_delivery_date:
        raise HTTPException(status_code=400, detail="Aucune proposition en attente")

    if str(booking.proposed_delivery_by) == str(current_user.id):
        raise HTTPException(status_code=403, detail="Vous ne pouvez pas valider votre propre proposition")

    action = payload.get("action")
    
    if action == "accept":
        booking.delivery_meeting_date = booking.proposed_delivery_date
        booking.proposed_delivery_date = None
        booking.proposed_delivery_by = None
    elif action == "refuse":
        booking.proposed_delivery_date = None
        booking.proposed_delivery_by = None
    else:
        raise HTTPException(status_code=400, detail="Action invalide")

    await db.commit()
    return {"status": "success", "action": action}


@router.delete("/{booking_id}", status_code=204)
async def delete_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Soft delete d'un booking par l'expediteur.
    Conditions : statut terminal + anciennete > 1 an."""
    from datetime import datetime, timezone, timedelta
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.deleted_at is not None:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    TERMINAL = {"cancelled", "cancelled_by_sender", "cancelled_by_carrier", "refused", "refunded", "delivered"}
    if booking.status not in TERMINAL:
        raise HTTPException(status_code=400, detail=t("errors.booking_not_deletable", lang))

    retention = timedelta(days=365)
    if datetime.now(timezone.utc) - booking.created_at < retention:
        raise HTTPException(status_code=400, detail=t("errors.booking_retention_period", lang))

    booking.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return None


@router.post("/{booking_id}/cancellation-evidence/signature")
async def get_cancellation_evidence_signature(
    booking_id: str,
    file_index: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Genere une signature Cloudinary pour uploader une preuve d'annulation."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()
    is_carrier = trip and trip.carrier_id == current_user.id
    if not is_carrier:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if file_index < 0 or file_index > 4:
        raise HTTPException(status_code=400, detail="file_index doit etre entre 0 et 4")
    from app.services.cloudinary_service import generate_evidence_upload_signature
    import uuid as uuid_mod
    return generate_evidence_upload_signature(uuid_mod.UUID(booking_id), file_index)


@router.post("/{booking_id}/request-cancellation")
async def request_cancellation(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Transporteur soumet une demande d'annulation avec justification et preuves.
    Passe le booking en cancelled_by_carrier + pending_review.
    Rembourse 100% l'expediteur immediatement.
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()
    if not trip or trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status != "accepted":
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    justification = payload.get("justification", "").strip()
    evidence_urls = payload.get("evidence_urls", [])

    if not justification:
        raise HTTPException(status_code=400, detail=t("errors.justification_required", lang))
    if len(evidence_urls) > settings.MAX_EVIDENCE_FILES:
        raise HTTPException(status_code=400, detail=t("errors.too_many_evidence_files", lang, n=settings.MAX_EVIDENCE_FILES))

    # Valider que les URLs appartiennent bien a notre Cloudinary
    from app.core.config import settings as s
    for url in evidence_urls:
        expected_host = f"res.cloudinary.com/{s.CLOUDINARY_CLOUD_NAME}/"
        expected_folder = f"kipar/cancellation_evidence/{booking_id}/"
        if expected_host not in url or expected_folder not in url:
            raise HTTPException(status_code=400, detail="URL de preuve invalide")

    booking.status = "cancelled_by_carrier"
    booking.cancellation_review_status = "pending_review"
    booking.cancellation_justification = justification
    booking.cancellation_evidence_urls = evidence_urls
    booking.carrier_penalty_due = s.CARRIER_CANCEL_FEE_MIN
    if payload.get("reason"):
        booking.cancellation_reason = payload.get("reason")

    # Restituer les kg au trip
    pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
    pkg = pkg_result.scalar_one_or_none()
    if pkg and trip and booking.kg_held:
        trip.remaining_kg += pkg.weight_kg
        if trip.status == "full":
            trip.status = "open"
        booking.kg_held = False

    # C3c refund integral annulation carrier justifiee (gere hold/capture)
    if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and s.STRIPE_SECRET_KEY:
        try:
            await settle_cancellation_refund(booking.escrow_ref, booking.amount, 0.0, None, str(booking.id))
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    await db.commit()

    # Notifier l'expediteur
    sender_result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender_notif = sender_result.scalar_one_or_none()
    if sender_notif:
        from app.services.notif_db_service import notify_booking_cancelled_by_carrier_db
        await notify_booking_cancelled_by_carrier_db(
            db=db,
            sender_id=sender_notif.id,
            receiver_id=booking.receiver_id,
            booking_id=booking.id,
            lang=sender_notif.language or "fr",
        )
        await db.commit()

    return {"status": "pending_review", "message": "Demande soumise, en attente de validation KIPAR"}


@router.post("/{booking_id}/review-cancellation")
async def review_cancellation(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Admin KIPAR statue sur une demande d'annulation transporteur.
    decision: 'justified' ou 'unjustified'
    - justified  : rien, remboursement deja fait
    - unjustified: penalite 5EUR enregistree, a prelever manuellement
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.cancellation_review_status != "pending_review":
        raise HTTPException(status_code=400, detail=t("errors.no_pending_review", lang))

    decision = payload.get("decision", "").strip()
    if decision not in ("justified", "unjustified"):
        raise HTTPException(status_code=400, detail=t("errors.invalid_decision", lang))

    booking.cancellation_review_status = decision

    if decision == "justified":
        booking.cancellation_justified = True
        booking.carrier_penalty_due = 0.0
    else:
        booking.cancellation_justified = False
        booking.carrier_penalty_due = settings.CARRIER_CANCEL_FEE_MIN
        # Prelevement reel Stripe si le transporteur a un compte Connect
        trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
        trip_penalty = trip_r.scalar_one_or_none()
        if trip_penalty:
            carrier_r = await db.execute(select(User).where(User.id == trip_penalty.carrier_id))
            carrier_u = carrier_r.scalar_one_or_none()
            if carrier_u:
                # C5b penalty ledger : dette reportee (Stripe refuse les Transfer negatifs)
                from app.services.penalty_service import add_penalty
                await add_penalty(db, carrier_u, booking.id, settings.CARRIER_CANCEL_FEE_MIN,
                                  description=f"Penalite annulation non justifiee booking {booking_id}")

    await db.commit()

    # Notifier le transporteur de la decision
    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()
    if trip:
        from app.services.notif_db_service import create_notification
        msg = "Votre annulation a ete validee." if decision == "justified" else "Votre annulation n'a pas ete validee. Une penalite de 5EUR vous sera prelevee."
        await create_notification(
            db=db,
            user_id=trip.carrier_id,
            type="cancellation_reviewed",
            title="Decision annulation",
            body=msg,
            link=f"/packages/{booking_id}",
        )
        await db.commit()

    return {"status": decision, "carrier_penalty_due": booking.carrier_penalty_due}
