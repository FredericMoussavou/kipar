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
