"""Promotion des pre-reservations pending_kyc apres validation KYC (Lot B)."""
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.services.notif_db_service import create_notification


_SENDER_TITLE = {"fr": "Identite validee", "en": "Identity verified", "es": "Identidad verificada"}
_SENDER_BODY = {
    "fr": "Votre identite est validee. Finalisez votre reservation en procedant au paiement.",
    "en": "Your identity is verified. Complete your booking by proceeding to payment.",
    "es": "Tu identidad esta verificada. Completa tu reserva procediendo al pago.",
}
_CARRIER_TITLE = {"fr": "Reservation a confirmer", "en": "Booking to confirm", "es": "Reserva por confirmar"}
_CARRIER_BODY = {
    "fr": "Une reservation en attente de validation KYC est maintenant disponible a l'acceptation.",
    "en": "A booking pending KYC validation is now available to accept.",
    "es": "Una reserva pendiente de validacion KYC ya esta disponible para aceptar.",
}


async def promote_pending_kyc_bookings(user: User, db: AsyncSession) -> int:
    """Passe les pre-reservations pending_kyc de l'utilisateur a l'etat actif.

    Appelee UNIQUEMENT quand kyc_status == "approved" (webhook KYC, admin, simulate-verify).
    Ne committe pas (l'appelant committe). Retourne le nombre de bookings promus.
    """
    now = datetime.now(timezone.utc)
    if user.kyc_approved_at is None:
        user.kyc_approved_at = now

    result = await db.execute(
        select(Booking).where(
            Booking.sender_id == user.id,
            Booking.status == "pending_kyc",
        )
    )
    bookings = result.scalars().all()
    slang = user.language or "fr"

    for booking in bookings:
        booking.status = "pending" if booking.receiver_id else "awaiting_receiver"
        booking.promoted_at = now
        booking.pending_kyc_expires_at = None

        await create_notification(
            db=db, user_id=booking.sender_id,
            type="pending_kyc_promoted",
            title=_SENDER_TITLE.get(slang, _SENDER_TITLE["fr"]),
            body=_SENDER_BODY.get(slang, _SENDER_BODY["fr"]),
            link=f"/packages/{booking.id}",
        )


    return len(bookings)
