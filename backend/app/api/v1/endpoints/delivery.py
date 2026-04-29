from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
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
    if booking.status != "paid":
        raise HTTPException(status_code=400, detail=t("errors.payment_required", lang))
    if current_user.id not in (booking.sender_id, booking.receiver_id):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.delivery_code_hash:
        raise HTTPException(status_code=400, detail=t("errors.delivery_code_already_generated", lang))

    code, hashed = generate_and_hash_code()
    qr_token = Booking.generate_qr_token()
    booking.delivery_code_hash = hashed
    booking.delivery_qr_token = qr_token
    booking.delivery_code_expires_at = code_expires_at()

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
