"""
System schemas — health and model status responses.
"""
from app.schemas.base import StrictModel


class HealthOut(StrictModel):
    """Liveness response."""

    status: str


class ModelStatusOut(StrictModel):
    """Model registry status."""

    model: str
    version: str | None
    status: str  # loaded | unavailable | loading
