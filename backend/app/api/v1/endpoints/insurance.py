from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.booking import Booking
from app.models.package import Package
from app.models.insurance import Insurance
from app.core.config import settings
from app.i18n.loader import t

router = APIRouter(prefix="/insurance", tags=["insurance"])


class InsuranceSubscribeRequest(BaseModel):
    booking_id: uuid.UUID


class InsuranceResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    package_id: uuid.UUID
    subscriber_id: uuid.UUID
    declared_value: float
    rate: float
    premium_amount: float
    coverage_amount: float
    status: str
    subscribed_at: datetime
    payout_amount: float

    model_config = {"from_attributes": True}


class InsuranceQuoteResponse(BaseModel):
    booking_id: uuid.UUID
    declared_value: float
    rate: float
    premium_amount: float
    coverage_amount: float


@router.get("/quote/{booking_id}", response_model=InsuranceQuoteResponse)
async def get_insurance_quote(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Retourne un devis d'assurance pour une réservation.
    Appelé avant le paiement pour afficher la prime à l'expéditeur.
    """
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))

    result = await db.execute(select(Package).where(Package.id == booking.package_id))
    package = result.scalar_one_or_none()

    declared_value = package.declared_value if package else 0.0
    rate = settings.INSURANCE_RATE_DEFAULT
    premium = round(declared_value * rate, 2)
    coverage = declared_value

    return InsuranceQuoteResponse(
        booking_id=booking.id,
        declared_value=declared_value,
        rate=rate,
        premium_amount=premium,
        coverage_amount=coverage,
    )


@router.post("", response_model=InsuranceResponse, status_code=201)
async def subscribe_insurance(
    payload: InsuranceSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Souscrit une assurance pour un colis.
    Disponible après acceptation de la réservation, avant ou après paiement.
    """
    result = await db.execute(select(Booking).where(Booking.id == payload.booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))
    if booking.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("accepted", "paid", "in_transit"):
        raise HTTPException(
            status_code=400,
            detail=t("errors.insurance_booking_not_accepted", lang)
        )

    # Vérifie qu'une assurance n'existe pas déjà
    result = await db.execute(
        select(Insurance).where(Insurance.booking_id == payload.booking_id)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=t("errors.insurance_already_subscribed", lang)
        )

    result = await db.execute(select(Package).where(Package.id == booking.package_id))
    package = result.scalar_one_or_none()

    declared_value = package.declared_value if package else 0.0
    rate = settings.INSURANCE_RATE_DEFAULT
    premium = round(declared_value * rate, 2)

    insurance = Insurance(
        booking_id=booking.id,
        package_id=booking.package_id,
        subscriber_id=current_user.id,
        declared_value=declared_value,
        rate=rate,
        premium_amount=premium,
        coverage_amount=declared_value,
        status="active",
    )
    db.add(insurance)

    # Met à jour le booking
    booking.insurance_subscribed = True
    booking.insurance_amount = premium

    await db.flush()
    return insurance


@router.get("/{booking_id}", response_model=InsuranceResponse)
async def get_insurance(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """Consulte l'assurance d'une réservation."""
    result = await db.execute(
        select(Insurance).where(Insurance.booking_id == booking_id)
    )
    insurance = result.scalar_one_or_none()
    if not insurance:
        raise HTTPException(status_code=404, detail=t("errors.insurance_not_found", lang))
    if insurance.subscriber_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    return insurance


@router.delete("/{booking_id}", response_model=dict)
async def cancel_insurance(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    """
    Annule une assurance — possible uniquement avant le départ du vol.
    """
    result = await db.execute(
        select(Insurance).where(Insurance.booking_id == booking_id)
    )
    insurance = result.scalar_one_or_none()
    if not insurance:
        raise HTTPException(status_code=404, detail=t("errors.insurance_not_found", lang))
    if insurance.subscriber_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if insurance.status != "active":
        raise HTTPException(status_code=400, detail=t("errors.claim_already_resolved", lang))

    insurance.status = "cancelled"
    insurance.cancelled_at = datetime.now(timezone.utc)

    # Met à jour le booking
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if booking:
        booking.insurance_subscribed = False
        booking.insurance_amount = 0.0

    return {"message": t("success.insurance_cancelled", lang)}
