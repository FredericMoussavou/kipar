from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.package import Package
from app.schemas.delivery import (
    DeliveryCodeResponse, ValidateDeliveryRequest, ValidateDeliveryQRRequest,
    MeetingDateRequest, AlternativeProofRequest
)
from app.services.delivery_service import generate_and_hash_code, verify_code, code_expires_at
from app.services.notification_service import notify_delivery_code, notify_delivery_confirmed
from app.services.notif_db_service import notify_delivery_confirmed_db, create_notification
from app.i18n.loader import t

router = APIRouter(prefix="/delivery", tags=["delivery"])


@router.post("/{booking_id}/generate-code", response_model=DeliveryCodeResponse)
@limiter.limit("5/minute")
async def generate_delivery_code(
    request: Request,
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(
        select(Booking)
        .options(joinedload(Booking.trip))
        .where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "in_transit":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_in_transit", lang))
    if current_user.id != booking.receiver_id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.delivery_code_hash:
        raise HTTPException(status_code=400, detail=t("errors.delivery_code_already_generated", lang))

    code, hashed = generate_and_hash_code()
    qr_token = Booking.generate_qr_token()
    booking.delivery_code_hash = hashed
    booking.delivery_code_plain = None  
    booking.delivery_qr_token = qr_token
    booking.delivery_code_expires_at = code_expires_at()

    trip = booking.trip
    
    user_ids = [uid for uid in [trip.carrier_id, booking.receiver_id] if uid]
    users_map = {}
    if user_ids:
        u_res = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: u for u in u_res.scalars().all()}

    carrier = users_map.get(trip.carrier_id)
    receiver = users_map.get(booking.receiver_id)

    if receiver and carrier:
        await notify_delivery_code(
            receiver_fcm_token=receiver.fcm_token,
            receiver_phone=receiver.phone,
            receiver_email=receiver.email,
            code=code,
            carrier_name=carrier.full_name,
            flight_number=trip.flight_number,
            lang=receiver.language,
        )

    return DeliveryCodeResponse(booking_id=booking.id, code=code, qr_token=qr_token)


@router.post("/{booking_id}/validate", response_model=dict)
@limiter.limit("5/minute")
async def validate_delivery(
    request: Request,
    booking_id: str,
    payload: ValidateDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "in_transit":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_in_transit", lang))
    if not booking.delivery_code_hash:
        raise HTTPException(status_code=400, detail=t("errors.delivery_no_code", lang))
    if datetime.now(timezone.utc) > booking.delivery_code_expires_at:
        raise HTTPException(status_code=400, detail=t("errors.delivery_code_expired", lang))
    if not verify_code(payload.code, booking.delivery_code_hash):
        raise HTTPException(status_code=400, detail=t("errors.delivery_code_invalid", lang))

    booking.status = "delivered"
    booking.delivery_confirmed_at = datetime.now(timezone.utc)
    booking.delivery_confirmed_by = current_user.id
    booking.delivery_code_plain = None
    _schedule_payment_release(str(booking.id))

    sender_result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender = sender_result.scalar_one_or_none()
    if sender:
        s_lang = sender.language or "fr"
        await notify_delivery_confirmed(
            user_fcm_token=sender.fcm_token,
            user_phone=sender.phone,
            user_email=sender.email,
            lang=s_lang,
        )
        await notify_delivery_confirmed_db(
            db=db,
            sender_id=sender.id,
            booking_id=booking.id,
            lang=s_lang,
        )

    return {"message": t("success.delivery_confirmed", lang)}


@router.post("/{booking_id}/validate-qr", response_model=dict)
@limiter.limit("5/minute")
async def validate_delivery_qr(
    request: Request,
    booking_id: str,
    payload: ValidateDeliveryQRRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "in_transit":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_in_transit", lang))
    if booking.delivery_qr_token != payload.qr_token:
        raise HTTPException(status_code=400, detail=t("errors.delivery_qr_invalid", lang))

    booking.status = "delivered"
    booking.delivery_confirmed_at = datetime.now(timezone.utc)
    booking.delivery_confirmed_by = current_user.id

    _schedule_payment_release(str(booking.id))
    return {"message": t("success.delivery_confirmed_qr", lang)}


def _schedule_payment_release(booking_id: str):
    try:
        from app.workers.booking_tasks import release_payment_after_delivery
        release_payment_after_delivery.apply_async(
            args=[booking_id],
            countdown=86400
        )
    except Exception:
        pass


@router.get("/{booking_id}/code")
async def get_delivery_code(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    is_receiver = booking.receiver_id == current_user.id
    is_sender = booking.sender_id == current_user.id
    if not is_receiver and not is_sender:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if not booking.delivery_qr_token:
        raise HTTPException(status_code=404, detail=t("errors.delivery_code_unavailable", lang))

    from app.services.delivery_service import get_plain_code_for_receiver
    plain_code = None
    if is_receiver:
        plain_code = await get_plain_code_for_receiver(booking)

    return {
        "qr_token": booking.delivery_qr_token,
        "code": plain_code,
        "expires_at": booking.delivery_code_expires_at.isoformat() if booking.delivery_code_expires_at else None,
    }


@router.post("/{booking_id}/failed")
async def declare_delivery_failed(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    from datetime import datetime, timezone, timedelta
    from app.core.config import settings

    comment = (payload.get("comment") or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail=t("errors.reason_required", lang))

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "in_transit":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_in_transit", lang))

    result_trip = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result_trip.scalar_one_or_none()

    is_carrier = trip and trip.carrier_id == current_user.id
    is_receiver = booking.receiver_id == current_user.id
    if not is_carrier and not is_receiver:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    user_ids = [uid for uid in [booking.sender_id, booking.receiver_id, trip.carrier_id] if uid]
    u_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in u_res.scalars().all()}

    s_user = users_map.get(booking.sender_id)
    r_user = users_map.get(booking.receiver_id)
    c_user = users_map.get(trip.carrier_id)

    s_lang = s_user.language if s_user else "fr"
    r_lang = r_user.language if r_user else "fr"
    c_lang = c_user.language if c_user else "fr"

    now = datetime.now(timezone.utc)
    booking.status = "delivery_failed"
    booking.delivery_failed_at = now
    booking.delivery_failed_comment = comment
    booking.delivery_failed_by = "carrier" if is_carrier else "receiver"
    booking.incident_response_deadline = now + timedelta(hours=settings.INCIDENT_RESPONSE_HOURS)
    await db.commit()

    if is_carrier:
        if booking.receiver_id:
            await create_notification(
                db=db, user_id=booking.receiver_id, type="delivery_failed",
                title=t("notifications.delivery_failed_title", r_lang),
                body=t("notifications.delivery_failed_receiver_absent", r_lang, comment=comment),
                link=f"/packages/{booking.id}",
            )
        await create_notification(
            db=db, user_id=booking.sender_id, type="delivery_failed",
            title=t("notifications.delivery_failed_title", s_lang),
            body=t("notifications.delivery_failed_carrier_impossibility", s_lang, comment=comment),
            link=f"/packages/{booking.id}",
        )
    else:
        if c_user:
            await create_notification(
                db=db, user_id=c_user.id, type="delivery_failed",
                title=t("notifications.delivery_failed_title", c_lang),
                body=t("notifications.delivery_failed_carrier_absent", c_lang, comment=comment),
                link=f"/carrier",
            )
        await create_notification(
            db=db, user_id=booking.sender_id, type="delivery_failed",
            title=t("notifications.delivery_failed_title", s_lang),
            body=t("notifications.delivery_failed_receiver_impossibility", s_lang, comment=comment),
            link=f"/packages/{booking.id}",
        )
    await db.commit()
    return {
        "status": "delivery_failed",
        "declared_by": booking.delivery_failed_by,
        "response_deadline": booking.incident_response_deadline.isoformat(),
    }


@router.patch("/{booking_id}/failed/respond")
async def respond_delivery_failed(
    booking_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    from app.models.dispute import Dispute
    from app.core.config import settings

    response = (payload.get("response") or "").strip()
    if not response:
        raise HTTPException(status_code=400, detail=t("errors.reason_required", lang))

    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "delivery_failed":
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    result_trip = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result_trip.scalar_one_or_none()
    is_carrier = trip and trip.carrier_id == current_user.id
    is_receiver = booking.receiver_id == current_user.id
    declared_by = booking.delivery_failed_by

    if declared_by == "carrier" and not is_receiver:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if declared_by == "receiver" and not is_carrier:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    user_ids = [uid for uid in [booking.sender_id, booking.receiver_id] if uid]
    u_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    u_map = {u.id: u for u in u_res.scalars().all()}
    s_lang = u_map.get(booking.sender_id).language if u_map.get(booking.sender_id) else "fr"
    r_lang = u_map.get(booking.receiver_id).language if u_map.get(booking.receiver_id) else "fr"

    now = datetime.now(timezone.utc)
    if booking.incident_response_deadline and now > booking.incident_response_deadline:
        raise HTTPException(status_code=400, detail=t("errors.incident_response_expired", lang))

    if response.lower() == "accept":
        if declared_by == "carrier":
            booking.status = "delivered"
            booking.delivery_confirmed_at = now
            booking.delivery_confirmed_by = current_user.id
            resolution = "carrier_favored_receiver_fault"
            _schedule_payment_release(str(booking.id))
        else:
            booking.status = "cancelled"
            booking.cancellation_reason = "delivery_failed_carrier_fault"
            resolution = "receiver_favored_carrier_fault"
            from app.services.stripe_service import settle_cancellation_refund
            if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and settings.STRIPE_SECRET_KEY:
                try:
                    await settle_cancellation_refund(booking.escrow_ref, booking.amount, 0.0, None, str(booking.id))
                except Exception as e:
                    import logging
                    logging.getLogger("kipar").error(f"[DELIVERY_FAILED] Refund booking {booking.id}: {e}")
        await db.commit()
        await create_notification(
            db=db, user_id=booking.sender_id, type="delivery_failed_resolved",
            title=t("notifications.incident_resolved_title", s_lang),
            body=t("notifications.incident_resolved_body_finance", s_lang),
            link=f"/packages/{booking.id}",
        )
        if booking.receiver_id:
            await create_notification(
                db=db, user_id=booking.receiver_id, type="delivery_failed_resolved",
                title=t("notifications.incident_resolved_title", r_lang),
                body=t("notifications.incident_resolved_body_simple", r_lang),
                link=f"/packages/{booking.id}",
            )
        await db.commit()
        return {"status": booking.status, "resolution": resolution}
    else:
        existing = await db.execute(select(Dispute).where(Dispute.booking_id == booking.id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=t("errors.dispute_already_exists", lang))
        booking.status = "disputed"
        dispute = Dispute(
            booking_id=booking.id,
            initiated_by=current_user.id,
            reason=f"Contestation delivery_failed : {response}",
            status="open",
        )
        db.add(dispute)
        await db.commit()
        await create_notification(
            db=db, user_id=booking.sender_id, type="dispute_opened",
            title=t("notifications.dispute_opened_title", s_lang),
            body=t("notifications.dispute_opened_body", s_lang),
            link=f"/packages/{booking.id}",
        )
        await db.commit()
        return {"status": "disputed", "dispute_id": str(dispute.id)}


@router.post("/{booking_id}/propose-delivery-meeting")
async def propose_delivery_meeting(
    booking_id: str,
    payload: MeetingDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_receiver = current_user.id == b.receiver_id
    if not (is_carrier or is_receiver):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if b.status not in ("in_transit", "delivery_reported"):
        raise HTTPException(status_code=400, detail=t("errors.booking_not_editable", lang))
    if payload.meeting_date <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail=t("errors.delivery_meeting_past", lang))

    if trip.arrival_date and trip.arrival_time:
        h, m = map(int, trip.arrival_time.split(":"))
        arrival_dt = datetime(trip.arrival_date.year, trip.arrival_date.month, trip.arrival_date.day, h, m, tzinfo=timezone.utc)
        if payload.meeting_date <= arrival_dt:
            raise HTTPException(status_code=400, detail=t("errors.delivery_meeting_before_arrival", lang))

    b.proposed_delivery_date = payload.meeting_date
    b.proposed_delivery_by = current_user.id
    notif_target = b.receiver_id if is_carrier else trip.carrier_id
    
    t_user = await db.get(User, notif_target)
    t_lang = t_user.language if t_user else "fr"
    role_str = t("roles.carrier", t_lang) if is_carrier else t("roles.receiver", t_lang)

    await create_notification(
        db=db, user_id=notif_target, type="delivery_meeting_proposed",
        title=t("notifications.delivery_meeting_proposed_title", t_lang),
        body=t("notifications.delivery_meeting_proposed_body", t_lang, role=role_str),
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "proposed", "proposed_delivery_date": str(b.proposed_delivery_date)}


@router.post("/{booking_id}/confirm-delivery-meeting")
async def confirm_delivery_meeting(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if not b.proposed_delivery_date:
        raise HTTPException(status_code=400, detail=t("errors.statut_incompatible", lang))
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_receiver = current_user.id == b.receiver_id
    if not (is_carrier or is_receiver):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if current_user.id == b.proposed_delivery_by:
        raise HTTPException(status_code=400, detail=t("errors.unauthorized", lang))

    b.delivery_meeting_date = b.proposed_delivery_date
    b.proposed_delivery_date = None
    b.proposed_delivery_by = None
    notif_target = b.receiver_id if is_carrier else trip.carrier_id
    
    t_user = await db.get(User, notif_target)
    t_lang = t_user.language if t_user else "fr"

    await create_notification(
        db=db, user_id=notif_target, type="delivery_meeting_confirmed",
        title=t("notifications.delivery_meeting_confirmed_title", t_lang),
        body=t("notifications.delivery_meeting_confirmed_body", t_lang),
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "confirmed", "delivery_meeting_date": str(b.delivery_meeting_date)}


@router.post("/{booking_id}/reschedule-delivery")
async def reschedule_delivery(
    booking_id: str,
    payload: MeetingDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_receiver = current_user.id == b.receiver_id
    if not (is_carrier or is_receiver):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if b.status not in ("in_transit", "delivery_reported"):
        raise HTTPException(status_code=400, detail=t("errors.booking_not_editable", lang))
    if b.delivery_reschedule_count >= 3:
        raise HTTPException(status_code=400, detail=t("errors.delivery_reschedule_limit", lang))

    b.proposed_delivery_date = payload.meeting_date
    b.proposed_delivery_by = current_user.id
    b.delivery_reschedule_count += 1
    b.status = "delivery_reported"
    notif_target = b.receiver_id if is_carrier else trip.carrier_id
    
    t_user = await db.get(User, notif_target)
    t_lang = t_user.language if t_user else "fr"
    role_str = t("roles.carrier", t_lang) if is_carrier else t("roles.receiver", t_lang)
    formatted_date = payload.meeting_date.strftime('%d/%m/%Y %H:%M')

    await create_notification(
        db=db, user_id=notif_target, type="delivery_rescheduled",
        title=t("notifications.delivery_rescheduled_title", t_lang),
        body=t("notifications.delivery_rescheduled_body", t_lang, role=role_str, count=b.delivery_reschedule_count, date=formatted_date),
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "delivery_reported", "reschedule_count": b.delivery_reschedule_count}


@router.post("/{booking_id}/delivery-alternative-proof")
async def delivery_alternative_proof(
    booking_id: str,
    payload: AlternativeProofRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    if current_user.id != trip.carrier_id:
        raise HTTPException(status_code=403, detail=t("errors.carrier_only", lang))
    if b.status not in ("in_transit", "delivery_reported"):
        raise HTTPException(status_code=400, detail=t("errors.booking_not_editable", lang))

    b.delivery_alternative_proof_url = payload.proof_url
    b.status = "pending_admin_validation"
    
    s_user = await db.get(User, b.sender_id)
    s_lang = s_user.language if s_user else "fr"

    await create_notification(
        db=db, user_id=b.sender_id, type="delivery_alternative_proof",
        title=t("notifications.alternative_proof_submitted_title", s_lang),
        body=t("notifications.alternative_proof_submitted_body", s_lang),
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "pending_admin_validation"}


@router.post("/{booking_id}/propose-pickup-meeting")
async def propose_pickup_meeting(
    booking_id: str,
    payload: MeetingDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_sender = current_user.id == b.sender_id
    if not (is_carrier or is_sender):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if b.status != "accepted":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_editable", lang))
    if payload.meeting_date <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail=t("errors.pickup_meeting_past", lang))

    if trip.departure_date and trip.departure_time:
        h, m = map(int, trip.departure_time.split(":"))
        departure_dt = datetime(trip.departure_date.year, trip.departure_date.month, trip.departure_date.day, h, m, tzinfo=timezone.utc)
        from datetime import timedelta
        if payload.meeting_date >= departure_dt - timedelta(hours=3):
            raise HTTPException(status_code=400, detail=t("errors.pickup_meeting_too_close_flight", lang))

    b.proposed_pickup_date = payload.meeting_date
    b.proposed_pickup_by = current_user.id
    b.pickup_meeting_confirmed_by_sender = False
    b.pickup_meeting_confirmed_by_carrier = False
    notif_target = trip.carrier_id if is_sender else b.sender_id
    
    t_user = await db.get(User, notif_target)
    t_lang = t_user.language if t_user else "fr"
    role_str = t("roles.sender", t_lang) if is_sender else t("roles.carrier", t_lang)

    await create_notification(
        db=db, user_id=notif_target, type="pickup_meeting_proposed",
        title=t("notifications.pickup_meeting_proposed_title", t_lang),
        body=t("notifications.pickup_meeting_proposed_body", t_lang, role=role_str),
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "proposed", "proposed_pickup_date": str(b.proposed_pickup_date)}


@router.post("/{booking_id}/confirm-pickup-meeting")
async def confirm_pickup_meeting(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if not b.proposed_pickup_date:
        raise HTTPException(status_code=400, detail=t("errors.statut_incompatible", lang))
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_sender = current_user.id == b.sender_id
    if not (is_carrier or is_sender):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if current_user.id == b.proposed_pickup_by:
        raise HTTPException(status_code=400, detail=t("errors.unauthorized", lang))

    b.pickup_meeting_date = b.proposed_pickup_date
    b.proposed_pickup_date = None
    b.proposed_pickup_by = None
    if is_carrier:
        b.pickup_meeting_confirmed_by_carrier = True
    else:
        b.pickup_meeting_confirmed_by_sender = True

    notif_target = b.sender_id if is_carrier else trip.carrier_id
    t_user = await db.get(User, notif_target)
    t_lang = t_user.language if t_user else "fr"

    await create_notification(
        db=db, user_id=notif_target, type="pickup_meeting_confirmed",
        title=t("notifications.pickup_meeting_confirmed_title", t_lang),
        body=t("notifications.pickup_meeting_confirmed_body", t_lang),
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "confirmed", "pickup_meeting_date": str(b.pickup_meeting_date)}


@router.post("/{booking_id}/generate-pickup-code")
@limiter.limit("5/minute")
async def generate_pickup_code(
    request: Request,
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    if current_user.id != trip.carrier_id:
        raise HTTPException(status_code=403, detail=t("errors.carrier_only", lang))
    if b.status != "accepted":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_editable", lang))
    if not b.pickup_meeting_date:
        raise HTTPException(status_code=400, detail=t("errors.booking_not_accepted", lang))

    code, hashed = generate_and_hash_code()
    qr_token = Booking.generate_qr_token()
    b.pickup_code_hash = hashed
    b.pickup_code_plain = code
    b.pickup_qr_token = qr_token
    b.pickup_code_expires_at = code_expires_at()
    await db.commit()
    return {"booking_id": str(b.id), "code": code, "qr_token": qr_token}


@router.post("/{booking_id}/validate-pickup-code")
@limiter.limit("5/minute")
async def validate_pickup_code(
    request: Request,
    booking_id: str,
    payload: ValidateDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if current_user.id != b.sender_id:
        raise HTTPException(status_code=403, detail=t("errors.sender_only", lang))
    if b.status != "accepted":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_editable", lang))
    if not b.pickup_code_hash:
        raise HTTPException(status_code=400, detail=t("errors.delivery_no_code", lang))
    if datetime.now(timezone.utc) > b.pickup_code_expires_at:
        raise HTTPException(status_code=400, detail=t("errors.delivery_code_expired", lang))
    if not verify_code(payload.code, b.pickup_code_hash):
        raise HTTPException(status_code=400, detail=t("errors.delivery_code_invalid", lang))

    # FIX DU BUG DE CAPACITÉ : remaining_kg n'est déduit qu'une seule fois à la réservation
    b.status = "in_transit"
    b.pickup_code_plain = None

    if b.receiver_id:
        r_user = await db.get(User, b.receiver_id)
        r_lang = r_user.language if r_user else "fr"
        await create_notification(
            db=db, user_id=b.receiver_id, type="package_in_transit",
            title=t("notifications.package_in_transit_title", r_lang),
            body=t("notifications.package_in_transit_body", r_lang),
            link=f"/packages/{b.id}",
        )
    await db.commit()
    return {"status": "in_transit"}
