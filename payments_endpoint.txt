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


@router.post("/stripe/onboard")
async def stripe_onboard_carrier(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Cree un compte Stripe Connect Express pour le transporteur."""
    import stripe
    from app.core.config import settings
    if not settings.STRIPE_SECRET_KEY:
        return {"onboarding_url": "https://sandbox.stripe.com/simulated_onboard", "simulated": True}
    try:
        if not current_user.stripe_account_id:
            account = stripe.Account.create(
                type="express",
                country="FR",
                email=current_user.email,
                capabilities={"transfers": {"requested": True}},
                metadata={"kipar_user_id": str(current_user.id)},
            )
            current_user.stripe_account_id = account.id
            await db.commit()
        link = stripe.AccountLink.create(
            account=current_user.stripe_account_id,
            refresh_url="https://kipar.app/carrier/onboard/refresh",
            return_url="https://kipar.app/carrier/onboard/complete",
            type="account_onboarding",
        )
        return {"onboarding_url": link.url, "simulated": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: object,
    db: AsyncSession = Depends(get_db),
):
    """Webhook Stripe - confirme le paiement cote serveur."""
    from fastapi import Request
    from app.core.config import settings
    from app.services.notif_db_service import create_notification
    import stripe
    if not settings.STRIPE_WEBHOOK_SECRET:
        return {"status": "webhook_disabled"}
    try:
        payload = await request.body()
        sig = request.headers.get("stripe-signature", "")
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
    if event["type"] == "payment_intent.succeeded":
        pi_id = event["data"]["object"]["id"]
        booking_id = event["data"]["object"]["metadata"].get("booking_id")
        if booking_id:
            result = await db.execute(select(Booking).where(Booking.id == booking_id))
            booking = result.scalar_one_or_none()
            if booking and booking.status == "accepted":
                booking.status = "paid"
                booking.paid_at = datetime.now(timezone.utc)
                await db.commit()
                await create_notification(
                    db=db, user_id=booking.sender_id,
                    type="payment_confirmed",
                    title="Paiement confirme",
                    body="Votre paiement a ete confirme.",
                    link=f"/packages/{booking.id}",
                )
                await db.commit()
    return {"status": "ok"}


@router.post("/flutterwave/webhook")
async def flutterwave_webhook(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Webhook Flutterwave - confirme le paiement cote serveur."""
    from app.services.flutterwave_service import verify_transaction
    from app.services.notif_db_service import create_notification
    if payload.get("event") != "charge.completed":
        return {"status": "ignored"}
    tx_ref = payload.get("data", {}).get("tx_ref", "")
    booking_id = tx_ref.replace("kipar_", "") if tx_ref.startswith("kipar_") else None
    if not booking_id:
        return {"status": "ignored"}
    transaction_id = str(payload.get("data", {}).get("id", ""))
    verified = await verify_transaction(transaction_id)
    if not verified:
        raise HTTPException(status_code=400, detail="Transaction verification failed")
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if booking and booking.status == "accepted":
        booking.status = "paid"
        booking.paid_at = datetime.now(timezone.utc)
        await db.commit()
        await create_notification(
            db=db, user_id=booking.sender_id,
            type="payment_confirmed",
            title="Paiement confirme",
            body="Votre paiement Mobile Money a ete confirme.",
            link=f"/packages/{booking.id}",
        )
        await db.commit()
    return {"status": "ok"}


@router.post("/{booking_id}/refund")
async def refund_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Declenche le remboursement reel selon le rail de paiement."""
    import stripe
    from app.core.config import settings
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status not in ("cancelled", "cancelled_by_sender", "cancelled_by_carrier", "refunded"):
        raise HTTPException(status_code=400, detail="Booking must be cancelled to refund")
    if not booking.escrow_ref:
        raise HTTPException(status_code=400, detail=t("errors.payment_not_initiated", lang))
    refund_amount = booking.amount
    if booking.cancellation_justified:
        refund_amount = booking.amount
    elif booking.status == "cancelled_by_sender":
        from datetime import date, timedelta
        trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
        trip = trip_r.scalar_one_or_none()
        if trip and trip.departure_date:
            hours_until = (trip.departure_date - date.today()).days * 24
            if hours_until > settings.LATE_CANCEL_HOURS:
                refund_amount = booking.amount * (1 - settings.SERVICE_FEE_SENDER_PERCENT)
            else:
                refund_amount = 0.0
    success = False
    if booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated"):
        try:
            stripe.Refund.create(
                payment_intent=booking.escrow_ref,
                amount=int(refund_amount * 100),
            )
            success = True
        except stripe.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))
    elif booking.payment_rail == "flutterwave":
        import httpx
        from app.core.config import settings
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"https://api.flutterwave.com/v3/transactions/{booking.escrow_ref}/refund",
                headers={"Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}"},
                json={"amount": refund_amount},
            )
            success = res.json().get("status") == "success"
    else:
        success = True
    if success:
        booking.status = "refunded"
        await db.commit()
        from app.services.notif_db_service import create_notification
        await create_notification(
            db=db, user_id=booking.sender_id,
            type="payment_refunded",
            title="Remboursement effectue",
            body=f"Votre remboursement de {refund_amount:.2f}EUR a ete traite.",
            link=f"/packages/{booking.id}",
        )
        await db.commit()
    return {"status": "refunded" if success else "failed", "amount": refund_amount}


@router.post("/{booking_id}/carrier-penalty")
async def charge_carrier_cancellation_penalty(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Preleve les frais annulation (5% min 5EUR) sur le compte Stripe du transporteur."""
    import stripe
    from app.core.config import settings
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking or booking.status != "cancelled_by_carrier":
        raise HTTPException(status_code=400, detail="Booking must be cancelled_by_carrier")
    if booking.cancellation_justified:
        raise HTTPException(status_code=400, detail="Cancellation is justified - no penalty")
    trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_r.scalar_one_or_none()
    carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
    carrier = carrier_r.scalar_one_or_none()
    penalty = max(
        booking.amount * settings.CARRIER_CANCEL_FEE_PERCENT,
        settings.CARRIER_CANCEL_FEE_MIN
    )
    if carrier and carrier.stripe_account_id and not carrier.stripe_account_id.startswith("simulated"):
        try:
            stripe.Transfer.create(
                amount=-int(penalty * 100),
                currency="eur",
                destination=carrier.stripe_account_id,
                description=f"Penalite annulation booking {booking_id}",
            )
        except stripe.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))
    return {"status": "penalty_charged", "amount": penalty, "carrier_id": str(carrier.id)}
