import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from pydantic import BaseModel, EmailStr, field_validator
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token
)
from app.core.rate_limit import limiter
from app.models.user import User
from app.i18n.loader import t
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None
    language: str = "fr"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("au moins 8 caractères")
        if not re.search(r"[A-Z]", v):
            errors.append("au moins 1 majuscule")
        if not re.search(r"[a-z]", v):
            errors.append("au moins 1 minuscule")
        if not re.search(r"\d", v):
            errors.append("au moins 1 chiffre")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("au moins 1 caractère spécial")
        if errors:
            raise ValueError("Mot de passe invalide : " + ", ".join(errors))
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """5 inscriptions max par minute par IP."""
    lang = payload.language
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=t("errors.email_already_registered", lang))

    user = User(
        email=payload.email,
        phone=payload.phone,
        hashed_password=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        language=payload.language,
    )
    db.add(user)
    await db.flush()

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """10 tentatives de connexion max par minute par IP — anti brute force."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    lang = user.language if user else "fr"
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail=t("errors.invalid_credentials", lang))
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("20/minute")
async def refresh(request: Request, payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise HTTPException(status_code=401, detail=t("errors.token_type_invalid", "fr"))
        user_id = data["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail=t("errors.invalid_token", "fr"))

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail=t("errors.user_not_found", "fr"))

    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


# ── Reset mot de passe ──

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("au moins 8 caractères")
        if not re.search(r"[A-Z]", v):
            errors.append("au moins 1 majuscule")
        if not re.search(r"[a-z]", v):
            errors.append("au moins 1 minuscule")
        if not re.search(r"\d", v):
            errors.append("au moins 1 chiffre")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("au moins 1 caractère spécial")
        if errors:
            raise ValueError("Mot de passe invalide : " + ", ".join(errors))
        return v


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        errors = []
        if len(v) < 8:
            errors.append("au moins 8 caractères")
        if not re.search(r"[A-Z]", v):
            errors.append("au moins 1 majuscule")
        if not re.search(r"[a-z]", v):
            errors.append("au moins 1 minuscule")
        if not re.search(r"\d", v):
            errors.append("au moins 1 chiffre")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("au moins 1 caractère spécial")
        if errors:
            raise ValueError("Mot de passe invalide : " + ", ".join(errors))
        return v


@router.post("/forgot-password", response_model=dict)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Envoie un lien de réinitialisation par email.
    Répond toujours 200 même si l'email n'existe pas — sécurité anti-enumération.
    """
    from datetime import timedelta, timezone
    from app.models.password_reset import PasswordReset
    from app.services.notification_service import send_email

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Réponse générique même si user introuvable — évite de révéler les emails existants
    if not user:
        return {"message": t("success.reset_email_sent", "fr")}

    lang = user.language

    # Invalide les anciens tokens non utilisés
    from sqlalchemy import update
    await db.execute(
        update(PasswordReset)
        .where(PasswordReset.user_id == user.id, PasswordReset.used == False)
        .values(used=True)
    )

    # Crée un nouveau token valable 15 minutes
    from datetime import datetime
    token = PasswordReset.generate_token()
    reset = PasswordReset(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    )
    db.add(reset)
    await db.flush()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    if lang == "fr":
        subject = "KIPAR. — Réinitialisation de votre mot de passe"
        html = f"""
        <h2>Réinitialisation de mot de passe</h2>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p><a href="{reset_url}">Cliquez ici pour réinitialiser</a></p>
        <p>Ce lien expire dans <strong>15 minutes</strong>.</p>
        <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
        """
    else:
        subject = "KIPAR. — Password reset"
        html = f"""
        <h2>Password Reset</h2>
        <p>You requested to reset your password.</p>
        <p><a href="{reset_url}">Click here to reset your password</a></p>
        <p>This link expires in <strong>15 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
        """

    await send_email(user.email, subject, html)

    return {"message": t("success.reset_email_sent", lang)}


@router.post("/reset-password", response_model=dict)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Réinitialise le mot de passe via le token reçu par email."""
    from datetime import datetime, timezone
    from app.models.password_reset import PasswordReset

    result = await db.execute(
        select(PasswordReset).where(PasswordReset.token == payload.token)
    )
    reset = result.scalar_one_or_none()

    if not reset:
        raise HTTPException(status_code=400, detail=t("errors.reset_token_invalid", "fr"))
    if reset.used:
        raise HTTPException(status_code=400, detail=t("errors.reset_token_already_used", "fr"))
    if datetime.now(timezone.utc) > reset.expires_at:
        raise HTTPException(status_code=400, detail=t("errors.reset_token_invalid", "fr"))

    result = await db.execute(select(User).where(User.id == reset.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail=t("errors.reset_token_invalid", "fr"))

    lang = user.language
    user.hashed_password = hash_password(payload.new_password)
    reset.used = True

    return {"message": t("success.password_reset_success", lang)}


@router.post("/change-password", response_model=dict)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """L'utilisateur connecté change volontairement son mot de passe."""
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail=t("errors.old_password_invalid", lang))

    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail=t("errors.password_same_as_old", lang))

    current_user.hashed_password = hash_password(payload.new_password)
    return {"message": t("success.password_changed", lang)}
