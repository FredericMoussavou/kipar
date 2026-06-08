from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "kipar",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.booking_tasks",
        "app.workers.flight_tasks",
        "app.workers.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        # Expire les réservations sans réponse toutes les 30 min
        "expire-pending-bookings": {
            "task": "app.workers.booking_tasks.expire_pending_bookings",
            "schedule": crontab(minute="*/30"),
        },
        # Libère l'escrow automatiquement toutes les 6h
        "auto-release-escrow": {
            "task": "app.workers.booking_tasks.auto_release_escrow",
            "schedule": crontab(minute=0, hour="*/6"),
        },
        # Poll les vols actifs toutes les 15 min
        "poll-active-flights": {
            "task": "app.workers.flight_tasks.poll_active_flights",
            "schedule": crontab(minute="*/15"),
        },
        # Expire les trips dont le départ est passé toutes les heures
        "expire-old-trips": {
            "task": "app.workers.booking_tasks.expire_old_trips",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        # Resout automatiquement les incidents 48h expirés toutes les heures
        "incident-response-timeout": {
            "task": "app.workers.booking_tasks.incident_response_timeout",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        # Alerte livraisons en retard une fois par jour a minuit
        "delivery-timeout-check": {
            "task": "app.workers.booking_tasks.delivery_timeout_check",
            "schedule": crontab(minute=0, hour=0),
        },
        # Rappels RDV livraison toutes les heures
        "send-delivery-reminders": {
            "task": "app.workers.booking_tasks.send_delivery_reminders",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        # Expire les annonces expéditeur toutes les heures
        "expire-package-requests": {
            "task": "app.workers.booking_tasks.expire_package_requests",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        # Rappels awaiting_receiver 24h et 36h - toutes les heures
        "remind-awaiting-receiver-24h": {
            "task": "app.workers.booking_tasks.remind_awaiting_receiver_24h",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        "remind-awaiting-receiver-36h": {
            "task": "app.workers.booking_tasks.remind_awaiting_receiver_36h",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        # Expire les bookings awaiting_receiver apres 48h - toutes les heures
        "expire-awaiting-receiver-bookings": {
            "task": "app.workers.booking_tasks.expire_awaiting_receiver_bookings",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        # Expire les pre-reservations pending_kyc (delai KYC depasse) - horaire
        "expire-pending-kyc-bookings": {
            "task": "app.workers.booking_tasks.expire_pending_kyc_bookings",
            "schedule": crontab(minute=0, hour="*/1"),
        },
        # Expire les abonnements premium une fois par jour
        "expire-premium-subscriptions": {
            "task": "app.workers.booking_tasks.expire_premium_subscriptions",
            "schedule": crontab(minute=0, hour=1),
        },
    },
)
