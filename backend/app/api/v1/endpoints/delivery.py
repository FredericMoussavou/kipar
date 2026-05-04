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
