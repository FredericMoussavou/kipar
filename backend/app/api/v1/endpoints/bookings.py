from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
import uuid

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.trip import Trip
from app.models.package import Package
from app.models.booking import Booking
from app.models.receiver_invitation import ReceiverInvitation
from app.schemas.booking import BookingCreate, BookingResponse

router = APIRouter(prefix="/bookings", tags=["bookings"])


async def find_or_invite_receiver(
    contact: str, sender_id: uuid.UUID, booking_id: uuid.UUID, db: AsyncSession
) -> uuid.UUID | None:
    """
    Cherche un user par email ou téléphone.
    Si introuvable, crée une invitation valable 24h.
    Retourne l'UUID du récepteur ou None si invitation envoyée.
    """
    # Cherche par email
    result = await db.execute(select(User).where(User.email == contact))
    user = result.scalar_one_or_none()

    # Cherche par téléphone si pas trouvé par email
    if not user:
        result = await db.execute(select(User).where(User.phone == contact))
        user = result.scalar_one_or_none()

    if user:
        return user.id

    # Récepteur introuvable — crée une invitation
    invitation = ReceiverInvitation(
        booking_id=booking_id,
        sender_id=sender_id,
        contact=contact,
        token=ReceiverInvitation.generate_token(),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(invitation)
    # TODO: envoyer SMS/email via Celery (Sprint 3)
    return None


@router.post("", response_model=BookingResponse, status_code=201)
async def create_booking(
    payload: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Vérifie que le trajet existe et est ouvert
    result = await db.execute(select(Trip).where(Trip.id == payload.trip_id))
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(status_code=404, detail="Trajet introuvable")
    if trip.status != "open":
        raise HTTPException(status_code=400, detail="Ce trajet n'accepte plus de colis")

    # Vérifie la capacité disponible
    if payload.weight_kg > trip.remaining_kg:
        raise HTTPException(
            status_code=400,
            detail=f"Poids demandé ({payload.weight_kg}kg) supérieur au disponible ({trip.remaining_kg}kg)"
        )
    if payload.weight_kg > trip.max_kg_per_package:
        raise HTTPException(
            status_code=400,
            detail=f"Poids max par colis : {trip.max_kg_per_package}kg"
        )

    # Calcul du montant
    amount = payload.weight_kg * trip.price_per_kg

    # Crée le colis
    package = Package(
        sender_id=current_user.id,
        weight_kg=payload.weight_kg,
        content_description=payload.content_description,
        declared_value=payload.declared_value,
    )
    db.add(package)
    await db.flush()  # génère package.id

    # Crée la réservation
    booking = Booking(
        trip_id=trip.id,
        package_id=package.id,
        sender_id=current_user.id,
        amount=amount,
        insurance_subscribed=payload.insurance_subscribed,
        status="pending",
    )
    db.add(booking)
    await db.flush()  # génère booking.id

    # Lie le récepteur
    receiver_id = await find_or_invite_receiver(
        payload.receiver_email_or_phone,
        current_user.id,
        booking.id,
        db
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
):
    """Le transporteur accepte une demande."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    # Vérifie que c'est bien le transporteur du trajet
    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    if booking.status not in ("pending", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail="Cette réservation ne peut plus être acceptée")

    # Déduit les kg du trajet
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
):
    """Le transporteur refuse une demande."""
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Réservation introuvable")

    result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = result.scalar_one_or_none()
    if trip.carrier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Non autorisé")

    if booking.status not in ("pending", "awaiting_receiver"):
        raise HTTPException(status_code=400, detail="Cette réservation ne peut plus être refusée")

    booking.status = "refused"
    return booking
