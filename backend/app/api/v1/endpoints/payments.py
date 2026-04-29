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
from app.schemas.payment import PaymentIntentResponse, FlutterwavePaymentResponse
from app.services.stripe_service import create_payment_intent, capture_payment_intent
from app.services.flutterwave_service import create_payment_link, verify_transaction
from app.i18n.loader import t

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/{booking_id}/stripe", response_model=PaymentIntentResponse)
async def initiate_stripe_payment(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status != "accepted":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_accepted", lang))

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    result = await db.execute(select(User).where(User.id == trip.carrier_id))
    carrier = result.scalar_one_or_none()

    intent = await create_payment_intent(
        amount_eur=booking.amount,
        booking_id=str(booking.id),
        carrier_stripe_account=carrier.stripe_account_id,
    )

    booking.escrow_ref = intent["id"]
    booking.payment_rail = "stripe"

    return PaymentIntentResponse(
        booking_id=booking.id,
        client_secret=intent["client_secret"],
        amount=booking.amount,
        currency="EUR",
        payment_rail="stripe",
    )


@router.post("/{booking_id}/flutterwave", response_model=FlutterwavePaymentResponse)
async def initiate_flutterwave_payment(
    booking_id: str,
    currency: str = "XOF",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status != "accepted":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_accepted", lang))

    flw_response = await create_payment_link(
        amount=booking.amount,
        currency=currency,
        booking_id=str(booking.id),
        customer_email=current_user.email,
    )

    if flw_response.get("status") != "success":
        raise HTTPException(status_code=400, detail=t("errors.flutterwave_error", lang))

    booking.escrow_ref = flw_response["data"]["tx_ref"]
    booking.payment_rail = "flutterwave"

    return FlutterwavePaymentResponse(
        booking_id=booking.id,
        payment_link=flw_response["data"]["link"],
        amount=booking.amount,
        currency=currency,
        payment_rail="flutterwave",
    )


@router.post("/{booking_id}/confirm", response_model=dict)
async def confirm_payment(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if not booking.escrow_ref:
        raise HTTPException(status_code=400, detail=t("errors.payment_not_initiated", lang))

    success = False
    if booking.payment_rail == "stripe":
        success = await capture_payment_intent(booking.escrow_ref)
    elif booking.payment_rail == "flutterwave":
        success = await verify_transaction(booking.escrow_ref)

    if not success:
        raise HTTPException(status_code=400, detail=t("errors.payment_capture_failed", lang))

    booking.status = "paid"
    booking.paid_at = datetime.now(timezone.utc)

    return {"message": t("notifications.payment_confirmed", lang)}
