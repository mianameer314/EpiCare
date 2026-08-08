"""
Logging configuration for the EpiCare backend.
Same format as BRANDING-SYSTEM: timestamp | level | logger | message.
"""
import logging

from app.core.config import settings


def configure_logging() -> None:
    """Configure the root logger once at application startup."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
