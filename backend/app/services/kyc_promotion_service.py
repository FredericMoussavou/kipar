"""Promotion des pre-reservations pending_kyc apres validation KYC (Lot B)."""
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.booking import Booking
from app.models.trip import Trip
from app.models.package_request import PackageRequest
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
_PUBLISHED_TITLE = {"fr": "Publication en ligne", "en": "Now published", "es": "Publicacion en linea"}
_TRIP_PUBLISHED_BODY = {
    "fr": "Votre trajet est valide et desormais visible publiquement.",
    "en": "Your trip is verified and now publicly visible.",
    "es": "Tu viaje esta verificado y ahora es visible publicamente.",
}
_REQUEST_PUBLISHED_BODY = {
    "fr": "Votre annonce est validee et desormais visible publiquement.",
    "en": "Your request is verified and now publicly visible.",
    "es": "Tu anuncio esta verificado y ahora es visible publicamente.",
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


    # Promotion des trajets pending_kyc (publication differee transporteur)
    trips_result = await db.execute(
        select(Trip).where(
            Trip.carrier_id == user.id,
            Trip.status == "pending_kyc",
            Trip.deleted_at.is_(None),
        )
    )
    trips = trips_result.scalars().all()
    for trip in trips:
        trip.status = "open"
        await create_notification(
            db=db, user_id=trip.carrier_id,
            type="trip_published",
            title=_PUBLISHED_TITLE.get(slang, _PUBLISHED_TITLE["fr"]),
            body=_TRIP_PUBLISHED_BODY.get(slang, _TRIP_PUBLISHED_BODY["fr"]),
            link=f"/trips/{trip.id}",
        )

    # Promotion des annonces pending_kyc (publication differee expediteur)
    reqs_result = await db.execute(
        select(PackageRequest).where(
            PackageRequest.sender_id == user.id,
            PackageRequest.status == "pending_kyc",
            PackageRequest.deleted_at.is_(None),
        )
    )
    reqs = reqs_result.scalars().all()
    for req in reqs:
        req.status = "open"
        await create_notification(
            db=db, user_id=req.sender_id,
            type="request_published",
            title=_PUBLISHED_TITLE.get(slang, _PUBLISHED_TITLE["fr"]),
            body=_REQUEST_PUBLISHED_BODY.get(slang, _REQUEST_PUBLISHED_BODY["fr"]),
            link=f"/requests/{req.id}",
        )

    return len(bookings) + len(trips) + len(reqs)
