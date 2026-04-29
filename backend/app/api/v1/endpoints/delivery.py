from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.booking import Booking
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

router = APIRouter(prefix="/delivery", tags=["delivery"])


@router.post("/{booking_id}/generate-code", response_model=DeliveryCodeResponse)
async def generate_delivery_code(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Génère le code de remise après paiement.
    Appelé automatiquement après confirmation du paiement.
    Seul le récepteur ou l'expéditeur peut le déclencher.
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    if booking.status != "paid":
        raise HTTPException(status_code=400, detail="Le paiement doit être confirmé")
    if current_user.id not in (booking.sender_id, booking.receiver_id):
        raise HTTPException(status_code=403, detail="Non autorisé")

    # Génère le code seulement s'il n'existe pas encore
    if booking.delivery_code_hash:
        raise HTTPException(status_code=400, detail="Code déjà généré")

    code, hashed = generate_and_hash_code()
    qr_token = Booking.generate_qr_token()

    booking.delivery_code_hash = hashed
    booking.delivery_qr_token = qr_token
    booking.delivery_code_expires_at = code_expires_at()

    return DeliveryCodeResponse(
        booking_id=booking.id,
        code=code,
        qr_token=qr_token,
    )


@router.post("/{booking_id}/validate", response_model=dict)
async def validate_delivery(
    booking_id: str,
    payload: ValidateDeliveryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Le transporteur saisit le code donné par le récepteur.
    Valide la livraison et déclenche la libération du paiement.
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    if booking.status != "in_transit":
        raise HTTPException(status_code=400, detail="Le colis doit être en transit")
    if not booking.delivery_code_hash:
        raise HTTPException(status_code=400, detail="Aucun code de remise généré")

    # Vérifie l'expiration
    if datetime.now(timezone.utc) > booking.delivery_code_expires_at:
        raise HTTPException(status_code=400, detail="Code expiré")

    # Vérifie le code
    if not verify_code(payload.code, booking.delivery_code_hash):
        raise HTTPException(status_code=400, detail="Code incorrect")

    booking.status = "delivered"
    booking.delivery_confirmed_at = datetime.now(timezone.utc)
    booking.delivery_confirmed_by = current_user.id

    # TODO: déclencher Celery task pour libérer le paiement sous 24h

    return {"message": "Livraison confirmée — paiement en cours de libération"}


@router.post("/{booking_id}/validate-qr", response_model=dict)
async def validate_delivery_qr(
    booking_id: str,
    payload: ValidateDeliveryQRRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Option secondaire — validation par QR token."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    if booking.status != "in_transit":
        raise HTTPException(status_code=400, detail="Le colis doit être en transit")
    if booking.delivery_qr_token != payload.qr_token:
        raise HTTPException(status_code=400, detail="QR token invalide")

    booking.status = "delivered"
    booking.delivery_confirmed_at = datetime.now(timezone.utc)
    booking.delivery_confirmed_by = current_user.id

    return {"message": "Livraison confirmée via QR — paiement en cours de libération"}
