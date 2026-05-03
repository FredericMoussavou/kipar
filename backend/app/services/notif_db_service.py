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
    await db.commit()
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
