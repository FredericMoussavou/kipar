import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.package import Package
from app.services.kiparscan_service import analyze_package_image
from app.i18n.loader import t

router = APIRouter(prefix="/kiparscan", tags=["kiparscan"])


class ScanResponse(BaseModel):
    package_id: uuid.UUID
    content_description: str
    estimated_weight_kg: float | None
    dimensions_estimate: str | None
    prohibited_flag: bool
    prohibited_reason: str | None
    confidence: str
    simulated: bool = False


@router.post("/analyze", response_model=ScanResponse)
async def analyze_only(
    file: UploadFile = File(...),
    destination_country: str = "SN",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Analyse une photo sans package_id — retourne le résultat IA sans sauvegarder.
    Utilisé dans le flow booking pour pré-remplir les champs.
    """
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail=t("errors.kiparscan_no_image", lang))
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    scan_result = await analyze_package_image(image_base64, destination_country)
    if not scan_result:
        raise HTTPException(status_code=500, detail=t("errors.kiparscan_failed", lang))
    return ScanResponse(
        package_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        content_description=scan_result.get("content_description", ""),
        estimated_weight_kg=scan_result.get("estimated_weight_kg"),
        dimensions_estimate=scan_result.get("dimensions_estimate"),
        prohibited_flag=scan_result.get("prohibited_flag", False),
        prohibited_reason=scan_result.get("prohibited_reason"),
        confidence=scan_result.get("confidence", "low"),
        simulated=scan_result.get("simulated", False),
    )


FREE_SCANS_PER_MONTH = 3


async def get_or_create_scan_credit(db, user_id):
    from app.models.scan_credit import ScanCredit
    from datetime import datetime, timezone
    result = await db.execute(
        select(ScanCredit).where(ScanCredit.user_id == user_id)
    )
    credit = result.scalar_one_or_none()
    if not credit:
        credit = ScanCredit(
            user_id=user_id,
            free_credits_used=0,
            paid_credits=0,
            total_scans=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(credit)
        await db.commit()
        await db.refresh(credit)
    return credit


async def check_and_consume_scan(db, user_id, lang: str):
    from datetime import datetime, timezone
    from calendar import monthrange
    credit = await get_or_create_scan_credit(db, user_id)
    now = datetime.now(timezone.utc)
    if credit.free_credits_reset_at is None or credit.free_credits_reset_at < now.replace(day=1, hour=0, minute=0, second=0, microsecond=0):
        credit.free_credits_used = 0
        last_day = monthrange(now.year, now.month)[1]
        credit.free_credits_reset_at = now.replace(day=last_day, hour=23, minute=59, second=59)
    if credit.free_credits_used < FREE_SCANS_PER_MONTH:
        credit.free_credits_used += 1
    elif credit.paid_credits > 0:
        credit.paid_credits -= 1
    else:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "quota_exceeded",
                "message": "Quota mensuel de scans atteint. Achetez des credits pour continuer.",
                "free_used": credit.free_credits_used,
                "free_limit": FREE_SCANS_PER_MONTH,
                "paid_remaining": credit.paid_credits,
            }
        )
    credit.total_scans += 1
    credit.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return credit


@router.get("/quota")
async def get_scan_quota(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    credit = await get_or_create_scan_credit(db, current_user.id)
    return {
        "free_used": credit.free_credits_used,
        "free_limit": FREE_SCANS_PER_MONTH,
        "free_remaining": max(0, FREE_SCANS_PER_MONTH - credit.free_credits_used),
        "paid_credits": credit.paid_credits,
        "total_scans": credit.total_scans,
        "reset_at": credit.free_credits_reset_at.isoformat() if credit.free_credits_reset_at else None,
    }


@router.post("/buy-credits")
async def buy_scan_credits(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    quantity = int(payload.get("quantity", 0))
    if quantity <= 0 or quantity > 100:
        raise HTTPException(status_code=400, detail="Quantite invalide (1-100)")
    credit = await get_or_create_scan_credit(db, current_user.id)
    credit.paid_credits += quantity
    from datetime import datetime, timezone
    credit.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {
        "paid_credits": credit.paid_credits,
        "purchased": quantity,
        "message": f"{quantity} credit(s) ajoute(s) avec succes",
    }


@router.post("/{package_id}", response_model=ScanResponse)
async def scan_package(
    package_id: str,
    file: UploadFile = File(...),
    destination_country: str = "SN",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Analyse une photo du colis via KiparScan (OpenAI Vision).
    Met à jour le Package avec le résultat et le flag prohibé.
    """
    # Verifier et consommer le quota de scan
    await check_and_consume_scan(db, current_user.id, lang)

    # Vérifie que le colis existe et appartient à l'expéditeur
    result = await db.execute(select(Package).where(Package.id == package_id))
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if package.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    # Lit l'image
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail=t("errors.kiparscan_no_image", lang))

    # Encode en base64
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    # Analyse IA
    scan_result = await analyze_package_image(image_base64, destination_country)
    if not scan_result:
        raise HTTPException(status_code=500, detail=t("errors.kiparscan_failed", lang))

    # Sauvegarde le résultat sur le colis
    package.ai_scan_result = scan_result
    package.ai_prohibited_flag = scan_result.get("prohibited_flag", False)

    # Met à jour la description si vide
    if not package.content_description and scan_result.get("content_description"):
        package.content_description = scan_result["content_description"]

    return ScanResponse(
        package_id=package.id,
        content_description=scan_result.get("content_description", ""),
        estimated_weight_kg=scan_result.get("estimated_weight_kg"),
        dimensions_estimate=scan_result.get("dimensions_estimate"),
        prohibited_flag=scan_result.get("prohibited_flag", False),
        prohibited_reason=scan_result.get("prohibited_reason"),
        confidence=scan_result.get("confidence", "low"),
        simulated=scan_result.get("simulated", False),
    )
