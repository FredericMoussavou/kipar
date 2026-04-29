from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.lang import get_lang
from app.models.user import User
from app.models.trip import Trip
from app.models.package import Package
from app.models.booking import Booking
from app.models.receiver_invitation import ReceiverInvitation
from app.schemas.booking import BookingCreate, BookingResponse
from app.i18n.loader import t

router = APIRouter(prefix="/bookings", tags=["bookings"])


async def find_or_invite_receiver(
    contact: str, sender_id: uuid.UUID, booking_id: uuid.UUID, db: AsyncSession
) -> uuid.UUID | None:
    result = await db.execute(select(User).where(User.email == contact))
    user = result.scalar_one_or_none()
    if not user:
        result = await db.execute(select(User).where(User.phone == contact))
        user = result.scalar_one_or_none()
    if user:
        return user.id
    invitation = ReceiverInvitation(
        booking_id=booking_id,
        sender_id=sender_id,
        contact=contact,
        token=ReceiverInvitation.generate_token(),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(invitation)
    return None


@router.post("", response_model=BookingResponse, status_code=201)
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Trip).where(Trip.id == payload.trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail=t("errors.trip_not_found", lang))
    if trip.status != "open":
        raise HTTPException(status_code=400, detail=t("errors.trip_not_open", lang))
    if payload.weight_kg > trip.remaining_kg:
        raise HTTPException(status_code=400, detail=t(
            "errors.weight_exceeds_capacity", lang,
            requested=payload.weight_kg, available=trip.remaining_kg
        ))
    if payload.weight_kg > trip.max_kg_per_package:
        raise HTTPException(status_code=400, detail=t(
            "errors.weight_exceeds_max", lang, max=trip.max_kg_per_package
        ))

    amount = payload.weight_kg * trip.price_per_kg
    package = Package(
        sender_id=current_user.id,
        weight_kg=payload.weight_kg,
        content_description=payload.content_description,
        declared_value=payload.declared_value,
    )
    db.add(package)
    await db.flush()

    booking = Booking(
        trip_id=trip.id,
        package_id=package.id,
        sender_id=current_user.id,
        amount=amount,
        insurance_subscribed=payload.insurance_subscribed,
        status="pending",
    )
    db.add(booking)
    await db.flush()

    receiver_id = await find_or_invite_receiver(
        payload.receiver_email_or_phone, current_user.id, booking.id, db
    )
    if receiver_id:
        booking.receiver_id = receiver_id
        package.receiver_id = receiver_id
    else:
        booking.status = "awaiting_receiver"

    return booking


@router.patch("/{booking_id}/accept", response_model=BookingResponse)
async def accept_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("pending", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    trip.remaining_kg -= booking.amount / trip.price_per_kg
    if trip.remaining_kg <= 0:
        trip.status = "full"

    booking.status = "accepted"
    booking.accepted_at = datetime.now(timezone.utc)
    return booking


@router.patch("/{booking_id}/refuse", response_model=BookingResponse)
async def refuse_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    lang: str = Depends(get_lang),
):
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail=t("errors.unauthorized", lang))
    if booking.status not in ("pending", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail=t("errors.booking_already_actioned", lang))

    booking.status = "refused"
    return booking
