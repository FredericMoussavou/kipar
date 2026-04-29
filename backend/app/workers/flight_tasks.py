import logging
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.flight_tasks.poll_active_flights")
def poll_active_flights():
    """
    Interroge AviationStack pour tous les trajets en transit.
    Notifie expéditeur et récepteur si statut change.
    Planifié toutes les 15 min via Celery Beat.
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.trip import Trip
    from app.models.flight import FlightTracking
    from app.services.flight_service import fetch_flight_status

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(FlightTracking).join(Trip).where(Trip.status == "in_transit")
            )
            trackings = result.scalars().all()

            for tracking in trackings:
                flight_data = await fetch_flight_status(tracking.flight_number)
                if not flight_data:
                    continue

                old_status = tracking.status
                new_status = flight_data["status"]

                if old_status != new_status:
                    tracking.status = new_status
                    tracking.arrival_estimated = flight_data.get("arrival_estimated")
                    if flight_data.get("arrival_actual"):
                        tracking.arrival_actual = flight_data["arrival_actual"]

                    from datetime import datetime, timezone
                    tracking.last_checked_at = datetime.now(timezone.utc)

                    # Notifie si atterri ou retardé
                    if new_status in ("landed", "delayed"):
                        track_flight_notify.delay(
                            str(tracking.trip_id),
                            new_status,
                            str(flight_data.get("arrival_estimated", ""))
                        )
                    logger.info(f"Flight {tracking.flight_number}: {old_status} → {new_status}")

            await db.commit()

    asyncio.run(_run())


@celery_app.task(name="app.workers.flight_tasks.track_flight_notify")
def track_flight_notify(trip_id: str, status: str, arrival: str):
    """Notifie expéditeur et récepteur d'un changement de statut de vol."""
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.trip import Trip
    from app.models.booking import Booking
    from app.models.user import User
    from app.services.notification_service import notify_flight_status

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Booking).where(
                    Booking.trip_id == trip_id,
                    Booking.status == "in_transit"
                )
            )
            bookings = result.scalars().all()

            for booking in bookings:
                result = await db.execute(select(User).where(User.id == booking.sender_id))
                sender = result.scalar_one_or_none()
                receiver = None
                if booking.receiver_id:
                    result = await db.execute(select(User).where(User.id == booking.receiver_id))
                    receiver = result.scalar_one_or_none()

                await notify_flight_status(
                    sender_fcm_token=sender.fcm_token if sender else None,
                    receiver_fcm_token=receiver.fcm_token if receiver else None,
                    status=status,
                    arrival=arrival,
                    lang=sender.language if sender else "fr",
                )

    asyncio.run(_run())
