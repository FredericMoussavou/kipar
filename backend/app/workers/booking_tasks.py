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
            cutoff_48h = datetime.now(timezone.utc) - timedelta(hours=48)
            result_ar = await db.execute(
                select(Booking).where(
                    Booking.status == "awaiting_receiver",
                    Booking.created_at < cutoff_48h,
                )
            )
            bookings_ar = result_ar.scalars().all()
            for booking in bookings_ar:
                booking.status = "refused"
                logger.info(f"Booking {booking.id} awaiting_receiver expired after 48h")

            await db.commit()
            logger.info(f"Expired {len(bookings)} pending + {len(bookings_ar)} awaiting_receiver bookings")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.expire_old_trips")
def expire_old_trips():
    """
    Passe les trips dont departure_date+departure_time est depasse en statut 'expired'.
    Planifie toutes les heures via Celery Beat.
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.trip import Trip
    from datetime import date, time as dtime, datetime, timezone

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Trip).where(
                    Trip.status == "open",
                    Trip.deleted_at.is_(None),
                )
            )
            trips = result.scalars().all()
            expired_count = 0
            for trip in trips:
                if trip.departure_date is None:
                    continue
                dep_time = trip.departure_time or dtime(0, 0)
                if isinstance(dep_time, str):
                    h, m = dep_time.split(":")[:2]
                    dep_time = dtime(int(h), int(m))
                dep_dt = datetime.combine(trip.departure_date, dep_time).replace(tzinfo=timezone.utc)
                if now > dep_dt:
                    trip.status = "expired"
                    expired_count += 1
                    logger.info(f"Trip {trip.id} expired")
            await db.commit()
            logger.info(f"Expired {expired_count} trips")

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
                    # Exclure les incidents actifs (fenetre 48h en cours)
                    Booking.incident_response_deadline.is_(None) |
                    (Booking.incident_response_deadline < cutoff),
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


@celery_app.task(name="app.workers.booking_tasks.incident_response_timeout")
def incident_response_timeout():
    """
    Resout automatiquement les incidents (pickup_failed / delivery_failed)
    dont la fenetre de justification 48h est expiree sans contestation.
    Favorise le declarant. Planifie toutes les heures via Celery Beat.
    """
    import asyncio
    from datetime import datetime, timezone
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.user import User
    from app.services.notif_db_service import create_notification

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Booking).where(
                    Booking.status.in_(["pickup_failed", "delivery_failed"]),
                    Booking.incident_response_deadline < now,
                )
            )
            bookings = result.scalars().all()
            for booking in bookings:
                if booking.status == "pickup_failed":
                    declared_by = booking.pickup_failed_by
                    booking.status = "cancelled"
                    booking.cancellation_reason = f"pickup_failed_timeout_{declared_by}"
                    trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
                    trip = trip_r.scalar_one_or_none()
                    if declared_by == "sender" and trip:
                        carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
                        carrier = carrier_r.scalar_one_or_none()
                        if carrier:
                            carrier.trust_score = max(0.0, carrier.trust_score - 10.0)
                    elif declared_by == "carrier":
                        sender_r = await db.execute(select(User).where(User.id == booking.sender_id))
                        sender = sender_r.scalar_one_or_none()
                        if sender:
                            sender.trust_score = max(0.0, sender.trust_score - 5.0)
                    await create_notification(
                        db=db, user_id=booking.sender_id,
                        type="pickup_failed_resolved",
                        title="Incident resolu automatiquement",
                        body="La fenetre de 48h est expiree. Le remboursement va etre traite.",
                        link=f"/packages/{booking.id}",
                    )
                elif booking.status == "delivery_failed":
                    declared_by = booking.delivery_failed_by
                    if declared_by == "carrier":
                        booking.status = "delivered"
                        booking.delivery_confirmed_at = now
                        release_payment_after_delivery.delay(str(booking.id))
                    else:
                        booking.status = "cancelled"
                        booking.cancellation_reason = "delivery_failed_carrier_fault_timeout"
                    await create_notification(
                        db=db, user_id=booking.sender_id,
                        type="delivery_failed_resolved",
                        title="Incident resolu automatiquement",
                        body="La fenetre de 48h est expiree. Le dossier a ete resolu.",
                        link=f"/packages/{booking.id}",
                    )
                logger.info(f"Incident timeout : booking {booking.id} -> {booking.status}")
            await db.commit()
            logger.info(f"Incident timeout : {len(bookings)} booking(s) resolus")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.delivery_timeout_check")
def delivery_timeout_check():
    """
    Detecte les bookings in_transit sans livraison depuis DELIVERY_TIMEOUT_DAYS.
    Alerte admin, notifie expediteur + transporteur.
    Planifie une fois par jour via Celery Beat.
    """
    import asyncio
    from datetime import datetime, timezone, timedelta, date
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.user import User
    from app.core.config import settings
    from app.services.notif_db_service import create_notification

    async def _run():
        async with AsyncSessionLocal() as db:
            timeout_date = date.today() - timedelta(days=settings.DELIVERY_TIMEOUT_DAYS)
            result = await db.execute(
                select(Booking).join(Trip, Trip.id == Booking.trip_id).where(
                    Booking.status == "in_transit",
                    Trip.departure_date < timeout_date,
                )
            )
            bookings = result.scalars().all()
            for booking in bookings:
                trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
                trip = trip_r.scalar_one_or_none()
                carrier_r = await db.execute(select(User).where(User.id == trip.carrier_id))
                carrier = carrier_r.scalar_one_or_none()
                await create_notification(
                    db=db, user_id=booking.sender_id,
                    type="delivery_timeout",
                    title="Livraison en retard",
                    body=f"Votre colis n'a pas ete livre depuis {settings.DELIVERY_TIMEOUT_DAYS} jours.",
                    link=f"/packages/{booking.id}",
                )
                if carrier:
                    await create_notification(
                        db=db, user_id=carrier.id,
                        type="delivery_timeout",
                        title="Livraison en attente",
                        body=f"Un colis n'a pas ete confirme depuis {settings.DELIVERY_TIMEOUT_DAYS} jours.",
                        link=f"/carrier",
                    )
                logger.info(f"Delivery timeout alerte : booking {booking.id}")
            await db.commit()
            logger.info(f"Delivery timeout : {len(bookings)} booking(s) en retard")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.send_delivery_reminders")
def send_delivery_reminders():
    """
    Envoie les rappels de RDV livraison aux recepteurs.
    Lance toutes les heures via Celery Beat.
    Pour chaque booking avec reminder_hours defini et delivery_meeting_date fixe,
    envoie une notif si now >= delivery_meeting_date - reminder_hours.
    """
    import asyncio
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.user import User
    from app.services.notif_db_service import create_notification

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "in_transit",
                    Booking.reminder_hours.isnot(None),
                    Booking.delivery_meeting_date.isnot(None),
                    Booking.delivery_reminder_sent.is_(False),
                )
            )
            bookings = result.scalars().all()

            for booking in bookings:
                reminder_dt = booking.delivery_meeting_date - timedelta(hours=booking.reminder_hours)
                if now >= reminder_dt:
                    if booking.receiver_id:
                        await create_notification(
                            db=db,
                            user_id=booking.receiver_id,
                            type="delivery_reminder",
                            title="Rappel RDV livraison",
                            body=f"Votre RDV de livraison est dans {booking.reminder_hours}h.",
                            link=f"/packages/{booking.id}",
                        )
                    booking.delivery_reminder_sent = True
                    logger.info(f"[REMINDER] Booking {booking.id} — rappel envoye")

            await db.commit()

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.expire_premium_subscriptions")
def expire_premium_subscriptions():
    """
    Expire les abonnements premium dont la date d'expiration est depassee.
    Planifie une fois par jour via Celery Beat.
    """
    import asyncio
    from datetime import datetime, timezone
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.user import User
    from app.models.subscription import Subscription

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(User).where(
                    User.is_premium == True,
                    User.premium_expires_at < now,
                )
            )
            users = result.scalars().all()
            for user in users:
                user.is_premium = False
                user.premium_plan = None
                # Marquer la sub comme expiree
                sub_result = await db.execute(
                    select(Subscription).where(
                        Subscription.user_id == user.id,
                        Subscription.status == "active",
                    )
                )
                sub = sub_result.scalar_one_or_none()
                if sub:
                    sub.status = "expired"
                logger.info(f"Premium expired for user {user.id}")
            await db.commit()
            logger.info(f"Expired {len(users)} premium subscription(s)")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.remind_awaiting_receiver_24h")
def remind_awaiting_receiver_24h():
    """
    Envoie un rappel au recepteur 24h apres creation du booking awaiting_receiver.
    Lance toutes les heures via Celery Beat.
    """
    import asyncio
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.user import User
    from app.services.notif_db_service import create_notification

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            cutoff_min = now - timedelta(hours=25)
            cutoff_max = now - timedelta(hours=24)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "awaiting_receiver",
                    Booking.created_at >= cutoff_min,
                    Booking.created_at <= cutoff_max,
                    Booking.awaiting_receiver_reminded_24h.is_(False),
                )
            )
            bookings = result.scalars().all()
            for booking in bookings:
                if booking.receiver_id:
                    await create_notification(
                        db=db, user_id=booking.receiver_id,
                        type="awaiting_receiver_reminder",
                        title="Rappel : colis en attente",
                        body="Un colis vous attend. Confirmez votre reception avant 48h.",
                        link=f"/packages/{booking.id}",
                    )
                booking.awaiting_receiver_reminded_24h = True
                logger.info(f"[AWAITING] Rappel 24h envoye booking {booking.id}")
            await db.commit()
            logger.info(f"[AWAITING] {len(bookings)} rappel(s) 24h envoyes")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.remind_awaiting_receiver_36h")
def remind_awaiting_receiver_36h():
    """
    Envoie un second rappel au recepteur 36h apres creation du booking awaiting_receiver.
    Lance toutes les heures via Celery Beat.
    """
    import asyncio
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.user import User
    from app.services.notif_db_service import create_notification

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            cutoff_min = now - timedelta(hours=37)
            cutoff_max = now - timedelta(hours=36)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "awaiting_receiver",
                    Booking.created_at >= cutoff_min,
                    Booking.created_at <= cutoff_max,
                    Booking.awaiting_receiver_reminded_36h.is_(False),
                )
            )
            bookings = result.scalars().all()
            for booking in bookings:
                if booking.receiver_id:
                    await create_notification(
                        db=db, user_id=booking.receiver_id,
                        type="awaiting_receiver_reminder",
                        title="Dernier rappel : colis en attente",
                        body="Derniere chance : confirmez votre reception avant expiration dans 12h.",
                        link=f"/packages/{booking.id}",
                    )
                booking.awaiting_receiver_reminded_36h = True
                logger.info(f"[AWAITING] Rappel 36h envoye booking {booking.id}")
            await db.commit()
            logger.info(f"[AWAITING] {len(bookings)} rappel(s) 36h envoyes")

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.expire_awaiting_receiver_bookings")
def expire_awaiting_receiver_bookings():
    """
    Annule les bookings awaiting_receiver sans reponse apres 48h.
    Remboursement 100% expediteur. Restitue les kg au trip.
    Lance toutes les heures via Celery Beat.
    """
    import asyncio
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.package import Package
    from app.models.user import User
    from app.services.notif_db_service import create_notification

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(hours=48)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "awaiting_receiver",
                    Booking.created_at < cutoff,
                )
            )
            bookings = result.scalars().all()
            for booking in bookings:
                booking.status = "cancelled"
                booking.cancellation_reason = "awaiting_receiver_timeout_48h"

                # Remboursement 100% expediteur
                if booking.escrow_ref and booking.payment_rail == "stripe":
                    try:
                        import stripe as stripe_lib
                        from app.core.config import settings as s
                        if s.STRIPE_SECRET_KEY and not booking.escrow_ref.startswith("pi_simulated"):
                            stripe_lib.Refund.create(
                                payment_intent=booking.escrow_ref,
                                amount=int(booking.amount * 100),
                            )
                    except Exception as e:
                        logger.error(f"[AWAITING] Erreur remboursement booking {booking.id}: {e}")

                # Restituer les kg au trip
                trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
                trip = trip_r.scalar_one_or_none()
                pkg_r = await db.execute(select(Package).where(Package.id == booking.package_id))
                pkg = pkg_r.scalar_one_or_none()
                if trip and pkg:
                    trip.remaining_kg += pkg.weight_kg
                    if trip.status == "full":
                        trip.status = "open"

                # Notifier expediteur
                await create_notification(
                    db=db, user_id=booking.sender_id,
                    type="awaiting_receiver_expired",
                    title="Reservation annulee",
                    body="Le recepteur n'a pas repondu dans les 48h. Remboursement en cours.",
                    link=f"/packages/{booking.id}",
                )
                # Notifier transporteur
                if trip:
                    await create_notification(
                        db=db, user_id=trip.carrier_id,
                        type="awaiting_receiver_expired",
                        title="Reservation annulee",
                        body="Le recepteur n'a pas repondu dans les 48h. La reservation est annulee.",
                        link=f"/carrier",
                    )
                logger.info(f"[AWAITING] Booking {booking.id} annule apres 48h sans reponse")
            await db.commit()
            logger.info(f"[AWAITING] {len(bookings)} booking(s) expires")

    asyncio.run(_run())
