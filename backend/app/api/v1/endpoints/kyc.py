from app.core.rate_limit import limiter
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.services.idenfy_service import create_verification_session, process_webhook
from app.services.trust_service import update_trust_score
from app.services.kyc_promotion_service import promote_pending_kyc_bookings
from app.i18n.loader import t

router = APIRouter(prefix="/kyc", tags=["kyc"])


class KYCInitResponse(BaseModel):
    applicant_id: str
    verification_url: str
    scan_ref: str


@router.post("/init", response_model=KYCInitResponse)
@limiter.limit("3/minute")
async def init_kyc(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    if current_user.kyc_status == "approved":
        raise HTTPException(status_code=400, detail=t("errors.kyc_already_verified", lang))

    if not current_user.onfido_applicant_id:
        import uuid
        current_user.onfido_applicant_id = str(uuid.uuid4())
        await db.flush()

    session = await create_verification_session(
        client_id=current_user.onfido_applicant_id,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
    )
    if not session:
        raise HTTPException(status_code=500, detail=t("errors.kyc_applicant_creation_failed", lang))

    current_user.kyc_status = "in_review"
    await db.commit()

    return KYCInitResponse(
        applicant_id=current_user.onfido_applicant_id,
        verification_url=session["url"],
        scan_ref=session["scanRef"],
    )


@router.post("/webhook")
async def kyc_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # Extraction du contenu brut indispensable pour le calcul HMAC
    raw_body = await request.body()
    signature = request.headers.get("Idenfy-Signature", "")

    result = await process_webhook(raw_body, signature)
    if not result:
        # On lève une erreur 400 si la signature est invalide ou le payload corrompu
        raise HTTPException(status_code=400, detail="Invalid signature or payload")

    res = await db.execute(
        select(User).where(User.onfido_applicant_id == result["applicant_id"])
    )
    user = res.scalar_one_or_none()
    if not user:
        return {"status": "user_not_found"}

    user.kyc_status = result["status"]
    if result["status"] == "approved":
        await promote_pending_kyc_bookings(user, db)
    await update_trust_score(user, db)
    return {"status": "processed", "kyc_status": result["status"]}


class KYCDocsSubmit(BaseModel):
    id_front: str | None = None
    id_back: str | None = None
    selfie: str | None = None


@router.post("/submit-docs")
async def submit_kyc_docs(
    payload: KYCDocsSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Soumet les documents KYC uploadés via Cloudinary."""
    if current_user.kyc_status == "approved":
        raise HTTPException(status_code=400, detail=t("errors.kyc_already_verified", lang))

    docs = {}
    if payload.id_front:
        docs["id_front"] = payload.id_front
    if payload.id_back:
        docs["id_back"] = payload.id_back
    if payload.selfie:
        docs["selfie"] = payload.selfie

    if not docs:
        raise HTTPException(status_code=400, detail=t("errors.kiparscan_no_image", lang))

    if payload.id_front:
        current_user.kyc_id_front = payload.id_front
    if payload.id_back:
        current_user.kyc_id_back = payload.id_back
    if payload.selfie:
        current_user.kyc_selfie = payload.selfie
    current_user.kyc_status = "in_review"
    if not current_user.onfido_applicant_id:
        current_user.onfido_applicant_id = f"manual_{str(current_user.id)[:8]}"

    await db.commit()
    return {"status": "in_review", "message": t("success.kyc_docs_submitted", lang)}


@router.post("/simulate-verify")
async def simulate_kyc_verification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    from app.core.config import settings
    if settings.is_production:
        raise HTTPException(status_code=404, detail=t("errors.unauthorized", lang))

    current_user.kyc_status = "approved"
    await promote_pending_kyc_bookings(current_user, db)
    new_score = await update_trust_score(current_user, db)
    return {
        "message": t("success.kyc_simulate_ok", lang),
        "kyc_status": "approved",
        "trust_score": new_score
    }
