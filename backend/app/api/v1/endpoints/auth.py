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
