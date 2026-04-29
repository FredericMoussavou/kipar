from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


class FCMTokenRequest(BaseModel):
    fcm_token: str


class LanguageRequest(BaseModel):
    language: str


@router.patch("/me/fcm-token")
async def update_fcm_token(
    payload: FCMTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enregistre le token FCM de l'appareil pour les notifications push."""
    current_user.fcm_token = payload.fcm_token
    return {"message": "Token FCM mis à jour"}


@router.patch("/me/language")
async def update_language(
    payload: LanguageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Met à jour la langue préférée de l'utilisateur."""
    from app.i18n.loader import SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE
    lang = payload.language if payload.language in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE
    current_user.language = lang
    return {"message": "Langue mise à jour", "language": lang}


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Retourne le profil de l'utilisateur connecté."""
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
