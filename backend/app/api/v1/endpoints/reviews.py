from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel, field_validator, model_validator
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.review import Review
from app.models.trip import Trip
from app.services.trust_service import update_trust_score
from app.i18n.loader import t

router = APIRouter(prefix="/reviews", tags=["reviews"])

CRITERIA_BY_ROLE = {
    "sender_to_carrier": ["ponctualite", "communication", "soin_colis", "conformite"],
    "carrier_to_sender": ["communication", "colis_prepare", "ponctualite_depot", "serieux"],
    "carrier_to_receiver": ["disponibilite", "ponctualite_remise", "communication"],
    "receiver_to_carrier": ["ponctualite", "communication", "soin_colis", "professionnalisme"],
}


class ReviewCreate(BaseModel):
    booking_id: uuid.UUID
    reviewed_id: uuid.UUID
    criteria: dict  # {"ponctualite": 4, "communication": 5, ...}
    comment: str | None = None

    @model_validator(mode="after")
    def validate_criteria_scores(self) -> "ReviewCreate":
        for k, v in self.criteria.items():
            if not isinstance(v, (int, float)) or not 1 <= v <= 5:
                raise ValueError(f"Critere {k}: score entre 1 et 5")
        return self


class ReviewResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewed_id: uuid.UUID
    score: float
    criteria: dict | None
    reviewer_role: str | None
    comment: str | None
    model_config = {"from_attributes": True}


class ReviewerInfo(BaseModel):
    id: uuid.UUID
    display_name: str
    avatar_url: str | None


class ReviewWithReviewer(BaseModel):
    id: uuid.UUID
    score: float
    criteria: dict | None
    reviewer_role: str | None
    comment: str | None
    created_at: datetime
    reviewer: ReviewerInfo


class ReviewListResponse(BaseModel):
    items: list[ReviewWithReviewer]
    total: int
    avg_score: float | None


def _determine_role(current_user_id: uuid.UUID, booking: Booking, trip: Trip | None, reviewed_id: uuid.UUID) -> str | None:
    carrier_id = trip.carrier_id if trip else None
    if current_user_id == booking.sender_id and reviewed_id == carrier_id:
        return "sender_to_carrier"
    if current_user_id == carrier_id and reviewed_id == booking.sender_id:
        return "carrier_to_sender"
    if current_user_id == carrier_id and reviewed_id == booking.receiver_id:
        return "carrier_to_receiver"
    if current_user_id == booking.receiver_id and reviewed_id == carrier_id:
        return "receiver_to_carrier"
    return None


def _can_review(current_user_id: uuid.UUID, booking: Booking, trip: Trip | None, reviewed_id: uuid.UUID) -> bool:
    carrier_id = trip.carrier_id if trip else None
    status = booking.status
    # delivered : tous peuvent noter
    if status == "delivered":
        return _determine_role(current_user_id, booking, trip, reviewed_id) is not None
    # cancelled_by_carrier : expediteur et recepteur notent le transporteur
    if status == "cancelled_by_carrier":
        return current_user_id in (booking.sender_id, booking.receiver_id) and reviewed_id == carrier_id
    # cancelled_by_sender : transporteur note l'expediteur
    if status == "cancelled_by_sender":
        return current_user_id == carrier_id and reviewed_id == booking.sender_id
    return False


@router.post("", response_model=ReviewResponse, status_code=201)
async def create_review(
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == payload.booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()

    if not _can_review(current_user.id, booking, trip, payload.reviewed_id):
        raise HTTPException(status_code=403, detail=t("errors.review_not_allowed", lang))

    existing = await db.execute(
        select(Review).where(
            Review.booking_id == payload.booking_id,
            Review.reviewer_id == current_user.id,
            Review.reviewed_id == payload.reviewed_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=t("errors.review_already_submitted", lang))

    role = _determine_role(current_user.id, booking, trip, payload.reviewed_id)
    expected = CRITERIA_BY_ROLE.get(role or "", [])
    missing = [c for c in expected if c not in payload.criteria]
    if missing:
        raise HTTPException(status_code=422, detail=f"Criteres manquants: {missing}")

    avg = round(sum(payload.criteria.values()) / len(payload.criteria), 2)

    review = Review(
        booking_id=payload.booking_id,
        reviewer_id=current_user.id,
        reviewed_id=payload.reviewed_id,
        score=avg,
        criteria=payload.criteria,
        reviewer_role=role,
        comment=payload.comment,
    )
    db.add(review)
    await db.flush()

    reviewed_user_res = await db.execute(select(User).where(User.id == payload.reviewed_id))
    reviewed_user = reviewed_user_res.scalar_one_or_none()
    if reviewed_user:
        await update_trust_score(reviewed_user, db)

    return review


@router.get("/user/{user_id}", response_model=ReviewListResponse)
async def list_user_reviews(
    user_id: uuid.UUID,
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    agg_q = await db.execute(
        select(func.count(Review.id), func.avg(Review.score)).where(
            Review.reviewed_id == user_id
        )
    )
    total, avg_score = agg_q.one()
    total = total or 0
    avg_score = round(avg_score, 1) if avg_score is not None else None

    rows_q = await db.execute(
        select(Review, User)
        .join(User, Review.reviewer_id == User.id)
        .where(Review.reviewed_id == user_id)
        .order_by(desc(Review.created_at))
        .limit(limit)
        .offset(offset)
    )
    rows = rows_q.all()

    items = []
    for review, reviewer in rows:
        last_initial = (reviewer.last_name[0].upper() + ".") if reviewer.last_name else ""
        display_name = f"{reviewer.first_name} {last_initial}".strip()
        items.append(
            ReviewWithReviewer(
                id=review.id,
                score=review.score,
                criteria=review.criteria,
                reviewer_role=review.reviewer_role,
                comment=review.comment,
                created_at=review.created_at,
                reviewer=ReviewerInfo(
                    id=reviewer.id,
                    display_name=display_name,
                    avatar_url=reviewer.avatar_url,
                ),
            )
        )

    return ReviewListResponse(items=items, total=total, avg_score=avg_score)


@router.get("/booking/{booking_id}/can-review", response_model=dict)
async def can_review_booking(
    booking_id: uuid.UUID,
    reviewed_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retourne si l'utilisateur peut noter, et les critères attendus."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        return {"can_review": False, "criteria": [], "already_reviewed": False}

    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()

    can = _can_review(current_user.id, booking, trip, reviewed_id)
    role = _determine_role(current_user.id, booking, trip, reviewed_id)
    criteria = CRITERIA_BY_ROLE.get(role or "", [])

    existing = await db.execute(
        select(Review).where(
            Review.booking_id == booking_id,
            Review.reviewer_id == current_user.id,
            Review.reviewed_id == reviewed_id,
        )
    )
    already = existing.scalar_one_or_none() is not None

    return {"can_review": can and not already, "criteria": criteria, "role": role, "already_reviewed": already}
