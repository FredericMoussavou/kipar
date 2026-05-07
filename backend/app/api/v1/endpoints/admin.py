from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.dispute import Dispute
from app.models.trip import Trip
from app.models.review import Review
from app.models.package_request import PackageRequest
from app.i18n.loader import t

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/disputes")
async def list_disputes(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    status: str | None = None,
):
    """Liste tous les litiges — admin uniquement."""
    query = select(Dispute)
    if status:
        query = query.where(Dispute.status == status)
    query = query.order_by(Dispute.created_at.desc())
    result = await db.execute(query)
    disputes = result.scalars().all()

    output = []
    for d in disputes:
        booking_result = await db.execute(select(Booking).where(Booking.id == d.booking_id))
        booking = booking_result.scalar_one_or_none()
        output.append({
            "id": str(d.id),
            "booking_id": str(d.booking_id),
            "status": d.status,
            "reason": d.reason,
            "resolution": d.resolution,
            "created_at": d.created_at.isoformat(),
            "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
            "booking_status": booking.status if booking else None,
            "amount": booking.amount if booking else None,
        })
    return output


@router.get("/disputes/{dispute_id}")
async def get_dispute(
    dispute_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Detail d un litige — admin uniquement."""
    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")

    booking_result = await db.execute(select(Booking).where(Booking.id == dispute.booking_id))
    booking = booking_result.scalar_one_or_none()

    sender_result = await db.execute(select(User).where(User.id == booking.sender_id)) if booking else None
    sender = sender_result.scalar_one_or_none() if sender_result else None

    initiator_result = await db.execute(select(User).where(User.id == dispute.initiated_by))
    initiator = initiator_result.scalar_one_or_none()

    return {
        "id": str(dispute.id),
        "booking_id": str(dispute.booking_id),
        "status": dispute.status,
        "reason": dispute.reason,
        "resolution": dispute.resolution,
        "created_at": dispute.created_at.isoformat(),
        "resolved_at": dispute.resolved_at.isoformat() if dispute.resolved_at else None,
        "initiated_by": initiator.full_name if initiator else None,
        "booking_status": booking.status if booking else None,
        "amount": booking.amount if booking else None,
        "pickup_failed_reason": booking.pickup_failed_reason if booking else None,
        "sender": sender.full_name if sender else None,
    }


@router.post("/disputes/{dispute_id}/resolve")
async def resolve_dispute(
    dispute_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Resout un litige — admin uniquement.
    decision: resolved_sender | resolved_carrier
    resolution: texte explicatif obligatoire
    """
    decision = payload.get("decision", "").strip()
    resolution = payload.get("resolution", "").strip()
    if decision not in ("resolved_sender", "resolved_carrier"):
        raise HTTPException(status_code=400, detail="decision must be resolved_sender or resolved_carrier")
    if not resolution:
        raise HTTPException(status_code=400, detail=t("errors.reason_required", lang))

    result = await db.execute(select(Dispute).where(Dispute.id == dispute_id))
    dispute = result.scalar_one_or_none()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if dispute.status != "open":
        raise HTTPException(status_code=400, detail="Dispute already resolved")

    booking_result = await db.execute(select(Booking).where(Booking.id == dispute.booking_id))
    booking = booking_result.scalar_one_or_none()

    dispute.status = decision
    dispute.resolution = resolution
    dispute.resolved_by = admin.id
    dispute.resolved_at = datetime.now(timezone.utc)

    if booking:
        booking.status = "cancelled" if decision == "resolved_carrier" else "disputed"

    await db.commit()
    return {"status": decision, "dispute_id": dispute_id}


@router.get("/users")
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    is_admin: bool | None = None,
):
    """Liste tous les utilisateurs — admin uniquement."""
    query = select(User).where(User.deleted_at.is_(None))
    if is_admin is not None:
        query = query.where(User.is_admin == is_admin)
    query = query.order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "kyc_status": u.kyc_status,
            "is_admin": u.is_admin,
            "trust_score": u.trust_score,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.patch("/users/{user_id}/toggle-admin")
async def toggle_admin(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Passe un utilisateur en admin ou retire le role — admin uniquement."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    await db.commit()
    return {"user_id": user_id, "is_admin": user.is_admin}


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Statistiques globales — admin uniquement."""
    users_q = await db.execute(select(func.count(User.id)).where(User.deleted_at.is_(None)))
    bookings_q = await db.execute(select(func.count(Booking.id)))
    disputes_q = await db.execute(select(func.count(Dispute.id)).where(Dispute.status == "open"))
    kyc_pending_q = await db.execute(select(func.count(User.id)).where(User.kyc_status == "pending", User.deleted_at.is_(None)))
    trips_q = await db.execute(select(func.count(Trip.id)).where(Trip.deleted_at.is_(None)))
    revenue_q = await db.execute(select(func.sum(Booking.amount)).where(Booking.status == "delivered"))

    return {
        "total_users": users_q.scalar() or 0,
        "total_bookings": bookings_q.scalar() or 0,
        "open_disputes": disputes_q.scalar() or 0,
        "kyc_pending": kyc_pending_q.scalar() or 0,
        "total_trips": trips_q.scalar() or 0,
        "total_revenue": float(revenue_q.scalar() or 0),
    }


@router.get("/users/kyc-pending")
async def list_kyc_pending(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Liste les utilisateurs avec KYC en attente."""
    result = await db.execute(
        select(User).where(
            User.kyc_status == "pending",
            User.deleted_at.is_(None),
        ).order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "username": u.username,
            "kyc_status": u.kyc_status,
            "trust_score": u.trust_score,
            "created_at": u.created_at.isoformat(),
            "id_front": None,
            "id_back": None,
            "selfie": None,
        }
        for u in users
    ]


@router.patch("/users/{user_id}/kyc")
async def update_kyc(
    user_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Approuve ou rejette le KYC d un utilisateur."""
    decision = payload.get("decision", "").strip()
    if decision not in ("verified", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be verified or rejected")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))

    user.kyc_status = decision
    if decision == "verified":
        user.trust_score = min(100.0, user.trust_score + 20.0)

    return {"user_id": user_id, "kyc_status": decision}


@router.patch("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
    lang: str = Depends(get_lang),
):
    """Bannit ou débannit un utilisateur."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))
    if user.is_admin:
        raise HTTPException(status_code=403, detail="Cannot ban an admin")

    user.is_active = not user.is_active
    return {"user_id": user_id, "is_active": user.is_active}
