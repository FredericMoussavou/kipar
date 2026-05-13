from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.schemas.delivery import (
    DeliveryCodeResponse,
    ValidateDeliveryRequest,
    ValidateDeliveryQRRequest,
    MeetingDateRequest,
    AlternativeProofRequest,
)
from app.services.delivery_service import (
    generate_and_hash_code,
    verify_code,
    code_expires_at,
)
from app.services.notification_service import notify_delivery_code, notify_delivery_confirmed
from app.services.notif_db_service import notify_delivery_confirmed_db
from app.i18n.loader import t

router = APIRouter(prefix="/delivery", tags=["delivery"])


@router.post("/{booking_id}/generate-code", response_model=DeliveryCodeResponse)
async def generate_delivery_code(
    booking_id: str,
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
    if current_user.id != booking.receiver_id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.delivery_code_hash:
        raise HTTPException(status_code=400, detail=t("errors.delivery_code_already_generated", lang))

    code, hashed = generate_and_hash_code()
    qr_token = Booking.generate_qr_token()
    booking.delivery_code_hash = hashed
    booking.delivery_code_plain = code
    booking.delivery_qr_token = qr_token
    booking.delivery_code_expires_at = code_expires_at()

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    result = await db.execute(select(User).where(User.id == trip.carrier_id))
    carrier = result.scalar_one_or_none()

    if booking.receiver_id:
        result = await db.execute(select(User).where(User.id == booking.receiver_id))
        receiver = result.scalar_one_or_none()
        if receiver:
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
async def validate_delivery(
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

    sender_result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender = sender_result.scalar_one_or_none()
    if sender:
        await notify_delivery_confirmed(
            user_fcm_token=sender.fcm_token,
            user_phone=sender.phone,
            user_email=sender.email,
            lang=sender.language or "fr",
        )
        await notify_delivery_confirmed_db(
            db=db,
            sender_id=sender.id,
            booking_id=booking.id,
            lang=sender.language or "fr",
        )

    return {"message": t("success.delivery_confirmed", lang)}


@router.post("/{booking_id}/validate-qr", response_model=dict)
async def validate_delivery_qr(
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

    return {"message": t("success.delivery_confirmed_qr", lang)}


def _schedule_payment_release(booking_id: str):
    """Planifie la liberation du paiement 24h apres livraison."""
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
    """Retourne le QR token + code en clair pour le recepteur uniquement."""
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
    """Declare un delivery_failed.
    - Transporteur : recepteur absent / injoignable
    - Recepteur : transporteur absent
    Commentaire obligatoire. Horodatage serveur. Fenetre 48h pour justification.
    """
    from datetime import datetime, timezone, timedelta
    from app.core.config import settings
    from app.services.notif_db_service import create_notification

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
                db=db,
                user_id=booking.receiver_id,
                type="delivery_failed",
                title="Livraison echouee",
                body=f"Le transporteur signale que vous etiez absent : {comment}. Vous avez 48h pour contester.",
                link=f"/packages/{booking.id}",
            )
        await create_notification(
            db=db,
            user_id=booking.sender_id,
            type="delivery_failed",
            title="Livraison echouee",
            body=f"Le transporteur signale une impossibilite de livraison : {comment}.",
            link=f"/packages/{booking.id}",
        )
    else:
        carrier_result = await db.execute(select(User).where(User.id == trip.carrier_id))
        carrier = carrier_result.scalar_one_or_none()
        if carrier:
            await create_notification(
                db=db,
                user_id=carrier.id,
                type="delivery_failed",
                title="Livraison echouee",
                body=f"Le recepteur signale que vous ne vous etes pas presente : {comment}. Vous avez 48h pour contester.",
                link=f"/carrier",
            )
        await create_notification(
            db=db,
            user_id=booking.sender_id,
            type="delivery_failed",
            title="Livraison echouee",
            body=f"Le recepteur signale une impossibilite de livraison : {comment}.",
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
    """La partie mise en cause repond dans la fenetre 48h.
    - payload.response = "accept" -> declarant favorise automatiquement
    - payload.response = autre -> contestation -> litige ouvert
    """
    from datetime import datetime, timezone
    from app.models.dispute import Dispute
    from app.core.config import settings
    from app.services.notif_db_service import create_notification

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
    is_sender = booking.sender_id == current_user.id
    declared_by = booking.delivery_failed_by

    if declared_by == "carrier" and not is_receiver and not is_sender:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if declared_by == "receiver" and not is_carrier:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    now = datetime.now(timezone.utc)
    if booking.incident_response_deadline and now > booking.incident_response_deadline:
        raise HTTPException(status_code=400, detail=t("errors.incident_response_expired", lang))

    if response.lower() == "accept":
        if declared_by == "carrier":
            booking.status = "delivered"
            booking.delivery_confirmed_at = now
            booking.delivery_confirmed_by = current_user.id
            resolution = "carrier_favored_receiver_fault"
        else:
            booking.status = "cancelled"
            booking.cancellation_reason = "delivery_failed_carrier_fault"
            resolution = "receiver_favored_carrier_fault"
        await db.commit()
        await create_notification(
            db=db,
            user_id=booking.sender_id,
            type="delivery_failed_resolved",
            title="Incident resolu",
            body="L'incident de livraison a ete resolu. Le traitement financier va suivre.",
            link=f"/packages/{booking.id}",
        )
        await db.commit()
        return {"status": booking.status, "resolution": resolution}
    else:
        existing = await db.execute(
            select(Dispute).where(Dispute.booking_id == booking.id)
        )
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
            db=db,
            user_id=booking.sender_id,
            type="dispute_opened",
            title="Litige ouvert",
            body="La contestation a ete enregistree. L'equipe Kipar va examiner le dossier.",
            link=f"/packages/{booking.id}",
        )
        await db.commit()
        return {"status": "disputed", "dispute_id": str(dispute.id)}


# ---------------------------------------------------------------------------
# RDV LIVRAISON
# ---------------------------------------------------------------------------

@router.post("/{booking_id}/propose-delivery-meeting")
async def propose_delivery_meeting(
    booking_id: str,
    payload: MeetingDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Carrier ou receiver propose une delivery_meeting_date."""
    from app.services.notif_db_service import create_notification

    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_receiver = current_user.id == b.receiver_id
    if not (is_carrier or is_receiver):
        raise HTTPException(status_code=403, detail="Forbidden")
    if b.status not in ("in_transit", "delivery_reported"):
        raise HTTPException(status_code=400, detail="Statut incompatible")

    # Contrainte : pas dans le passe
    if payload.meeting_date <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="La date de RDV ne peut pas etre dans le passe")

    # Contrainte : date posterieure a l'arrivee du vol
    if trip.arrival_date and trip.arrival_time:
        h, m = map(int, trip.arrival_time.split(":"))
        arrival_dt = datetime(
            trip.arrival_date.year, trip.arrival_date.month, trip.arrival_date.day,
            h, m, tzinfo=timezone.utc
        )
        if payload.meeting_date <= arrival_dt:
            raise HTTPException(
                status_code=400,
                detail="La date de RDV doit etre posterieure a l'arrivee du vol"
            )

    b.proposed_delivery_date = payload.meeting_date
    b.proposed_delivery_by = current_user.id
    notif_target = b.receiver_id if is_carrier else trip.carrier_id
    role_label = "transporteur" if is_carrier else "recepteur"
    await create_notification(
        db=db, user_id=notif_target, type="delivery_meeting_proposed",
        title="RDV livraison propose",
        body=f"Le {role_label} a proposé un nouveau RDV de livraison.",
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
    """L'autre partie confirme la delivery_meeting_date proposee."""
    from app.services.notif_db_service import create_notification

    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not b.proposed_delivery_date:
        raise HTTPException(status_code=400, detail="Aucune date proposee")
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_receiver = current_user.id == b.receiver_id
    if not (is_carrier or is_receiver):
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.id == b.proposed_delivery_by:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas confirmer votre propre proposition")

    b.delivery_meeting_date = b.proposed_delivery_date
    b.proposed_delivery_date = None
    b.proposed_delivery_by = None
    notif_target = b.receiver_id if is_carrier else trip.carrier_id
    await create_notification(
        db=db, user_id=notif_target, type="delivery_meeting_confirmed",
        title="RDV livraison confirme",
        body="Le RDV de livraison a été confirmé. Consultez les détails du colis.",
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
    """Reporte la livraison - max 3 fois. Au-dela le bouton est bloque cote frontend."""
    from app.services.notif_db_service import create_notification

    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_receiver = current_user.id == b.receiver_id
    if not (is_carrier or is_receiver):
        raise HTTPException(status_code=403, detail="Forbidden")
    if b.status not in ("in_transit", "delivery_reported"):
        raise HTTPException(status_code=400, detail="Statut incompatible")
    if b.delivery_reschedule_count >= 3:
        raise HTTPException(status_code=400, detail="Limite de 3 reports atteinte")

    b.proposed_delivery_date = payload.meeting_date
    b.proposed_delivery_by = current_user.id
    b.delivery_reschedule_count += 1
    b.status = "delivery_reported"
    notif_target = b.receiver_id if is_carrier else trip.carrier_id
    role_label = "transporteur" if is_carrier else "recepteur"
    await create_notification(
        db=db, user_id=notif_target, type="delivery_rescheduled",
        title="Livraison reportee",
        body=f"Le {role_label} demande un report ({b.delivery_reschedule_count}/3). Nouvelle date : {payload.meeting_date.strftime('%d/%m/%Y a %H:%M')}.",
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
    """Cas B : transporteur uploade la preuve alternative.
    Statut -> pending_admin_validation, validation manuelle admin requise.
    """
    from app.services.notif_db_service import create_notification

    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    if current_user.id != trip.carrier_id:
        raise HTTPException(status_code=403, detail="Transporteur uniquement")
    if b.status not in ("in_transit", "delivery_reported"):
        raise HTTPException(status_code=400, detail="Statut incompatible")

    b.delivery_alternative_proof_url = payload.proof_url
    b.status = "pending_admin_validation"
    await create_notification(
        db=db, user_id=b.sender_id, type="delivery_alternative_proof",
        title="Preuve alternative soumise",
        body="Le transporteur a soumis une preuve alternative de livraison. En attente de validation admin.",
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "pending_admin_validation"}


# ---------------------------------------------------------------------------
# RDV PICKUP
# ---------------------------------------------------------------------------

@router.post("/{booking_id}/propose-pickup-meeting")
async def propose_pickup_meeting(
    booking_id: str,
    payload: MeetingDateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Sender ou carrier propose une pickup_meeting_date."""
    from app.services.notif_db_service import create_notification

    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_sender = current_user.id == b.sender_id
    if not (is_carrier or is_sender):
        raise HTTPException(status_code=403, detail="Forbidden")
    if b.status != "accepted":
        raise HTTPException(status_code=400, detail="Statut incompatible")

    # Contrainte : pas dans le passe
    if payload.meeting_date <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="La date de RDV ne peut pas etre dans le passe")

    # Contrainte : au moins 3h avant le depart du vol
    if trip.departure_date and trip.departure_time:
        h, m = map(int, trip.departure_time.split(":"))
        departure_dt = datetime(
            trip.departure_date.year, trip.departure_date.month, trip.departure_date.day,
            h, m, tzinfo=timezone.utc
        )
        from datetime import timedelta
        if payload.meeting_date >= departure_dt - timedelta(hours=3):
            raise HTTPException(
                status_code=400,
                detail="La date de RDV doit etre au moins 3h avant le depart du vol"
            )

    b.proposed_pickup_date = payload.meeting_date
    b.proposed_pickup_by = current_user.id
    b.pickup_meeting_confirmed_by_sender = False
    b.pickup_meeting_confirmed_by_carrier = False
    notif_target = trip.carrier_id if is_sender else b.sender_id
    role_label = "expediteur" if is_sender else "transporteur"
    await create_notification(
        db=db, user_id=notif_target, type="pickup_meeting_proposed",
        title="RDV collecte propose",
        body=f"L'{role_label} a proposé un nouveau RDV de collecte.",
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
    """L'autre partie confirme la pickup_meeting_date proposee."""
    from app.services.notif_db_service import create_notification

    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not b.proposed_pickup_date:
        raise HTTPException(status_code=400, detail="Aucune date proposee")
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    is_carrier = current_user.id == trip.carrier_id
    is_sender = current_user.id == b.sender_id
    if not (is_carrier or is_sender):
        raise HTTPException(status_code=403, detail="Forbidden")
    if current_user.id == b.proposed_pickup_by:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas confirmer votre propre proposition")

    b.pickup_meeting_date = b.proposed_pickup_date
    b.proposed_pickup_date = None
    b.proposed_pickup_by = None
    if is_carrier:
        b.pickup_meeting_confirmed_by_carrier = True
    else:
        b.pickup_meeting_confirmed_by_sender = True

    notif_target = b.sender_id if is_carrier else trip.carrier_id
    await create_notification(
        db=db, user_id=notif_target, type="pickup_meeting_confirmed",
        title="RDV collecte confirme",
        body="Le RDV de collecte a été confirmé. Consultez les détails du colis.",
        link=f"/packages/{b.id}",
    )
    await db.commit()
    return {"status": "confirmed", "pickup_meeting_date": str(b.pickup_meeting_date)}


@router.post("/{booking_id}/generate-pickup-code")
async def generate_pickup_code(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Transporteur genere le code pickup apres avoir recupere le colis."""
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()
    if current_user.id != trip.carrier_id:
        raise HTTPException(status_code=403, detail="Transporteur uniquement")
    if b.status != "accepted":
        raise HTTPException(status_code=400, detail="Statut incompatible")
    if not b.pickup_meeting_date:
        raise HTTPException(status_code=400, detail="Aucun RDV collecte confirme")

    code, hashed = generate_and_hash_code()
    qr_token = Booking.generate_qr_token()
    b.pickup_code_hash = hashed
    b.pickup_code_plain = code
    b.pickup_qr_token = qr_token
    b.pickup_code_expires_at = code_expires_at()
    await db.commit()
    return {"booking_id": str(b.id), "code": code, "qr_token": qr_token}


@router.post("/{booking_id}/validate-pickup-code")
async def validate_pickup_code(
    booking_id: str,
    payload: ValidateDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Expediteur valide le code pickup -> statut in_transit."""
    from app.services.notif_db_service import create_notification

    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if current_user.id != b.sender_id:
        raise HTTPException(status_code=403, detail="Expediteur uniquement")
    if b.status != "accepted":
        raise HTTPException(status_code=400, detail="Statut incompatible")
    if not b.pickup_code_hash:
        raise HTTPException(status_code=400, detail="Aucun code pickup genere")
    if datetime.now(timezone.utc) > b.pickup_code_expires_at:
        raise HTTPException(status_code=400, detail="Code pickup expire")
    if not verify_code(payload.code, b.pickup_code_hash):
        raise HTTPException(status_code=400, detail="Code pickup invalide")

    # Passage en in_transit + decrement remaining_kg
    trip_res = await db.execute(select(Trip).where(Trip.id == b.trip_id))
    trip = trip_res.scalar_one_or_none()

    from app.models.package import Package
    pkg_res = await db.execute(select(Package).where(Package.id == b.package_id))
    pkg = pkg_res.scalar_one_or_none()

    b.status = "in_transit"
    b.pickup_code_plain = None
    if trip and pkg:
        trip.remaining_kg = max(0.0, trip.remaining_kg - pkg.weight_kg)

    # Notifier le recepteur
    if b.receiver_id:
        await create_notification(
            db=db, user_id=b.receiver_id, type="package_in_transit",
            title="Colis en transit",
            body="Votre colis a ete remis au transporteur et est en route.",
            link=f"/packages/{b.id}",
        )
    await db.commit()
    return {"status": "in_transit"}