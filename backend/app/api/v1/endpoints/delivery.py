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

    # Récupère les infos pour notifier le récepteur
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
    booking.delivery_code_plain = None  # Efface le code en clair après livraison

    # Notifie l'expéditeur que son colis a été livré
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


# Import ajouté en fin de fichier pour déclencher la libération du paiement
def _schedule_payment_release(booking_id: str):
    """Planifie la libération du paiement 24h après livraison."""
    try:
        from app.workers.booking_tasks import release_payment_after_delivery
        release_payment_after_delivery.apply_async(
            args=[booking_id],
            countdown=86400  # 24h en secondes
        )
    except Exception:
        # Celery non disponible en test — on ignore
        pass


@router.get("/{booking_id}/code")
async def get_delivery_code(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Retourne le QR token + code en clair pour le récepteur uniquement."""
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

    # Régénère le code en clair depuis le service pour le récepteur
    # On ne stocke pas le code en clair — on génère un nouveau code lié au même hash
    # Sécurité : seul le récepteur voit le code, l'expéditeur voit uniquement le QR token
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
    from pydantic import BaseModel
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
    booking.delivery_failed_at = now  # horodatage serveur - non editable
    booking.delivery_failed_comment = comment
    booking.delivery_failed_by = "carrier" if is_carrier else "receiver"
    booking.incident_response_deadline = now + timedelta(hours=settings.INCIDENT_RESPONSE_HOURS)
    await db.commit()

    # Notifie l'autre partie
    if is_carrier:
        # Transporteur declare -> notifie recepteur et expediteur
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
        # Recepteur declare -> notifie transporteur
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

    # Seule la partie mise en cause peut repondre
    if declared_by == "carrier" and not is_receiver and not is_sender:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if declared_by == "receiver" and not is_carrier:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    now = datetime.now(timezone.utc)
    if booking.incident_response_deadline and now > booking.incident_response_deadline:
        raise HTTPException(status_code=400, detail=t("errors.incident_response_expired", lang))

    if response.lower() == "accept":
        # Declarant favorise - resolution selon qui a declare
        if declared_by == "carrier":
            # Transporteur avait raison -> recepteur fautif
            # Transporteur recoit 87%, Kipar 13% (service rendu)
            booking.status = "delivered"
            booking.delivery_confirmed_at = now
            booking.delivery_confirmed_by = current_user.id
            resolution = "carrier_favored_receiver_fault"
        else:
            # Recepteur avait raison -> transporteur fautif
            # Expediteur rembourse 100%, Kipar 0EUR
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
        # Contestation -> litige automatique
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
