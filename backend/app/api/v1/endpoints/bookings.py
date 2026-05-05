from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.trip import Trip
from app.models.package import Package
from app.models.booking import Booking
from app.models.receiver_invitation import ReceiverInvitation
from app.schemas.booking import BookingCreate, BookingResponse, BookingDetailResponse
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
)

class CancelPayload(BaseModel):
    reason: str = ""

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
    if booking.status not in ("pending", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    # Récupère le poids réel depuis le package
    pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
    pkg = pkg_result.scalar_one_or_none()
    weight = pkg.weight_kg if pkg else (booking.amount / (trip.price_per_kg * 1.13))
    trip.remaining_kg = max(0.0, trip.remaining_kg - weight)
    if trip.remaining_kg <= 0:
        trip.status = "full"

    booking.status = "accepted"
    booking.accepted_at = datetime.now(timezone.utc)

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
    if booking.status not in ("pending", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

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
    if is_sender:
        booking.status = "cancelled_by_sender"
        if trip and trip.departure_date:
            from datetime import date
            days_until = (trip.departure_date - date.today()).days
            if days_until < 0:
                refund_rate = 0.0
            elif days_until == 0:
                refund_rate = 0.0
            elif days_until < 3:
                refund_rate = 0.5
            else:
                refund_rate = 1.0
        print(f"[ESCROW] Annulation expéditeur booking {booking_id} — remboursement {int(refund_rate*100)}%")
    else:
        booking.status = "cancelled_by_carrier"
        refund_rate = 1.0
        print(f"[TRUST] Annulation transporteur booking {booking_id} — downgrade simulé")

    if payload.reason:
        booking.cancellation_reason = payload.reason

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