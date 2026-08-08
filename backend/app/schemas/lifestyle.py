"""
Lifestyle schemas — sleep, trigger, and stress logs.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class SleepLogCreate(BaseModel):
    """Request body for a sleep log entry."""

    slept_at: datetime
    woke_at: datetime
    quality: int | None = Field(None, ge=1, le=5)
    notes: str | None = None


class TriggerLogCreate(BaseModel):
    """Request body for a trigger log entry."""

    trigger_name: str = Field(..., min_length=1, max_length=100)
    severity: int = Field(1, ge=1, le=5)
    occurred_at: datetime
    notes: str | None = None


class StressLogCreate(BaseModel):
    """Request body for a stress log entry."""

    severity: int = Field(1, ge=1, le=5)
    occurred_at: datetime
    notes: str | None = None


class LifestyleSummaryOut(BaseModel):
    """Aggregated lifestyle summary for the dashboard."""

    avg_sleep_minutes: float | None = None
    recent_triggers: list[str] = []
    stress_levels: list[int] = []
