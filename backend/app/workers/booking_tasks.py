import logging
from datetime import datetime, timedelta, timezone
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.booking_tasks.expire_pending_bookings")
def expire_pending_bookings():
    """
    Expire les reservations PENDING non payees apres PENDING_BOOKING_TTL_HOURS (1h).
    Recredite les kg, reouvre l'annonce (request), passe le booking en 'expired'.
    Planifie toutes les 30 min via Celery Beat.
    """
    import asyncio
    from sqlalchemy import select, update, func
    from app.core.database import AsyncSessionLocal
    from app.core.config import settings
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.package import Package
    from app.models.package_request import PackageRequest, Application

    async def _run():
        async with AsyncSessionLocal() as db:
            cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.PENDING_BOOKING_TTL_HOURS)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "pending",
                    func.coalesce(Booking.promoted_at, Booking.created_at) < cutoff,
                )
            )
            bookings = result.scalars().all()

            for booking in bookings:
                # Recrediter les kg tenus
                if booking.kg_held:
                    trip = (await db.execute(select(Trip).where(Trip.id == booking.trip_id))).scalar_one_or_none()
                    pkg = (await db.execute(select(Package).where(Package.id == booking.package_id))).scalar_one_or_none()
                    if trip and pkg:
                        trip.remaining_kg += pkg.weight_kg
                        if trip.status == "full":
                            trip.status = "open"
                    booking.kg_held = False
                # Liberer une eventuelle autorisation Stripe (rare : un pending n'a normalement pas d'escrow)
                if booking.escrow_ref and not booking.escrow_ref.startswith("pi_simulated"):
                    try:
                        from app.services.stripe_service import cancel_payment_intent
                        await cancel_payment_intent(booking.escrow_ref)
                    except Exception as _e:
                        logger.warning(f"Booking {booking.id} cancel PI echec: {_e}")
                # Reouvrir l'annonce + refuser la candidature acceptee (flux request)
                if booking.package_request_id:
                    req = (await db.execute(select(PackageRequest).where(PackageRequest.id == booking.package_request_id))).scalar_one_or_none()
                    if req and req.status == "matched":
                        req.status = "open"
                    app_acc = (await db.execute(
                        select(Application).where(
                            Application.package_request_id == booking.package_request_id,
                            Application.status == "accepted",
                        )
                    )).scalars().all()
                    for _app in app_acc:
                        _app.status = "refused"
                booking.status = "expired"
                logger.info(f"Booking {booking.id} expired after {settings.PENDING_BOOKING_TTL_HOURS}h")
            cutoff_48h = datetime.now(timezone.utc) - timedelta(hours=48)
            result_ar = await db.execute(
                select(Booking).where(
                    Booking.status == "awaiting_receiver",
                    func.coalesce(Booking.promoted_at, Booking.created_at) < cutoff_48h,
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
def release_payment_after_delivery(booking_id: str, delay_hours: int = 48):
    """Programme le versement transporteur a delivered + delay_hours (48h par defaut).

    Ne verse plus rien directement : la fenetre de litige court, puis
    process_due_payouts (worker horaire) execute la cascade de versement.
    La notification 'paiement libere' part a l'execution reelle.
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.user import User

    async def _run():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Booking).where(Booking.id == booking_id))
            booking = result.scalar_one_or_none()
            if not booking or booking.status != "delivered":
                logger.warning(f"Booking {booking_id} not found or not delivered")
                return

            result = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
            trip = result.scalar_one_or_none()
            carrier = None
            if trip:
                result = await db.execute(select(User).where(User.id == trip.carrier_id))
                carrier = result.scalar_one_or_none()

            from app.services.payout_service import schedule_payout
            await schedule_payout(db, booking, carrier, delay_hours=delay_hours)
            await db.commit()

    asyncio.run(_run())


@celery_app.task(name="app.workers.booking_tasks.process_due_payouts")
def process_due_payouts():
    """Execute les versements transporteurs dus. Planifie toutes les heures via Beat.

    Prend tout payout scheduled/pending/failed dont due_at est echue et
    attempts < MAX_ATTEMPTS, applique la cascade (execute_payout), et notifie
    le transporteur en cas de versement reussi.
    """
    import asyncio
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.user import User
    from app.models.payout_ledger import PayoutLedger
    from app.services.payout_service import execute_payout, MAX_ATTEMPTS

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(PayoutLedger).where(
                    PayoutLedger.status.in_(("scheduled", "pending", "failed")),
                    PayoutLedger.due_at.isnot(None),
                    PayoutLedger.due_at <= now,
                    PayoutLedger.attempts < MAX_ATTEMPTS,
                )
            )
            entries = result.scalars().all()
            n_paid = 0
            for entry in entries:
                r = await db.execute(select(Booking).where(Booking.id == entry.booking_id))
                booking = r.scalar_one_or_none()
                r = await db.execute(select(User).where(User.id == entry.carrier_id))
                carrier = r.scalar_one_or_none()
                try:
                    await execute_payout(db, entry, booking, carrier)
                except Exception as e:
                    logger.error(f"[PAYOUT] execute error entry {entry.id}: {e}")
                    entry.status = "failed"
                    entry.failure_reason = "internal_error"
                    entry.attempts = (entry.attempts or 0) + 1
                await db.commit()
                if entry.status == "paid":
                    n_paid += 1
                    if carrier and carrier.fcm_token:
                        try:
                            from app.i18n.loader import t
                            from app.services.notification_service import send_push
                            await send_push(
                                carrier.fcm_token, "KIPAR.",
                                t("notifications.payment_released", carrier.language,
                                  amount=entry.amount, currency=entry.currency),
                            )
                        except Exception:
                            pass
            logger.info(f"[PAYOUT] {len(entries)} payouts dus traites, {n_paid} verses")

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
    from app.services.stripe_service import settle_cancellation_refund
    from app.core.config import settings as _cfg

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
                    # C3a refund integral incident timeout (pickup)
                    if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and _cfg.STRIPE_SECRET_KEY:
                        try:
                            await settle_cancellation_refund(booking.escrow_ref, booking.amount, 0.0, None, str(booking.id))
                        except Exception as e:
                            logger.error(f"[INCIDENT_TIMEOUT] Refund pickup booking {booking.id}: {e}")
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
                        # C3a refund integral incident timeout (delivery)
                        if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and _cfg.STRIPE_SECRET_KEY:
                            try:
                                await settle_cancellation_refund(booking.escrow_ref, booking.amount, 0.0, None, str(booking.id))
                            except Exception as e:
                                logger.error(f"[INCIDENT_TIMEOUT] Refund delivery booking {booking.id}: {e}")
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
    from sqlalchemy import select, func
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.package import Package
    from app.models.user import User
    from app.services.notif_db_service import create_notification
    from app.services.stripe_service import settle_cancellation_refund

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(hours=48)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "awaiting_receiver",
                    func.coalesce(Booking.promoted_at, Booking.created_at) < cutoff,
                )
            )
            bookings = result.scalars().all()
            for booking in bookings:
                booking.status = "cancelled"
                booking.cancellation_reason = "awaiting_receiver_timeout_48h"

                # Remboursement integral expediteur (selon etat reel du PaymentIntent)
                if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated"):
                    from app.core.config import settings as s
                    if s.STRIPE_SECRET_KEY:
                        try:
                            await settle_cancellation_refund(booking.escrow_ref, booking.amount, 0.0, None, str(booking.id))
                        except Exception as e:
                            logger.error(f"[AWAITING] Erreur remboursement booking {booking.id}: {e}")

                # Restituer les kg au trip
                trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
                trip = trip_r.scalar_one_or_none()
                pkg_r = await db.execute(select(Package).where(Package.id == booking.package_id))
                pkg = pkg_r.scalar_one_or_none()
                if trip and pkg and booking.kg_held:
                    trip.remaining_kg += pkg.weight_kg
                    if trip.status == "full":
                        trip.status = "open"
                    booking.kg_held = False

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


@celery_app.task(name="app.workers.booking_tasks.expire_pending_kyc_bookings")
def expire_pending_kyc_bookings():
    """
    Expire les pre-reservations pending_kyc dont le delai KYC est depasse.
    Restitue les kg (si tenus) et notifie transporteur + expediteur. Horaire via Beat.
    """
    import asyncio
    from datetime import datetime, timezone
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.package import Package
    from app.services.notif_db_service import create_notification

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "pending_kyc",
                    Booking.pending_kyc_expires_at.isnot(None),
                    Booking.pending_kyc_expires_at < now,
                )
            )
            bookings = result.scalars().all()
            for booking in bookings:
                booking.status = "kyc_expired"
                booking.cancellation_reason = "pending_kyc_timeout"

                trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
                trip = trip_r.scalar_one_or_none()
                if booking.kg_held and trip:
                    pkg_r = await db.execute(select(Package).where(Package.id == booking.package_id))
                    pkg = pkg_r.scalar_one_or_none()
                    if pkg:
                        trip.remaining_kg += pkg.weight_kg
                        if trip.status == "full":
                            trip.status = "open"
                    booking.kg_held = False

                await create_notification(
                    db=db, user_id=booking.sender_id,
                    type="pending_kyc_expired",
                    title="Pre-reservation expiree",
                    body="Votre identite n'a pas ete validee a temps. La pre-reservation a expire.",
                    link=f"/packages/{booking.id}",
                )
                if trip:
                    await create_notification(
                        db=db, user_id=trip.carrier_id,
                        type="pending_kyc_expired",
                        title="Creneau de nouveau disponible",
                        body="Une pre-reservation en attente KYC a expire. Les kg sont de nouveau disponibles.",
                        link="/carrier",
                    )
                logger.info(f"[PENDING_KYC] Booking {booking.id} expire (delai KYC depasse)")
            await db.commit()
            logger.info(f"[PENDING_KYC] {len(bookings)} pre-reservation(s) expiree(s)")

    asyncio.run(_run())

@celery_app.task(name="app.workers.booking_tasks.expire_unaccepted_paid_bookings")
def expire_unaccepted_paid_bookings():
    """
    Annule les bookings 'paid' que le transporteur n'a pas acceptes a temps.
    Delai : 24h si vol urgent, 48h sinon (depuis paid_at).
    Liberation integrale du hold (aucun frais expediteur), restitution des kg.
    Annulation neutre (pas de penalite transporteur). Toutes les 15 min via Beat.
    """
    import asyncio
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.config import settings
    from app.models.booking import Booking
    from app.models.trip import Trip
    from app.models.package import Package
    from app.services.notif_db_service import create_notification
    from app.services.stripe_service import settle_cancellation_refund

    async def _run():
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            normal_cutoff = now - timedelta(hours=settings.CARRIER_ACCEPT_TTL_HOURS)
            urgent_cutoff = now - timedelta(hours=settings.CARRIER_ACCEPT_TTL_URGENT_HOURS)
            result = await db.execute(
                select(Booking).where(
                    Booking.status == "paid",
                    Booking.paid_at.isnot(None),
                )
            )
            candidates = result.scalars().all()
            expired = []
            for booking in candidates:
                cutoff = urgent_cutoff if booking.is_urgent else normal_cutoff
                if booking.paid_at < cutoff:
                    expired.append(booking)
            for booking in expired:
                booking.status = "cancelled"
                booking.cancellation_reason = "carrier_no_response_timeout"

                if booking.escrow_ref and booking.payment_rail == "stripe" and not booking.escrow_ref.startswith("pi_simulated") and settings.STRIPE_SECRET_KEY:
                    try:
                        await settle_cancellation_refund(booking.escrow_ref, booking.amount, 0.0, None, str(booking.id))
                    except Exception as e:
                        logger.error(f"[CARRIER_TIMEOUT] Erreur liberation hold booking {booking.id}: {e}")

                trip_r = await db.execute(select(Trip).where(Trip.id == booking.trip_id))
                trip = trip_r.scalar_one_or_none()
                if booking.kg_held and trip:
                    pkg_r = await db.execute(select(Package).where(Package.id == booking.package_id))
                    pkg = pkg_r.scalar_one_or_none()
                    if pkg:
                        trip.remaining_kg += pkg.weight_kg
                        if trip.status == "full":
                            trip.status = "open"
                    booking.kg_held = False

                await create_notification(
                    db=db, user_id=booking.sender_id,
                    type="carrier_no_response",
                    title="Reservation annulee",
                    body="Le transporteur n'a pas repondu a temps. Votre reservation est annulee et integralement remboursee.",
                    link=f"/packages/{booking.id}",
                )
                if trip:
                    await create_notification(
                        db=db, user_id=trip.carrier_id,
                        type="carrier_no_response",
                        title="Creneau de nouveau disponible",
                        body="Une reservation payee a expire faute de reponse. Les kg sont de nouveau disponibles.",
                        link="/carrier",
                    )
                logger.info(f"[CARRIER_TIMEOUT] Booking {booking.id} annule (transporteur sans reponse)")
            await db.commit()
            logger.info(f"[CARRIER_TIMEOUT] {len(expired)} booking(s) paid expire(s)")

    asyncio.run(_run())
