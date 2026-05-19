from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from app.services.oauth_service import verify_google_token, verify_apple_token
from app.i18n.loader import t, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES

router = APIRouter(prefix="/auth", tags=["auth"])


def get_lang_from_request(request: Request) -> str:
    header = request.headers.get("Accept-Language", DEFAULT_LANGUAGE)
    lang = header[:2].lower()
    return lang if lang in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


class OAuthRequest(BaseModel):
    id_token: str
    first_name: str | None = None
    last_name: str | None = None


class OAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool


async def _oauth_login_or_register(
    db: AsyncSession,
    provider: str,
    provider_id: str,
    email: str,
    first_name: str,
    last_name: str,
    lang: str,
) -> OAuthResponse:
    field = User.google_id if provider == "google" else User.apple_id
    result = await db.execute(select(User).where(field == provider_id))
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    is_new_user = False

    if user:
        if provider == "google" and not user.google_id:
            user.google_id = provider_id
        elif provider == "apple" and not user.apple_id:
            user.apple_id = provider_id
    else:
        is_new_user = True
        user = User(
            email=email,
            first_name=first_name or email.split("@")[0],
            last_name=last_name or "",
            hashed_password="",
            is_active=True,
            language=lang,
        )
        if provider == "google":
            user.google_id = provider_id
        else:
            user.apple_id = provider_id

        db.add(user)
        await db.flush()

    # Passe user_id comme string directement
    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    return OAuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        is_new_user=is_new_user,
    )


@router.post("/google", response_model=OAuthResponse)
async def google_login(
    payload: OAuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    lang = get_lang_from_request(request)
    user_info = await verify_google_token(payload.id_token)
    if not user_info:
        raise HTTPException(status_code=401, detail=t("errors.oauth_token_invalid", lang))

    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail=t("errors.oauth_email_missing", lang))

    return await _oauth_login_or_register(
        db=db, provider="google",
        provider_id=user_info["sub"], email=email,
        first_name=payload.first_name or user_info.get("given_name", ""),
        last_name=payload.last_name or user_info.get("family_name", ""),
        lang=lang,
    )


@router.post("/apple", response_model=OAuthResponse)
async def apple_login(
    payload: OAuthRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    lang = get_lang_from_request(request)
    user_info = await verify_apple_token(payload.id_token)
    if not user_info:
        raise HTTPException(status_code=401, detail=t("errors.oauth_token_invalid", lang))

    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail=t("errors.oauth_email_missing", lang))

    return await _oauth_login_or_register(
        db=db, provider="apple",
        provider_id=user_info["sub"], email=email,
        first_name=payload.first_name or user_info.get("given_name", ""),
        last_name=payload.last_name or user_info.get("family_name", ""),
        lang=lang,
    )
