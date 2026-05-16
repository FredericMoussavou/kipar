from fastapi import APIRouter, Depends, HTTPException
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

router = APIRouter(prefix="/premium", tags=["premium"])

PLANS = {
    "monthly": {"amount": 9.99, "days": 30},
    "annual":  {"amount": 79.99, "days": 365},
}


def is_premium_active(user: User) -> bool:
    """Verifie si l'abonnement premium est actif."""
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
    """Retourne le statut premium de l'utilisateur."""
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


@router.post("/subscribe")
async def subscribe_premium(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Souscrit au plan premium via Stripe ou Flutterwave."""
    plan = payload.get("plan", "monthly")
    payment_rail = payload.get("payment_rail", "stripe")
    payment_ref = payload.get("payment_ref")  # Stripe PI id ou Flutterwave tx id

    if plan not in PLANS:
        raise HTTPException(status_code=400, detail="Plan invalide (monthly|annual)")
    if payment_rail not in ("stripe", "flutterwave"):
        raise HTTPException(status_code=400, detail="Rail invalide (stripe|flutterwave)")
    if not payment_ref:
        raise HTTPException(status_code=400, detail="Reference de paiement manquante")

    plan_data = PLANS[plan]
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=plan_data["days"])

    # Creer la souscription
    sub = Subscription(
        user_id=current_user.id,
        plan=plan,
        status="active",
        amount=plan_data["amount"],
        currency="EUR",
        payment_rail=payment_rail,
        stripe_subscription_id=payment_ref if payment_rail == "stripe" else None,
        flw_transaction_id=payment_ref if payment_rail == "flutterwave" else None,
        started_at=now,
        expires_at=expires_at,
    )
    db.add(sub)

    # Activer le premium sur l'user
    current_user.is_premium = True
    current_user.premium_plan = plan
    current_user.premium_expires_at = expires_at
    if payment_rail == "stripe":
        current_user.premium_stripe_sub_id = payment_ref
    else:
        current_user.premium_flw_sub_id = payment_ref

    await db.commit()
    await db.refresh(sub)

    return {
        "status": "active",
        "plan": plan,
        "expires_at": expires_at.isoformat(),
        "subscription_id": str(sub.id),
    }


@router.post("/cancel")
async def cancel_premium(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Annule le renouvellement automatique — acces jusqu'a expiration."""
    if not current_user.is_premium:
        raise HTTPException(status_code=400, detail="Aucun abonnement actif")

    # Marquer la sub active comme cancelled
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.user_id == current_user.id,
            Subscription.status == "active",
        )
        .order_by(Subscription.created_at.desc())
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = "cancelled"
        sub.cancelled_at = datetime.now(timezone.utc)

    # On ne coupe pas l'acces immediatement — jusqu'a expires_at
    await db.commit()

    return {
        "status": "cancelled",
        "access_until": current_user.premium_expires_at.isoformat() if current_user.premium_expires_at else None,
    }


@router.get("/limits")
async def get_user_limits(
    current_user: User = Depends(get_current_user),
):
    """Retourne les limites applicables a l'utilisateur selon son plan."""
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