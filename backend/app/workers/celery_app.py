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
    },
)
