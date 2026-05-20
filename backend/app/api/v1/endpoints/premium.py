from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.core.config import settings
from app.models.user import User
from app.models.subscription import Subscription
from app.i18n.loader import t
import stripe

router = APIRouter(prefix="/premium", tags=["premium"])

PLANS = {
    "monthly": {"amount": 9.99, "days": 30,  "price_id": "price_1TYycv6bYbTmQJgWw6IMu3VN"},
    "annual":  {"amount": 79.99, "days": 365, "price_id": "price_1TYykl6bYbTmQJgW3kLo8kc4"},
}

SUCCESS_URL = f"{settings.FRONTEND_URL}/premium/success"
CANCEL_URL  = f"{settings.FRONTEND_URL}/premium"


def is_premium_active(user: User) -> bool:
    if not user.is_premium:
        return False
    if user.premium_expires_at and user.premium_expires_at < datetime.now(timezone.utc):
        return False
    return True


@router.get("/status")
async def get_premium_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    active = is_premium_active(current_user)
    subs_result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    subs = subs_result.scalars().all()
    return {
        "is_premium": active,
        "plan": current_user.premium_plan,
        "expires_at": current_user.premium_expires_at.isoformat() if current_user.premium_expires_at else None,
        "history": [
            {
                "id": str(s.id),
                "plan": s.plan,
                "status": s.status,
                "amount": s.amount,
                "currency": s.currency,
                "payment_rail": s.payment_rail,
                "started_at": s.started_at.isoformat(),
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            }
            for s in subs
        ],
    }


@router.post("/create-checkout-session")
async def create_checkout_session(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = payload.get("plan", "monthly")
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Plan invalide (monthly|annual)")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Creer ou recuperer le customer Stripe
    customer_id = getattr(current_user, "stripe_customer_id", None)
    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=f"{current_user.first_name} {current_user.last_name}".strip(),
            metadata={"user_id": str(current_user.id)},
        )
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        await db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": PLANS[plan]["price_id"], "quantity": 1}],
        mode="subscription",
        success_url=SUCCESS_URL + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=CANCEL_URL,
        metadata={"user_id": str(current_user.id), "plan": plan},
        subscription_data={"metadata": {"user_id": str(current_user.id), "plan": plan}},
    )

    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature webhook invalide")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")
        plan = session["metadata"].get("plan", "monthly")
        stripe_sub_id = session.get("subscription")

        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user:
                plan_data = PLANS.get(plan, PLANS["monthly"])
                now = datetime.now(timezone.utc)
                expires_at = now + timedelta(days=plan_data["days"])

                sub = Subscription(
                    user_id=user.id,
                    plan=plan,
                    status="active",
                    amount=plan_data["amount"],
                    currency="EUR",
                    payment_rail="stripe",
                    stripe_subscription_id=stripe_sub_id,
                    started_at=now,
                    expires_at=expires_at,
                )
                db.add(sub)

                user.is_premium = True
                user.premium_plan = plan
                user.premium_expires_at = expires_at
                user.premium_stripe_sub_id = stripe_sub_id
                await db.commit()

    elif event["type"] == "customer.subscription.deleted":
        sub_obj = event["data"]["object"]
        stripe_sub_id = sub_obj["id"]

        result = await db.execute(
            select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
        )
        sub = result.scalar_one_or_none()
        if sub:
            sub.status = "cancelled"
            sub.cancelled_at = datetime.now(timezone.utc)

            result2 = await db.execute(select(User).where(User.id == sub.user_id))
            user = result2.scalar_one_or_none()
            if user:
                user.is_premium = False
                user.premium_plan = None
                user.premium_stripe_sub_id = None
            await db.commit()

    return {"status": "ok"}


@router.post("/cancel")
async def cancel_premium(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_premium:
        raise HTTPException(status_code=400, detail="Aucun abonnement actif")

    stripe.api_key = settings.STRIPE_SECRET_KEY

    # Annuler le renouvellement Stripe en fin de periode
    if current_user.premium_stripe_sub_id:
        try:
            stripe.Subscription.modify(
                current_user.premium_stripe_sub_id,
                cancel_at_period_end=True,
            )
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=f"Erreur Stripe : {str(e)}")

    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id, Subscription.status == "active")
        .order_by(Subscription.created_at.desc())
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = "cancelled"
        sub.cancelled_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "status": "cancelled",
        "access_until": current_user.premium_expires_at.isoformat() if current_user.premium_expires_at else None,
    }


@router.get("/limits")
async def get_user_limits(current_user: User = Depends(get_current_user)):
    premium = is_premium_active(current_user)
    return {
        "is_premium": premium,
        "active_bookings_limit": None if premium else 3,
        "active_trips_limit": None if premium else 2,
        "active_requests_limit": None if premium else 2,
        "photos_per_package": 5 if premium else 2,
        "kiparscan_monthly_free": None if premium else 3,
        "flight_tracking": premium,
        "arrival_reminder": premium,
        "finance_export": premium,
        "premium_badge": premium,
        "full_review_history": premium,
        "priority_support": premium,
    }
