from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.review import Review
from app.i18n.loader import t, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE

router = APIRouter(prefix="/users", tags=["users"])


class FCMTokenRequest(BaseModel):
    fcm_token: str


class LanguageRequest(BaseModel):
    language: str


class PublicUserResponse(BaseModel):
    """Profil public — pas d'email, pas de phone, pas de données sensibles."""
    id: uuid.UUID
    first_name: str
    last_name: str
    avatar_url: str | None
    kyc_status: str
    trust_score: float
    is_carrier: bool
    created_at: datetime
    deliveries_as_sender: int
    deliveries_as_carrier: int
    trips_count: int
    reviews_count: int
    avg_rating: float | None

    model_config = {"from_attributes": True}


@router.patch("/me/fcm-token")
async def update_fcm_token(
    payload: FCMTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    current_user.fcm_token = payload.fcm_token
    return {"message": t("success.fcm_token_updated", lang)}


@router.patch("/me/language")
async def update_language(
    payload: LanguageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    new_lang = payload.language if payload.language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE
    current_user.language = new_lang
    return {"message": t("success.language_updated", lang), "language": new_lang}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "kyc_status": current_user.kyc_status,
        "trust_score": current_user.trust_score,
        "language": current_user.language,
        "is_sender": current_user.is_sender,
        "is_carrier": current_user.is_carrier,
        "is_receiver": current_user.is_receiver,
    }


@router.get("/{user_id}", response_model=PublicUserResponse)
async def get_public_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Profil public d'un utilisateur — auth requise, données sensibles non exposées."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail=t("errors.user_not_found", lang))

    # Livraisons en tant qu'expéditeur
    sender_q = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.sender_id == user.id,
            Booking.status == "delivered",
        )
    )
    deliveries_as_sender = sender_q.scalar() or 0

    # Livraisons en tant que transporteur (via Trip.carrier_id)
    carrier_q = await db.execute(
        select(func.count(Booking.id))
        .join(Trip, Booking.trip_id == Trip.id)
        .where(
            Trip.carrier_id == user.id,
            Booking.status == "delivered",
        )
    )
    deliveries_as_carrier = carrier_q.scalar() or 0

    # Trajets postés
    trips_q = await db.execute(
        select(func.count(Trip.id)).where(Trip.carrier_id == user.id)
    )
    trips_count = trips_q.scalar() or 0

    # Avis reçus + moyenne
    reviews_q = await db.execute(
        select(func.count(Review.id), func.avg(Review.score)).where(
            Review.reviewed_id == user.id
        )
    )
    reviews_count, avg_rating = reviews_q.one()
    reviews_count = reviews_count or 0
    avg_rating = round(avg_rating, 1) if avg_rating is not None else None

    return PublicUserResponse(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        avatar_url=user.avatar_url,
        kyc_status=user.kyc_status,
        trust_score=user.trust_score,
        is_carrier=user.is_carrier,
        created_at=user.created_at,
        deliveries_as_sender=deliveries_as_sender,
        deliveries_as_carrier=deliveries_as_carrier,
        trips_count=trips_count,
        reviews_count=reviews_count,
        avg_rating=avg_rating,
    )