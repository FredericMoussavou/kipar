from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import secrets
import string

from app.core.database import get_db
from app.core.lang import get_lang
from app.core.security import hash_password
from app.models.receiver_invitation import ReceiverInvitation
from app.models.booking import Booking
from app.models.package import Package
from app.models.trip import Trip
from app.models.user import User
from app.i18n.loader import t

router = APIRouter(prefix="/receiver", tags=["receiver"])


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in pwd)
                and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd)
                and any(c in "!@#$%" for c in pwd)):
            return pwd


@router.get("/{token}")
async def get_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    """Retourne les infos du colis pour le récepteur (page publique)."""
    result = await db.execute(
        select(ReceiverInvitation).where(ReceiverInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail=t("errors.invitation_not_found", lang))
    if inv.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail=t("errors.invitation_expired", lang))
    if inv.accepted_at or inv.refused_at:
        raise HTTPException(status_code=409, detail=t("errors.invitation_already_actioned", lang))

    booking_result = await db.execute(select(Booking).where(Booking.id == inv.booking_id))
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail=t("errors.booking_not_found", lang))

    pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
    pkg = pkg_result.scalar_one_or_none()

    trip_result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
    trip = trip_result.scalar_one_or_none()

    sender_result = await db.execute(select(User).where(User.id == inv.sender_id))
    sender = sender_result.scalar_one_or_none()

    return {
        "token": token,
        "contact": inv.contact,
        "sender_full_name": sender.full_name if sender else "",
        "origin": trip.origin_airport_code if trip else "",
        "destination": trip.destination_airport_code if trip else "",
        "departure_date": str(trip.departure_date) if trip else "",
        "content_description": pkg.content_description if pkg else "",
        "weight_kg": pkg.weight_kg if pkg else 0,
        "declared_value": pkg.declared_value if pkg else 0,
        "amount": booking.amount,
        "insurance_subscribed": booking.insurance_subscribed,
        "expires_at": inv.expires_at.isoformat(),
    }


@router.post("/{token}/confirm")
async def confirm_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    """Le récepteur accepte — crée son compte si besoin, passe booking en pending."""
    result = await db.execute(
        select(ReceiverInvitation).where(ReceiverInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail=t("errors.invitation_not_found", lang))
    if inv.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail=t("errors.invitation_expired", lang))
    if inv.accepted_at or inv.refused_at:
        raise HTTPException(status_code=409, detail=t("errors.invitation_already_actioned", lang))

    # Cherche ou crée le compte récepteur
    user_result = await db.execute(select(User).where(User.email == inv.contact))
    receiver = user_result.scalar_one_or_none()
    temp_password = None
    account_created = False

    if not receiver:
        temp_password = _generate_temp_password()
        receiver = User(
            email=inv.contact,
            hashed_password=hash_password(temp_password),
            first_name=inv.contact.split("@")[0].capitalize(),
            last_name="",
            is_sender=True,
            is_receiver=True,
            is_carrier=False,
            is_temporary_password=True,
            language=lang,
        )
        db.add(receiver)
        await db.flush()
        account_created = True

    # Met à jour booking + package
    booking_result = await db.execute(select(Booking).where(Booking.id == inv.booking_id))
    booking = booking_result.scalar_one_or_none()
    booking.receiver_id = receiver.id
    booking.status = "pending"

    pkg_result = await db.execute(select(Package).where(Package.id == booking.package_id))
    pkg = pkg_result.scalar_one_or_none()
    if pkg:
        pkg.receiver_id = receiver.id

    inv.accepted_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "status": "confirmed",
        "account_created": account_created,
        "temp_password": temp_password,
        "receiver_email": receiver.email,
    }


@router.post("/{token}/refuse")
async def refuse_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
    lang: str = Depends(get_lang),
):
    """Le récepteur refuse — booking reste awaiting_receiver (l'expéditeur peut changer le récepteur)."""
    result = await db.execute(
        select(ReceiverInvitation).where(ReceiverInvitation.token == token)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail=t("errors.invitation_not_found", lang))
    if inv.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail=t("errors.invitation_expired", lang))
    if inv.accepted_at or inv.refused_at:
        raise HTTPException(status_code=409, detail=t("errors.invitation_already_actioned", lang))

    inv.refused_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "refused"}
