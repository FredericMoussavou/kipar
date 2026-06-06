import re
import uuid
from datetime import datetime, timezone
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

import redis as redis_lib
router = APIRouter(prefix="/auth", tags=["auth"])

def get_redis():
    from app.core.config import settings
    return redis_lib.from_url(settings.REDIS_URL, decode_responses=True)

def is_token_blacklisted(token: str) -> bool:
    try:
        r = get_redis()
        return r.exists(f"blacklist:{token}") > 0
    except Exception:
        return False

def blacklist_token(token: str, expire_seconds: int = 1800):
    try:
        r = get_redis()
        r.setex(f"blacklist:{token}", expire_seconds, "1")
    except Exception:
        pass


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    phone: str | None = None
    language: str = "fr"
    cgu_accepted: bool = False
    pending_trip_id: uuid.UUID | None = None

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
    pending_trip_id: uuid.UUID | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict | None = None


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
        cgu_accepted_at=datetime.now(timezone.utc) if payload.cgu_accepted else None,
        pending_trip_id=payload.pending_trip_id,
    )
    db.add(user)
    await db.commit()

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
    # Compte pause (soft delete) -- proposer reactivation
    if user.deleted_at is not None and not user.is_permanently_deleted:
        raise HTTPException(status_code=403, detail="compte_supprime")
    # Compte supprime definitivement ou banni
    if not user.is_active:
        raise HTTPException(status_code=401, detail=t("errors.invalid_credentials", lang))
    from app.api.v1.endpoints.users import _serialize_me
    if payload.pending_trip_id:
        user.pending_trip_id = payload.pending_trip_id
        await db.commit()
        await db.refresh(user)
    # Verifier si 2FA est active
    if user.totp_enabled:
        import uuid
        session_id = str(uuid.uuid4())
        try:
            r = get_redis()
            r.setex(f"2fa_pending:{session_id}", 300, str(user.id))
        except Exception:
            pass
        return TokenResponse(
            access_token="",
            refresh_token="",
            token_type="2fa_required",
            user={"requires_2fa": True, "session_id": session_id},
        )
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        user=_serialize_me(user),
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

    # Verifier que le refresh token n'est pas blackliste
    if is_token_blacklisted(payload.refresh_token):
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
    # Verifier que le nouveau mdp est different de l'ancien (avant d'ecraser)
    if verify_password(payload.new_password, user.hashed_password):
        raise HTTPException(status_code=400, detail=t("errors.password_same_as_old", lang))
    user.hashed_password = hash_password(payload.new_password)
    reset.used = True
    await db.commit()

    return {"message": t("success.password_reset_success", lang)}


@router.post("/change-password", response_model=dict)
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
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
    await db.commit()
    # Invalider tous les tokens actifs via blacklist
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        blacklist_token(token, expire_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return {"message": t("success.password_changed", lang)}


class GoogleCodeRequest(BaseModel):
    code: str
    redirect_uri: str


@router.post("/google/code", response_model=TokenResponse)
async def google_code(
    payload: GoogleCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Echange un authorization code Google contre un token KIPAR."""
    import httpx
    from app.services.oauth_service import verify_google_token

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": payload.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": payload.redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Code Google invalide")

    id_token = resp.json().get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Token Google manquant")

    google_user = await verify_google_token(id_token)
    if not google_user:
        raise HTTPException(status_code=401, detail="Token Google invalide")

    # Chercher ou créer l'utilisateur
    result = await db.execute(select(User).where(User.google_id == google_user['sub']))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.email == google_user['email']))
        user = result.scalar_one_or_none()
    if user:
        if not user.google_id:
            user.google_id = google_user['sub']
    else:
        user = User(
            email=google_user['email'],
            first_name=google_user.get('given_name', '') or google_user['email'].split('@')[0],
            last_name=google_user.get('family_name', '') or '',
            hashed_password='',
            is_active=True,
            google_id=google_user['sub'],
        )
        db.add(user)
        await db.flush()

    await db.commit()
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Invalide le token JWT courant via blacklist Redis."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        blacklist_token(token, expire_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    # Blacklister aussi le refresh token si fourni dans le body
    try:
        body = await request.json()
        refresh_token = body.get("refresh_token")
        if refresh_token:
            blacklist_token(refresh_token, expire_seconds=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)
    except Exception:
        pass
    return {"status": "logged_out"}


@router.post("/reactivate")
async def request_reactivation(
    request: Request,
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    """Demande de reactivation compte supprime - envoie un code par mail."""
    from datetime import datetime, timezone, timedelta
    from app.models.verification_code import VerificationCode
    from app.services.resend_service import send_email
    import secrets
    body = await request.json()
    email = body.get("email", "").strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="Email requis")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    # Reponse generique - ne pas revealer si le compte existe
    if not user or user.deleted_at is None:
        return {"status": "ok", "message": "Si un compte existe, un email a ete envoye"}
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Ce compte a ete banni. Contactez le support.")
    if user.is_permanently_deleted:
        raise HTTPException(status_code=403, detail="Ce compte a ete supprime definitivement. Contactez le support.")
    code = str(secrets.randbelow(900000) + 100000)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.add(VerificationCode(
        user_id=user.id,
        channel="email",
        code=code,
        expires_at=expires_at,
    ))
    await db.commit()
    await send_email(
        to=user.email,
        subject="Reactivation de votre compte KIPAR",
        html=f"<p>Votre code de reactivation : <strong>{code}</strong></p><p>Valable 15 minutes.</p>",
    )
    return {"status": "ok", "message": "Si un compte existe, un email a ete envoye"}
    

@router.post("/reactivate/confirm")
async def confirm_reactivation(
    request: Request,
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    """Confirme la reactivation avec le code recu par mail."""
    from datetime import datetime, timezone
    from app.models.verification_code import VerificationCode
    from app.services.notif_db_service import create_notification
    body = await request.json()
    email = body.get("email", "").strip().lower()
    code = body.get("code", "").strip()
    if not email or not code:
        raise HTTPException(status_code=422, detail="Email et code requis")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.deleted_at is None:
        raise HTTPException(status_code=404, detail="Compte introuvable ou deja actif")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Ce compte a ete banni. Contactez le support.")
    if user.is_permanently_deleted:
        raise HTTPException(status_code=403, detail="Ce compte a ete supprime definitivement. Contactez le support.")
    now = datetime.now(timezone.utc)
    vc_result = await db.execute(
        select(VerificationCode).where(
            VerificationCode.user_id == user.id,
            VerificationCode.channel == "email",
            VerificationCode.code == code,
            VerificationCode.used.is_(False),
            VerificationCode.expires_at > now,
        ).order_by(VerificationCode.created_at.desc()).limit(1)
    )
    vc = vc_result.scalar_one_or_none()
    if not vc:
        raise HTTPException(status_code=400, detail="Code invalide ou expire")
    vc.used = True
    user.deleted_at = None
    user.is_active = True
    await db.commit()
    await create_notification(
        db=db,
        user_id=user.id,
        type="account_reactivated",
        title="Compte reactiv",
        body="Votre compte KIPAR a ete reactiv avec succes.",
        link="/dashboard",
    )
    await db.commit()
    return {"status": "ok", "message": "Compte reactivé avec succes"}
