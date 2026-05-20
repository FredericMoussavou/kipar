from fastapi import UploadFile, File, APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
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
from app.schemas.booking import BookingCreate, BookingResponse, BookingDetailResponse
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


async def find_or_invite_receiver(
    contact: str, sender_id: uuid.UUID, booking_id: uuid.UUID,
    db: AsyncSession, sender: User, trip: "Trip", pkg: "Package",
) -> uuid.UUID | None:
    result = await db.execute(select(User).where(User.email == contact))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.phone == contact))
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
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    from app.api.v1.endpoints.premium import is_premium_active
    from sqlalchemy import func
    if not is_premium_active(current_user):
        active_count_result = await db.execute(
            select(func.count()).where(
                Booking.sender_id == current_user.id,
                Booking.status.in_(["pending", "accepted", "paid", "in_transit"]),
            )
        )
        if active_count_result.scalar() >= 3:
            raise HTTPException(status_code=403, detail=t("errors.premium_booking_limit", lang))

    result = await db.execute(select(Trip).where(Trip.id == payload.trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))
    if trip.status != "open":
        raise HTTPException(status_code=400, detail=t("errors.trip_not_open", lang))
    # Empêche l'auto-expédition
    if trip.carrier_id == current_user.id:
        raise HTTPException(status_code=400, detail=t("errors.carrier_cannot_send", lang))
    if payload.receiver_email_or_phone in (current_user.email, current_user.phone):
        raise HTTPException(status_code=400, detail=t("errors.cannot_send_to_self", lang))
    if payload.weight_kg > trip.remaining_kg:
        raise HTTPException(status_code=400, detail=t(
            "errors.weight_exceeds_capacity", lang,
            requested=payload.weight_kg, available=trip.remaining_kg
        ))
    if payload.weight_kg > trip.max_kg_per_package:
        raise HTTPException(status_code=400, detail=t(
            "errors.weight_exceeds_max", lang, max=trip.max_kg_per_package
        ))

    amount = payload.weight_kg * trip.price_per_kg
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

    # Notifie le transporteur
    result = await db.execute(select(User).where(User.id == trip.carrier_id))
    carrier = result.scalar_one_or_none()
    route = f"{trip.origin_airport_code} → {trip.destination_airport_code}"
    await notify_booking_received(
        carrier_fcm_token=carrier.fcm_token,
        carrier_phone=carrier.phone,
        carrier_email=carrier.email,
        route=route,
        lang=carrier.language,
    )

    await notify_booking_received_db(
        db=db,
        carrier_id=carrier.id,
        route=route,
        booking_id=booking.id,
        lang=carrier.language or "fr",
    )

    return booking


@router.patch("/{booking_id}/accept", response_model=BookingResponse)
async def accept_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("pending", "awaiting_receiver", "paid"):
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
    weight = pkg.weight_kg if pkg else (booking.amount / (trip.price_per_kg * 1.13))
    trip.remaining_kg = max(0.0, trip.remaining_kg - weight)
    if trip.remaining_kg <= 0:
        trip.status = "full"

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
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("pending", "awaiting_receiver", "paid"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    # Annuler le PaymentIntent Stripe et rembourser (- 1.5EUR frais de gestion)
    if booking.escrow_ref and booking.payment_rail == "stripe":
        from app.services.stripe_service import cancel_payment_intent
        await cancel_payment_intent(booking.escrow_ref)
        booking.booking_fee_collected = True

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
    responses = []
    for b in bookings:
        pkg_result = await db.execute(select(Package).where(Package.id == b.package_id))
        pkg = pkg_result.scalar_one_or_none()
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
        ))
    return responses


@router.get("/detail", response_model=list[BookingResponse])
async def list_my_bookings_detailed(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste enrichie avec les données du package."""
    from sqlalchemy import or_
    from app.models.package import Package
    result = await db.execute(
        select(Booking)
        .where(or_(
            Booking.sender_id == current_user.id,
            Booking.receiver_id == current_user.id,
        ))
        .order_by(Booking.created_at.desc())
    )
    bookings = result.scalars().all()
    responses = []
    for b in bookings:
        pkg_result = await db.execute(select(Package).where(Package.id == b.package_id))
        pkg = pkg_result.scalar_one_or_none()
        resp = BookingResponse(
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
        )
        responses.append(resp)
    return responses


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

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_check = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip_check_obj = trip_check.scalar_one_or_none()
    carrier_id = trip_check_obj.carrier_id if trip_check_obj else None
    if current_user.id not in (b.sender_id, b.receiver_id, carrier_id):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    pkg_result = await db.execute(select(Package).where(Package.id == b.package_id))
    pkg = pkg_result.scalar_one_or_none()
    trip_result = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_result.scalar_one_or_none()
    carrier = None
    if trip:
        carrier_result = await db.execute(select(User).where(User.id == trip.carrier_id))
        carrier = carrier_result.scalar_one_or_none()
    
    receiver = None
    if b.receiver_id:
        receiver_result = await db.execute(select(User).where(User.id == b.receiver_id))
        receiver = receiver_result.scalar_one_or_none()
    sender = None
    if b.sender_id:
        sender_result = await db.execute(select(User).where(User.id == b.sender_id))
        sender = sender_result.scalar_one_or_none()

    return BookingDetailResponse(
        id=b.id, trip_id=b.trip_id, package_id=b.package_id,
        sender_id=b.sender_id, receiver_id=b.receiver_id,
        amount=b.amount, insurance_subscribed=b.insurance_subscribed,
        status=b.status, payment_rail=b.payment_rail,
        weight_kg=pkg.weight_kg if pkg else None,
        content_description=pkg.content_description if pkg else None,
        declared_value=pkg.declared_value if pkg else None,
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
    if booking.status not in ("pending", "awaiting_receiver", "accepted", "paid"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()

    is_sender = booking.sender_id == current_user.id
    is_carrier = trip and trip.carrier_id == current_user.id

    if not is_sender and not is_carrier:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    refund_rate = 1.0
    carrier_compensation_rate = 0.0
    kipar_fee_rate = 0.0

    if is_sender:
        booking.status = "cancelled_by_sender"
        if booking.cancellation_justified:
            # Force majeure (flag admin) -> remboursement 100%, Kipar 0
            refund_rate = 1.0
            kipar_fee_rate = 0.0
        elif trip and trip.departure_date:
            from datetime import date, timedelta
            hours_until = (trip.departure_date - date.today()).days * 24
            if hours_until > settings.LATE_CANCEL_HOURS:
                # Annulation >72h -> exp. +85%, Kipar +15%
                refund_rate = 1.0 - settings.SERVICE_FEE_SENDER_PERCENT
                kipar_fee_rate = settings.SERVICE_FEE_SENDER_PERCENT
            else:
                # Annulation <=72h non justifiee -> exp. 0%, tra. +85%, Kipar +15%
                refund_rate = 0.0
                carrier_compensation_rate = 1.0 - settings.SERVICE_FEE_SENDER_PERCENT
                kipar_fee_rate = settings.SERVICE_FEE_SENDER_PERCENT
        print(f"[ESCROW] Annulation expéditeur booking {booking_id} — remboursement {int(refund_rate*100)}% Kipar {int(kipar_fee_rate*100)}%")
    else:
        booking.status = "cancelled_by_carrier"
        refund_rate = 1.0  # expediteur toujours rembourse 100%
        if not booking.cancellation_justified:
            # Annulation non justifiee -> 5% (min 5EUR) factures au transporteur
            carrier_penalty = max(
                booking.amount * settings.CARRIER_CANCEL_FEE_PERCENT,
                settings.CARRIER_CANCEL_FEE_MIN
            )
            print(f"[TRUST] Annulation transporteur booking {booking_id} — penalite {carrier_penalty:.2f}EUR + trust downgrade")
            # TODO Sprint 4 : prelevement reel Stripe/Flutterwave sur le transporteur
        else:
            print(f"[ESCROW] Annulation transporteur justifiee booking {booking_id} — force majeure")
        print(f"[TRUST] Annulation transporteur booking {booking_id} — downgrade simulé")

    if payload.reason:
        booking.cancellation_reason = payload.reason

    # Restituer les kg au trip
    if trip:
        pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
        pkg = pkg_result.scalar_one_or_none()
        if pkg:
            trip.remaining_kg += pkg.weight_kg
            if trip.status == "full":
                trip.status = "open"

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

    return {"status": booking.status, "refund_rate": refund_rate, "amount": booking.amount}

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
async def generate_pickup_code(booking_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
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
async def validate_pickup(booking_id: str, payload: ValidatePickupRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
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

@router.post("/{booking_id}/pickup/propose")
async def propose_pickup_meeting(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime, timezone, timedelta
    
    # 1. Récupération de la réservation et du trajet
    res_booking = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res_booking.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
        
    res_trip = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = res_trip.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trajet introuvable")

    # 2. Vérification des tentatives
    if booking.pickup_reschedule_count >= 3:
        raise HTTPException(status_code=400, detail="Limite de modifications atteinte (3/3)")

    # 3. Vérification de la contrainte de temps (3h avant décollage)
    try:
        # On force tout en UTC pour pouvoir comparer
        dep_dt = datetime.combine(trip.departure_date, trip.departure_time).replace(tzinfo=timezone.utc)
        proposed_dt = datetime.fromisoformat(payload.get("meeting_date").replace('Z', '+00:00')).replace(tzinfo=timezone.utc)
    except Exception as e:
        print(f"ERREUR DATE: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Erreur Date: {str(e)}")

    if proposed_dt > dep_dt - timedelta(hours=3):
        raise HTTPException(status_code=400, detail="Le RDV doit être au moins 3h avant le vol")

    # 4. Enregistrement de la proposition
    booking.proposed_pickup_date = proposed_dt
    booking.proposed_pickup_by = current_user.id
    booking.pickup_reschedule_count += 1
    
    await db.commit()
    return {"status": "success", "message": "Proposition envoyée avec succès"}

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

@router.post("/{booking_id}/delivery/propose")
async def propose_delivery_meeting(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime, timezone
    
    res_booking = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res_booking.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
        
    res_trip = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = res_trip.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trajet introuvable")

    if booking.delivery_reschedule_count >= 3:
        raise HTTPException(status_code=400, detail="Limite de modifications atteinte (3/3)")

    try:
        from datetime import time
        
        # Sécurisation du format de l'heure
        arr_time_obj = trip.arrival_time
        if isinstance(arr_time_obj, str):
            # Si c'est une string (ex: "14:30" ou "14:30:00"), on la convertit
            time_parts = arr_time_obj.split(':')
            h = int(time_parts[0])
            m = int(time_parts[1])
            s = int(time_parts[2]) if len(time_parts) > 2 else 0
            arr_time_obj = time(h, m, s)

        from datetime import time
        arr_time_obj = trip.arrival_time
        if isinstance(arr_time_obj, str):
            time_parts = arr_time_obj.split(':')
            arr_time_obj = time(int(time_parts[0]), int(time_parts[1]), int(time_parts[2]) if len(time_parts) > 2 else 0)
        arr_dt = datetime.combine(trip.arrival_date, arr_time_obj).replace(tzinfo=timezone.utc)
        proposed_dt = datetime.fromisoformat(payload.get("meeting_date").replace('Z', '+00:00')).replace(tzinfo=timezone.utc)
    except Exception as e:
        print(f"ERREUR DATE: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Erreur Date: {str(e)}")

    # Contrainte : Le RDV doit être APRÈS l'arrivée du vol
    if proposed_dt < arr_dt:
        raise HTTPException(status_code=400, detail="Le RDV doit avoir lieu après l'arrivée du vol")

    booking.proposed_delivery_date = proposed_dt
    booking.proposed_delivery_by = current_user.id
    booking.delivery_reschedule_count += 1
    
    await db.commit()
    return {"status": "success", "message": "Proposition de livraison envoyée"}

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


@router.post("/{booking_id}/delivery/alternative-proof")
async def delivery_alternative_proof(
    booking_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import cloudinary.uploader
    
    res_booking = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = res_booking.scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    if booking.status != "in_transit":
        raise HTTPException(status_code=400, detail="Le colis n'est pas en transit")

    # 1. Upload vers Cloudinary
    try:
        upload_result = cloudinary.uploader.upload(file.file)
        secure_url = upload_result.get("secure_url")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'upload Cloudinary : {str(e)}")

    # 2. Mise à jour de la réservation
    booking.delivery_alternative_proof_url = secure_url
    booking.status = "pending_admin_validation"
    
    await db.commit()
    return {
        "status": "success", 
        "message": "Preuve envoyée. En attente de l'administrateur.",
        "url": secure_url
    }


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
