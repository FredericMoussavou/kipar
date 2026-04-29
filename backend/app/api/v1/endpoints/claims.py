from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import List
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.claim import Claim
from app.services.notification_service import send_email
from app.core.config import settings
from app.i18n.loader import t

router = APIRouter(prefix="/claims", tags=["claims"])


class ClaimCreate(BaseModel):
    booking_id: uuid.UUID
    claim_type: str  # non_delivery / damaged / lost_airline / refused_code / wrong_content
    description: str
    evidence_urls: List[str] = []
    pir_document_url: str | None = None


class ClaimResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    opened_by: uuid.UUID
    claim_type: str
    status: str
    description: str
    evidence_urls: list
    pir_document_url: str | None
    insurance_payout: float
    resolution_note: str | None
    opened_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class ClaimResolve(BaseModel):
    resolution: str  # favor_sender / favor_carrier
    resolution_note: str
    insurance_payout: float = 0.0


VALID_CLAIM_TYPES = [
    "non_delivery", "damaged", "lost_airline",
    "refused_code", "wrong_content"
]


@router.post("", response_model=ClaimResponse, status_code=201)
async def open_claim(
    payload: ClaimCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Ouvre un litige sur une réservation."""
    result = await db.execute(select(Booking).where(Booking.id == payload.booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    # Seul l'expéditeur ou le récepteur peut ouvrir un litige
    if current_user.id not in (booking.sender_id, booking.receiver_id):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    # La réservation doit être en transit ou livrée
    if booking.status not in ("in_transit", "delivered", "paid"):
        raise HTTPException(
            status_code=400,
            detail=t("errors.claim_booking_not_delivered", lang)
        )

    # Vérifie qu'un litige n'existe pas déjà
    result = await db.execute(
        select(Claim).where(Claim.booking_id == payload.booking_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=t("errors.claim_already_exists", lang))

    if payload.claim_type not in VALID_CLAIM_TYPES:
        raise HTTPException(status_code=422, detail=f"Type invalide. Valeurs : {VALID_CLAIM_TYPES}")

    # Gèle le paiement — repasse en disputed
    booking.status = "disputed"

    claim = Claim(
        booking_id=payload.booking_id,
        opened_by=current_user.id,
        claim_type=payload.claim_type,
        description=payload.description,
        evidence_urls=payload.evidence_urls,
        pir_document_url=payload.pir_document_url,
        status="open",
    )
    db.add(claim)
    await db.flush()

    # Notifie le support Kipar par email
    await send_email(
        to=settings.SUPPORT_EMAIL,
        subject=f"KIPAR. — Nouveau litige #{str(claim.id)[:8]} — {payload.claim_type}",
        html=f"""
        <h2>Nouveau litige ouvert</h2>
        <p><b>ID :</b> {claim.id}</p>
        <p><b>Réservation :</b> {payload.booking_id}</p>
        <p><b>Type :</b> {payload.claim_type}</p>
        <p><b>Ouvert par :</b> {current_user.email}</p>
        <p><b>Description :</b> {payload.description}</p>
        <p><b>PIR :</b> {payload.pir_document_url or 'Non fourni'}</p>
        <p><a href="{settings.FRONTEND_URL}/admin/claims/{claim.id}">Voir le litige</a></p>
        """
    )

    return claim


@router.get("/{claim_id}", response_model=ClaimResponse)
async def get_claim(
    claim_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Consulte un litige."""
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail=t("errors.claim_not_found", lang))

    # Vérifie que l'utilisateur est concerné par cette réservation
    result = await db.execute(select(Booking).where(Booking.id == claim.booking_id))
    booking = result.scalar_one_or_none()
    if current_user.id not in (booking.sender_id, booking.receiver_id):
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    return claim


@router.get("", response_model=list[ClaimResponse])
async def list_my_claims(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste tous les litiges de l'utilisateur connecté."""
    result = await db.execute(
        select(Claim).where(Claim.opened_by == current_user.id)
        .order_by(Claim.opened_at.desc())
    )
    return result.scalars().all()


@router.patch("/{claim_id}/resolve", response_model=ClaimResponse)
async def resolve_claim(
    claim_id: str,
    payload: ClaimResolve,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Résout un litige — admin uniquement.
    resolution : 'favor_sender' → remboursement | 'favor_carrier' → libération paiement
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail=t("errors.claim_not_found", lang))
    if claim.status in ("resolved_sender", "resolved_carrier", "closed"):
        raise HTTPException(status_code=400, detail=t("errors.claim_already_resolved", lang))

    result = await db.execute(select(Booking).where(Booking.id == claim.booking_id))
    booking = result.scalar_one_or_none()

    if payload.resolution == "favor_sender":
        booking.status = "refunded"
        claim.status = "resolved_sender"
        # TODO Sprint suivant : déclencher remboursement via Stripe/Flutterwave
    else:
        booking.status = "delivered"
        claim.status = "resolved_carrier"
        # TODO Sprint suivant : déclencher libération paiement

    claim.resolution_note = payload.resolution_note
    claim.insurance_payout = payload.insurance_payout
    claim.resolved_at = datetime.now(timezone.utc)

    # Notifie l'expéditeur
    result = await db.execute(select(User).where(User.id == booking.sender_id))
    sender = result.scalar_one_or_none()
    if sender:
        resolution_msg = (
            t("success.claim_resolved", sender.language)
            + f" — {payload.resolution_note}"
        )
        await send_email(
            to=sender.email,
            subject="KIPAR. — Votre litige a été résolu",
            html=f"<p>{resolution_msg}</p>"
        )

    return claim
