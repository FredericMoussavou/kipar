import logging
from datetime import datetime, timedelta, timezone
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.booking_tasks.expire_pending_bookings")
def expire_pending_bookings():
    """
    Annule les réservations PENDING sans réponse après 12h.
    Planifié toutes les 30 min via Celery Beat.
    """
    import asyncio
    from sqlalchemy import select, update
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking

    async def _run():
        async with AsyncSessionLocal() as db:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "pending",
                    Booking.created_at < cutoff,
                )
            )
            bookings = result.scalars().all()

            for booking in bookings:
                booking.status = "refused"
                logger.info(f"Booking {booking.id} expired after 12h")

            await db.commit()
            logger.info(f"Expired {len(bookings)} pending bookings")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.release_payment_after_delivery")
def release_payment_after_delivery(booking_id: str):
    """
    Libère le paiement vers le transporteur 24h après confirmation de livraison.
    Appelé par l'endpoint /delivery/{id}/validate après confirmation.
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.user import User
    from app.services.stripe_service import release_payment_to_carrier
    from app.services.notification_service import send_push

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Booking).where(Booking.id == booking_id))
            booking = result.scalar_one_or_none()
            if not booking or booking.status != "delivered":
                logger.warning(f"Booking {booking_id} not found or not delivered")
                return

            result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
            trip = result.scalar_one_or_none()
            result = await db.execute(select(User).where(User.id == trip.carrier_id))
            carrier = result.scalar_one_or_none()

            if booking.payment_rail == "stripe" and carrier.stripe_account_id:
                success = await release_payment_to_carrier(
                    payment_intent_id=booking.escrow_ref,
                    carrier_stripe_account=carrier.stripe_account_id,
                    amount_eur=booking.amount,
                )
                if success:
                    logger.info(f"Payment released for booking {booking_id}")
                    if carrier.fcm_token:
                        from app.i18n.loader import t
                        await send_push(
                            carrier.fcm_token,
                            "KIPAR.",
                            t("notifications.payment_released", carrier.language, amount=booking.amount)
                        )
                else:
                    logger.error(f"Payment release failed for booking {booking_id}")

            await db.commit()

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.auto_release_escrow")
def auto_release_escrow():
    """
    Libère automatiquement l'escrow après 7 jours sans litige.
    Protection contre les récepteurs qui refusent de valider sans raison.
    Planifié toutes les 6h via Celery Beat.
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking

    async def _run():
        async with AsyncSessionLocal() as db:
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "in_transit",
                    Booking.paid_at < cutoff,
                )
            )
            bookings = result.scalars().all()

            for booking in bookings:
                booking.status = "delivered"
                booking.delivery_confirmed_at = datetime.now(timezone.utc)
                logger.info(f"Escrow auto-released for booking {booking.id}")
                release_payment_after_delivery.delay(str(booking.id))

            await db.commit()
            logger.info(f"Auto-released {len(bookings)} escrows")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.expire_package_requests")
def expire_package_requests():
    """
    Passe les annonces expéditeur en 'expired' si deadline_date < today.
    Planifié toutes les heures via Celery Beat.
    """
    import asyncio
    from datetime import date
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.package_request import PackageRequest

    async def _run():
        async with AsyncSessionLocal() as db:
            today = date.today()
            result = await db.execute(
                select(PackageRequest).where(
                    PackageRequest.status == "open",
                    PackageRequest.deadline_date < today,
                    PackageRequest.deleted_at.is_(None),
                )
            )
            requests = result.scalars().all()
            for req in requests:
                req.status = "expired"
                logger.info(f"PackageRequest {req.id} expired")
            await db.commit()
            logger.info(f"Expired {len(requests)} package requests")

    asyncio.run(_run())
