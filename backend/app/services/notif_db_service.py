import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    link: str | None = None,
) -> Notification:
    """Crée une notification en BDD."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notif)
    # Pas de commit ici — c'est à l'appelant de committer
    return notif


async def notify_trip_match(
    db: AsyncSession,
    user_id: uuid.UUID,
    route: str,
    trip_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie un expéditeur qu'un trajet correspond à son annonce."""
    titles = {
        "fr": "Nouveau trajet disponible",
        "en": "New trip available",
        "es": "Nuevo viaje disponible",
    }
    bodies = {
        "fr": f"Un transporteur propose un trajet {route} qui correspond à votre annonce.",
        "en": f"A carrier offers a trip {route} matching your package request.",
        "es": f"Un transportista ofrece un viaje {route} que coincide con su anuncio.",
    }
    await create_notification(
        db=db,
        user_id=user_id,
        type="trip_match",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/trips/{trip_id}",
    )


async def notify_new_application(
    db: AsyncSession,
    user_id: uuid.UUID,
    request_id: uuid.UUID,
    carrier_name: str,
    lang: str = "fr",
) -> None:
    """Notifie un expéditeur qu'un transporteur a candidaté sur son annonce."""
    titles = {
        "fr": "Nouvelle candidature",
        "en": "New application",
        "es": "Nueva candidatura",
    }
    bodies = {
        "fr": f"{carrier_name} a candidaté sur votre annonce colis.",
        "en": f"{carrier_name} applied to your package request.",
        "es": f"{carrier_name} se postuló a su anuncio de paquete.",
    }
    await create_notification(
        db=db,
        user_id=user_id,
        type="new_application",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/requests/{request_id}",
    )

async def notify_booking_received_db(
    db: AsyncSession,
    carrier_id: uuid.UUID,
    route: str,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie le transporteur d'une nouvelle demande de booking."""
    titles = {"fr": "Nouvelle demande", "en": "New booking request", "es": "Nueva solicitud"}
    bodies = {
        "fr": f"Un expéditeur souhaite vous confier un colis pour {route}.",
        "en": f"A sender wants to entrust you with a package for {route}.",
        "es": f"Un remitente quiere confiarle un paquete para {route}.",
    }
    await create_notification(
        db=db, user_id=carrier_id, type="booking_received",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/carrier",
    )


async def notify_booking_accepted_db(
    db: AsyncSession,
    sender_id: uuid.UUID,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie l'expéditeur que sa demande a été acceptée."""
    titles = {"fr": "Demande acceptée !", "en": "Request accepted!", "es": "¡Solicitud aceptada!"}
    bodies = {
        "fr": "Votre demande de transport a été acceptée. Le transporteur prendra en charge votre colis.",
        "en": "Your transport request has been accepted. The carrier will handle your package.",
        "es": "Su solicitud de transporte fue aceptada. El transportista se encargará de su paquete.",
    }
    await create_notification(
        db=db, user_id=sender_id, type="booking_accepted",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/packages/{booking_id}",
    )


async def notify_booking_refused_db(
    db: AsyncSession,
    sender_id: uuid.UUID,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie l'expéditeur que sa demande a été refusée."""
    titles = {"fr": "Demande refusée", "en": "Request declined", "es": "Solicitud rechazada"}
    bodies = {
        "fr": "Votre demande de transport a été refusée par le transporteur.",
        "en": "Your transport request has been declined by the carrier.",
        "es": "Su solicitud de transporte fue rechazada por el transportista.",
    }
    await create_notification(
        db=db, user_id=sender_id, type="booking_refused",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/packages/{booking_id}",
    )


async def notify_in_transit_db(
    db: AsyncSession,
    sender_id: uuid.UUID,
    receiver_id: uuid.UUID | None,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie expéditeur et récepteur que le colis est en route."""
    titles = {"fr": "Colis en route !", "en": "Package on its way!", "es": "¡Paquete en camino!"}
    bodies = {
        "fr": "Le transporteur a pris en charge votre colis. Il est en route vers le récepteur.",
        "en": "The carrier has picked up your package. It is on its way to the receiver.",
        "es": "El transportista recogió su paquete. Está en camino al receptor.",
    }
    for uid in [sender_id, receiver_id]:
        if uid:
            await create_notification(
                db=db, user_id=uid, type="in_transit",
                title=titles.get(lang, titles["fr"]),
                body=bodies.get(lang, bodies["fr"]),
                link=f"/packages/{booking_id}",
            )


async def notify_delivery_confirmed_db(
    db: AsyncSession,
    sender_id: uuid.UUID,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie l'expéditeur que son colis a été livré."""
    titles = {"fr": "Colis livré !", "en": "Package delivered!", "es": "¡Paquete entregado!"}
    bodies = {
        "fr": "Votre colis a été remis au récepteur. Les fonds seront débloqués sous 24h.",
        "en": "Your package has been delivered to the receiver. Funds will be released within 24h.",
        "es": "Su paquete fue entregado al receptor. Los fondos se liberarán en 24h.",
    }
    await create_notification(
        db=db, user_id=sender_id, type="delivery_confirmed",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/packages/{booking_id}",
    )


async def notify_new_message_db(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    sender_name: str,
    excerpt: str,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie un participant qu'il a recu un nouveau message."""
    titles = {"fr": "Nouveau message", "en": "New message", "es": "Nuevo mensaje"}
    bodies = {
        "fr": f"{sender_name} : {excerpt[:60]}{'...' if len(excerpt) > 60 else ''}",
        "en": f"{sender_name}: {excerpt[:60]}{'...' if len(excerpt) > 60 else ''}",
        "es": f"{sender_name}: {excerpt[:60]}{'...' if len(excerpt) > 60 else ''}",
    }
    await create_notification(
        db=db, user_id=recipient_id, type="new_message",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/packages/{booking_id}",
    )

async def notify_booking_cancelled_by_sender_db(
    db: AsyncSession,
    carrier_id: uuid.UUID,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie le transporteur que l'expéditeur a annulé la réservation."""
    titles = {"fr": "Réservation annulée", "en": "Booking cancelled", "es": "Reserva cancelada"}
    bodies = {
        "fr": "L'expéditeur a annulé la réservation. Le créneau est de nouveau disponible.",
        "en": "The sender has cancelled the booking. The slot is available again.",
        "es": "El remitente ha cancelado la reserva. El espacio vuelve a estar disponible.",
    }
    await create_notification(
        db=db, user_id=carrier_id, type="booking_cancelled",
        title=titles.get(lang, titles["fr"]),
        body=bodies.get(lang, bodies["fr"]),
        link=f"/carrier",
    )


async def notify_booking_cancelled_by_carrier_db(
    db: AsyncSession,
    sender_id: uuid.UUID,
    receiver_id: uuid.UUID | None,
    booking_id: uuid.UUID,
    lang: str = "fr",
) -> None:
    """Notifie expéditeur (et récepteur si existant) que le transporteur a annulé."""
    titles = {"fr": "Réservation annulée par le transporteur", "en": "Booking cancelled by carrier", "es": "Reserva cancelada por el transportista"}
    bodies = {
        "fr": "Le transporteur a annulé la réservation. Vous serez remboursé intégralement.",
        "en": "The carrier has cancelled the booking. You will be fully refunded.",
        "es": "El transportista ha cancelado la reserva. Recibirá un reembolso completo.",
    }
    for uid in [sender_id, receiver_id]:
        if uid:
            await create_notification(
                db=db, user_id=uid, type="booking_cancelled",
                title=titles.get(lang, titles["fr"]),
                body=bodies.get(lang, bodies["fr"]),
                link=f"/packages/{booking_id}",
            )
