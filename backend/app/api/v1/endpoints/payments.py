from app.core.rate_limit import limiter
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.schemas.payment import PaymentIntentResponse, PawapayPaymentResponse
from app.services.stripe_service import create_payment_intent, capture_payment_intent, release_payment_to_carrier
from app.services.pawapay_service import initiate_deposit, initiate_refund, initiate_payout, check_deposit_status

EUR_CFA_RATE = 655.957  # taux fixe EUR -> XAF/XOF (arrimage CFA)
from app.i18n.loader import t
from app.services.notif_db_service import notify_carrier_booking_payable

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/{booking_id}/stripe", response_model=PaymentIntentResponse)
@limiter.limit("3/minute")
async def initiate_stripe_payment(
    request: Request,
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
    if booking.status not in ("pending", "accepted", "awaiting_receiver"):
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
    booking.status = "paid"
    await db.commit()

    return PaymentIntentResponse(
        booking_id=booking.id,
        client_secret=intent["client_secret"],
        amount=booking.amount,
        currency="EUR",
        payment_rail="stripe",
    )


@router.post("/{booking_id}/pawapay", response_model=PawapayPaymentResponse)
@limiter.limit("3/minute")
async def initiate_pawapay_payment(
    request: Request,
    booking_id: str,
    phone: str,
    provider: str,
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
    if booking.status not in ("pending", "accepted", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail=t("errors.booking_not_accepted", lang))

    # PawaPay limite aux devises CFA (taux fixe EUR, pas de risque de change)
    if currency not in ("XAF", "XOF"):
        raise HTTPException(status_code=400, detail=t("errors.pawapay_error", lang))
    amount_cfa = round(booking.amount * EUR_CFA_RATE)
    # Sanitisation : chiffres uniquement, sans '+' ni prefixe 00
    phone_clean = "".join(ch for ch in phone if ch.isdigit())
    if phone_clean.startswith("00"):
        phone_clean = phone_clean[2:]
    pawapay_response = await initiate_deposit(
        amount=amount_cfa,
        currency=currency,
        phone=phone_clean,
        provider=provider,
        booking_id=str(booking.id),
    )

    if pawapay_response.get("status") not in ("ACCEPTED", "COMPLETED"):
        raise HTTPException(status_code=400, detail=t("errors.pawapay_error", lang))

    booking.escrow_ref = pawapay_response["depositId"]
    booking.payment_rail = "pawapay"
    # Le statut 'paid' n'est pose qu'au COMPLETED verifie (webhook/polling)

    # Sauvegarder phone + provider sur le profil expediteur pour futurs paiements
    if phone_clean and not current_user.mobile_money_number:
        current_user.mobile_money_number = phone_clean
    if provider and not current_user.mobile_money_provider:
        current_user.mobile_money_provider = provider

    await db.commit()

    return PawapayPaymentResponse(
        booking_id=booking.id,
        deposit_id=pawapay_response["depositId"],
        amount=amount_cfa,
        currency=currency,
        payment_rail="pawapay",
        status=pawapay_response.get("status", "ACCEPTED"),
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

    if booking.payment_rail == "stripe":
        import stripe
        from app.core.config import settings
        if settings.STRIPE_SECRET_KEY and not booking.escrow_ref.startswith("pi_simulated"):
            try:
                intent = stripe.PaymentIntent.retrieve(booking.escrow_ref)
                if intent.status not in ("requires_capture", "succeeded"):
                    raise HTTPException(status_code=400, detail=t("errors.payment_capture_failed", lang))
            except stripe.StripeError as e:
                raise HTTPException(status_code=400, detail=str(e))
    elif booking.payment_rail == "pawapay":
        # Verification reelle aupres de PawaPay (source de verite)
        check = await check_deposit_status(booking.escrow_ref)
        dep_status = (check.get("data") or {}).get("status")
        if dep_status == "FAILED":
            await _apply_pawapay_final_status(db, booking, "FAILED")
            await db.commit()
            raise HTTPException(status_code=400, detail=t("errors.pawapay_error", lang))
        if dep_status != "COMPLETED":
            return {"message": "processing", "status": "processing"}
        await _apply_pawapay_final_status(db, booking, "COMPLETED")
        await db.commit()
        return {"message": t("notifications.payment_confirmed", lang), "status": "completed"}

    if booking.status != "paid":
        booking.status = "paid"
    if not booking.paid_at:
        booking.paid_at = datetime.now(timezone.utc)

    # Notif transporteur : reservation payee = acceptable (Stripe ; PawaPay au webhook COMPLETED)
    if not booking.package_request_id and booking.payment_rail != "pawapay":
        await notify_carrier_booking_payable(db, booking)

    # Flux request : booking issu d'accept_application -> capture + accepted automatique
    if booking.package_request_id:
        if booking.payment_rail == "stripe" and booking.escrow_ref and not booking.escrow_ref.startswith("pi_simulated"):
            from app.core.config import settings as s
            if s.STRIPE_SECRET_KEY:
                captured = await capture_payment_intent(booking.escrow_ref)
                if not captured:
                    raise HTTPException(status_code=400, detail=t("errors.payment_capture_failed", lang))
        booking.status = "accepted"
        booking.accepted_at = datetime.now(timezone.utc)
        booking.booking_fee_collected = True

    await db.commit()

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
        # Ce webhook est declenche apres capture reelle
        # La capture est deja faite dans accept_booking - on met juste a jour paid_at
        booking_id = event["data"]["object"]["metadata"].get("booking_id")
        if booking_id:
            result = await db.execute(select(Booking).where(Booking.id == booking_id))
            booking = result.scalar_one_or_none()
            if booking and booking.status == "accepted" and not booking.paid_at:
                booking.paid_at = datetime.now(timezone.utc)
                await db.commit()
    return {"status": "ok"}


async def _apply_pawapay_final_status(db: AsyncSession, booking: Booking, status: str) -> None:
    """Applique le statut final verifie d'un deposit PawaPay. Idempotent.

    COMPLETED : paid_at + statut + notifs (+ flux request).
    FAILED    : reset escrow_ref/payment_rail pour permettre une nouvelle tentative.
    Le commit est a la charge de l'appelant.
    """
    from app.services.notif_db_service import create_notification
    if status == "COMPLETED":
        if booking.paid_at:
            return
        booking.paid_at = datetime.now(timezone.utc)
        if booking.status == "pending":
            booking.status = "paid"
        if booking.package_request_id:
            booking.status = "accepted"
            booking.accepted_at = datetime.now(timezone.utc)
            booking.booking_fee_collected = True
        await create_notification(
            db=db, user_id=booking.sender_id,
            type="payment_confirmed",
            title="Paiement confirme",
            body="Votre paiement Mobile Money a ete confirme.",
            link=f"/packages/{booking.id}",
        )
        if not booking.package_request_id:
            await notify_carrier_booking_payable(db, booking)
    elif status == "FAILED":
        if booking.paid_at:
            return
        if booking.status == "paid":
            booking.status = "pending"
        booking.escrow_ref = None
        booking.payment_rail = None


@router.get("/{booking_id}/pawapay/status")
async def pawapay_payment_status(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Statut du deposit PawaPay - polle par le front apres initiation."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.payment_rail != "pawapay" or not booking.escrow_ref:
        raise HTTPException(status_code=400, detail=t("errors.payment_not_initiated", lang))
    check = await check_deposit_status(booking.escrow_ref)
    dep_status = (check.get("data") or {}).get("status") or "UNKNOWN"
    if dep_status in ("COMPLETED", "FAILED"):
        await _apply_pawapay_final_status(db, booking, dep_status)
        await db.commit()
    return {"status": dep_status}


@router.post("/pawapay/webhook")
async def pawapay_webhook(
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """Webhook PawaPay - le payload n'est jamais cru sur parole.

    Le statut est re-verifie aupres de PawaPay (check_deposit_status)
    avant toute action : un POST forge ne peut pas confirmer un paiement.
    """
    deposit_id = payload.get("depositId", "")
    if not deposit_id:
        return {"status": "ignored"}
    result = await db.execute(select(Booking).where(Booking.escrow_ref == deposit_id))
    booking = result.scalar_one_or_none()
    if not booking or booking.payment_rail != "pawapay":
        return {"status": "ignored"}
    check = await check_deposit_status(deposit_id)
    verified = (check.get("data") or {}).get("status")
    if verified not in ("COMPLETED", "FAILED"):
        return {"status": "ignored"}
    await _apply_pawapay_final_status(db, booking, verified)
    await db.commit()
    return {"status": "ok"}


@router.post("/{booking_id}/release")
async def release_payment(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Libere le paiement vers le transporteur apres livraison confirmee."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.status != "delivered":
        raise HTTPException(status_code=400, detail=t("errors.booking_not_delivered", lang))
    if not booking.escrow_ref:
        raise HTTPException(status_code=400, detail=t("errors.payment_not_initiated", lang))

    trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_r.scalar_one_or_none()
    carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
    carrier = carrier_r.scalar_one_or_none()

    from app.services.payout_service import record_and_release_payout
    entry = await record_and_release_payout(db, booking, carrier)
    # entry=None => deja verse precedemment (idempotence)
    paid = entry is None or entry.status == "paid"
    if paid:
        from app.services.notif_db_service import create_notification
        await create_notification(
            db=db, user_id=booking.carrier_id,
            type="payment_released",
            title="Paiement recu",
            body=f"Le paiement de {booking.amount:.2f} EUR a ete libere.",
            link=f"/packages/{booking.id}",
        )
    await db.commit()
    if entry is None:
        return {"status": "already_released", "amount": booking.amount}
    return {"status": entry.status, "reason": entry.failure_reason, "amount": booking.amount}


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
