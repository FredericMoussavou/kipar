import sentry_sdk
from app.core.config import settings


def setup_sentry():
    """
    Initialise Sentry pour le monitoring des erreurs.
    Actif uniquement si SENTRY_DSN est configuré.
    """
    sentry_dsn = getattr(settings, "SENTRY_DSN", None)
    if not sentry_dsn:
        return

    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2,  # 20% des transactions tracées
        profiles_sample_rate=0.1,
    )
