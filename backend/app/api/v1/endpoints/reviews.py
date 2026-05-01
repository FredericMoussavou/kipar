from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel, field_validator
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.review import Review
from app.services.trust_service import update_trust_score
from app.i18n.loader import t

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    booking_id: uuid.UUID
    reviewed_id: uuid.UUID
    score: float
    comment: str | None = None

    @field_validator("score")
    @classmethod
    def valid_score(cls, v: float) -> float:
        if not 1.0 <= v <= 5.0:
            raise ValueError("Score entre 1.0 et 5.0")
        return round(v, 1)


class ReviewResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewed_id: uuid.UUID
    score: float
    comment: str | None

    model_config = {"from_attributes": True}


class ReviewerInfo(BaseModel):
    id: uuid.UUID
    display_name: str  # "Prénom I." (RGPD)
    avatar_url: str | None


class ReviewWithReviewer(BaseModel):
    id: uuid.UUID
    score: float
    comment: str | None
    created_at: datetime
    reviewer: ReviewerInfo


class ReviewListResponse(BaseModel):
    items: list[ReviewWithReviewer]
    total: int
    avg_score: float | None


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
    if booking.status != "delivered":
        raise HTTPException(status_code=400, detail=t("errors.review_booking_not_delivered", lang))
    if current_user.id not in (booking.sender_id, booking.receiver_id):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    result = await db.execute(
        select(Review).where(
            Review.booking_id == payload.booking_id,
            Review.reviewer_id == current_user.id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=t("errors.review_already_submitted", lang))

    review = Review(
        booking_id=payload.booking_id,
        reviewer_id=current_user.id,
        reviewed_id=payload.reviewed_id,
        score=payload.score,
        comment=payload.comment,
    )
    db.add(review)
    await db.flush()

    result = await db.execute(select(User).where(User.id == payload.reviewed_id))
    reviewed_user = result.scalar_one_or_none()
    if reviewed_user:
        await update_trust_score(reviewed_user, db)

    return review


@router.get("/user/{user_id}", response_model=ReviewListResponse)
async def list_user_reviews(
    user_id: uuid.UUID,
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste paginée des avis reçus par un utilisateur, format reviewer 'Prénom I.' (RGPD)."""
    # Total + moyenne (1 seule requête)
    agg_q = await db.execute(
        select(func.count(Review.id), func.avg(Review.score)).where(
            Review.reviewed_id == user_id
        )
    )
    total, avg_score = agg_q.one()
    total = total or 0
    avg_score = round(avg_score, 1) if avg_score is not None else None

    # JOIN manuel (Review n'a pas de relationship 'reviewer')
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