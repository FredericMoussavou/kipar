from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
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
