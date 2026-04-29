import logging
import sys
from app.core.config import settings


def setup_logging():
    """
    Configure les logs selon l'environnement.
    - Dev : logs lisibles en console
    - Prod : logs JSON pour ingestion par Datadog/CloudWatch
    """
    log_level = logging.DEBUG if not settings.is_production else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(handler)

    # Réduit le bruit des libs tierces
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
