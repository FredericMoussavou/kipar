import random
import string
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang, get_lang_optional
from app.models.user import User
from app.services.totp_service import (
    generate_totp_secret, generate_qr_code_base64, verify_totp_code, send_sms_code
)
from app.i18n.loader import t

router = APIRouter(prefix="/auth/2fa", tags=["2fa"])

REDIS_2FA_PREFIX = "2fa_pending:"
REDIS_SMS_PREFIX = "2fa_sms:"
REDIS_2FA_EXPIRE = 300  # 5 minutes


def get_redis():
    from app.core.config import settings
    import redis as redis_lib
    return redis_lib.from_url(settings.REDIS_URL, decode_responses=True)


class TOTPSetupResponse(BaseModel):
    qr_code: str
    secret: str


@router.post("/setup", response_model=TOTPSetupResponse)
async def setup_totp(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail=t("errors.totp_already_enabled", lang))

    if current_user.totp_secret and not current_user.totp_verified:
        secret = current_user.totp_secret
    else:
        secret = generate_totp_secret()
        current_user.totp_secret = secret
        current_user.totp_verified = False
        await db.commit()

    qr = generate_qr_code_base64(secret, current_user.email)
    return TOTPSetupResponse(qr_code=qr, secret=secret)


class TOTPVerifyRequest(BaseModel):
    code: str


@router.post("/verify-setup")
async def verify_totp_setup(
    payload: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail=t("errors.totp_not_setup", lang))
    if current_user.totp_enabled:
        raise HTTPException(status_code=400, detail=t("errors.totp_already_enabled", lang))
    import logging as _log
    _log.getLogger("kipar.2fa").warning(f"verify-setup: secret={current_user.totp_secret} code={payload.code} result={verify_totp_code(current_user.totp_secret, payload.code)}")
    if not verify_totp_code(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail=t("errors.totp_invalid_code", lang))

    current_user.totp_enabled = True
    current_user.totp_verified = True
    await db.commit()
    from app.services.backup_code_service import generate_backup_codes as _gen
    backup_codes = await _gen(db, current_user.id)
    return {"status": "enabled", "message": t("success.totp_enabled", lang), "backup_codes": backup_codes}


@router.post("/disable")
async def disable_totp(
    payload: TOTPVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail=t("errors.totp_not_enabled", lang))
    if not verify_totp_code(current_user.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail=t("errors.totp_invalid_code", lang))

    current_user.totp_enabled = False
    current_user.totp_verified = False
    current_user.totp_secret = None
    current_user.phone_2fa_enabled = False
    await db.commit()
    return {"status": "disabled", "message": t("success.totp_disabled", lang)}


class TwoFAConfirmRequest(BaseModel):
    session_id: str
    code: str


@router.post("/confirm")
async def confirm_2fa(
    payload: TwoFAConfirmRequest,
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang_optional),
):
    from sqlalchemy import select
    r = get_redis()
    user_id = r.get(f"{REDIS_2FA_PREFIX}{payload.session_id}")
    if not user_id:
        raise HTTPException(status_code=401, detail=t("errors.session_expired", lang))

    try:
        user_uuid = uuid.UUID(user_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail=t("errors.session_expired", lang))
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail=t("errors.user_not_found", lang))

    if not verify_totp_code(user.totp_secret, payload.code):
        raise HTTPException(status_code=400, detail=t("errors.totp_invalid_code", lang))

    r.delete(f"{REDIS_2FA_PREFIX}{payload.session_id}")

    from app.core.security import create_access_token, create_refresh_token
    from app.api.v1.endpoints.users import _serialize_me
    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
        "user": _serialize_me(user),
    }


@router.post("/sms/enable")
async def enable_sms_2fa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail=t("errors.totp_required_first", lang))
    if not current_user.phone:
        raise HTTPException(status_code=400, detail=t("errors.phone_required", lang))

    code = "".join(random.choices(string.digits, k=6))
    r = get_redis()
    r.setex(f"{REDIS_SMS_PREFIX}{current_user.id}", REDIS_2FA_EXPIRE, code)

    sent = await send_sms_code(current_user.phone, code)
    if not sent:
        raise HTTPException(status_code=500, detail=t("errors.sms_send_failed", lang))

    return {"status": "sms_sent"}


class SMSVerifyRequest(BaseModel):
    code: str


@router.post("/sms/verify-enable")
async def verify_sms_enable(
    payload: SMSVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    r = get_redis()
    stored = r.get(f"{REDIS_SMS_PREFIX}{current_user.id}")
    if not stored or stored != payload.code:
        raise HTTPException(status_code=400, detail=t("errors.totp_invalid_code", lang))

    r.delete(f"{REDIS_SMS_PREFIX}{current_user.id}")
    current_user.phone_2fa_enabled = True
    await db.commit()
    return {"status": "sms_enabled", "message": t("success.sms_2fa_enabled", lang)}


# backup codes

@router.post("/backup-codes/generate")
async def generate_backup_codes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail=t("errors.totp_not_enabled", lang))
    from app.services.backup_code_service import generate_backup_codes as _gen
    codes = await _gen(db, current_user.id)
    return {"backup_codes": codes}


class BackupCodeRequest(BaseModel):
    session_id: str
    code: str


@router.post("/backup-codes/use")
async def use_backup_code(
    payload: BackupCodeRequest,
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang_optional),
):
    from sqlalchemy import select as sa_select
    r = get_redis()
    user_id = r.get(f"{REDIS_2FA_PREFIX}{payload.session_id}")
    if not user_id:
        raise HTTPException(status_code=401, detail=t("errors.session_expired", lang))
    try:
        user_uuid = uuid.UUID(user_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail=t("errors.session_expired", lang))
    result = await db.execute(sa_select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail=t("errors.user_not_found", lang))
    from app.services.backup_code_service import verify_backup_code
    if not await verify_backup_code(db, user_uuid, payload.code):
        raise HTTPException(status_code=400, detail=t("errors.totp_invalid_code", lang))
    r.delete(f"{REDIS_2FA_PREFIX}{payload.session_id}")
    from app.core.security import create_access_token, create_refresh_token
    from app.api.v1.endpoints.users import _serialize_me
    return {
        "access_token": create_access_token(str(user.id)),
        "refresh_token": create_refresh_token(str(user.id)),
        "token_type": "bearer",
        "user": _serialize_me(user),
    }