"""
System schemas — health and model status responses.
"""
from pydantic import BaseModel


class HealthOut(BaseModel):
    """Liveness response."""

    status: str


class ModelStatusOut(BaseModel):
    """Model registry status."""

    model: str
    version: str | None
    status: str  # loaded | unavailable | loading
