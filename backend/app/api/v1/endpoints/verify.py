import random
import string
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.verification_code import VerificationCode
from app.services.notification_service import send_email, send_sms
from app.i18n.loader import t

router = APIRouter(prefix="/verify", tags=["verify"])

CODE_TTL_MINUTES = 15


def _generate_code() -> str:
    return ''.join(random.choices(string.digits, k=6))


class ConfirmPayload(BaseModel):
    code: str


# ── EMAIL ──

@router.post("/email/send")
async def send_email_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    if current_user.email_verified:
        raise HTTPException(status_code=400, detail=t("errors.already_verified", lang))

    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)

    # Invalider les anciens codes
    await db.execute(
        update(VerificationCode)
        .where(VerificationCode.user_id == current_user.id)
        .where(VerificationCode.channel == "email")
        .where(VerificationCode.used == False)
        .values(used=True)
    )

    vc = VerificationCode(
        user_id=current_user.id,
        channel="email",
        code=code,
        expires_at=expires_at,
    )
    db.add(vc)
    await db.commit()

    subject = "KIPAR. — Code de vérification" if lang == "fr" else "KIPAR. — Verification code"
    html = f"<p>Votre code : <strong>{code}</strong> (valable {CODE_TTL_MINUTES} min)</p>" if lang == "fr" else f"<p>Your code: <strong>{code}</strong> (valid {CODE_TTL_MINUTES} min)</p>"
    await send_email(current_user.email, subject, html)

    return {"message": t("success.code_sent", lang), "email": current_user.email}


@router.post("/email/confirm")
async def confirm_email_code(
    payload: ConfirmPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    if current_user.email_verified:
        raise HTTPException(status_code=400, detail=t("errors.already_verified", lang))

    result = await db.execute(
        select(VerificationCode)
        .where(VerificationCode.user_id == current_user.id)
        .where(VerificationCode.channel == "email")
        .where(VerificationCode.used == False)
        .where(VerificationCode.code == payload.code)
        .order_by(VerificationCode.created_at.desc())
    )
    vc = result.scalar_one_or_none()

    if not vc:
        raise HTTPException(status_code=400, detail=t("errors.invalid_code", lang))
    if vc.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail=t("errors.code_expired", lang))

    vc.used = True
    current_user.email_verified = True
    await db.commit()

    return {"message": t("success.email_verified", lang), "email_verified": True}


# ── PHONE ──

@router.post("/phone/send")
async def send_phone_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    if not current_user.phone:
        raise HTTPException(status_code=400, detail=t("errors.no_phone", lang))
    if current_user.phone_verified:
        raise HTTPException(status_code=400, detail=t("errors.already_verified", lang))

    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)

    await db.execute(
        update(VerificationCode)
        .where(VerificationCode.user_id == current_user.id)
        .where(VerificationCode.channel == "phone")
        .where(VerificationCode.used == False)
        .values(used=True)
    )

    vc = VerificationCode(
        user_id=current_user.id,
        channel="phone",
        code=code,
        expires_at=expires_at,
    )
    db.add(vc)
    await db.commit()

    msg = f"KIPAR. — Code : {code} (valable {CODE_TTL_MINUTES} min)" if lang == "fr" else f"KIPAR. — Code: {code} (valid {CODE_TTL_MINUTES} min)"
    await send_sms(current_user.phone, msg)

    return {"message": t("success.code_sent", lang), "phone": current_user.phone}


@router.post("/phone/confirm")
async def confirm_phone_code(
    payload: ConfirmPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    if current_user.phone_verified:
        raise HTTPException(status_code=400, detail=t("errors.already_verified", lang))

    result = await db.execute(
        select(VerificationCode)
        .where(VerificationCode.user_id == current_user.id)
        .where(VerificationCode.channel == "phone")
        .where(VerificationCode.used == False)
        .where(VerificationCode.code == payload.code)
        .order_by(VerificationCode.created_at.desc())
    )
    vc = result.scalar_one_or_none()

    if not vc:
        raise HTTPException(status_code=400, detail=t("errors.invalid_code", lang))
    if vc.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail=t("errors.code_expired", lang))

    vc.used = True
    current_user.phone_verified = True
    await db.commit()

    return {"message": t("success.phone_verified", lang), "phone_verified": True}


# ── SIMULATE (dev only) ──

@router.post("/simulate")
async def simulate_verify(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    from app.core.config import settings
    if settings.is_production:
        raise HTTPException(status_code=404)
    current_user.email_verified = True
    current_user.phone_verified = True
    await db.commit()
    return {"email_verified": True, "phone_verified": True}
