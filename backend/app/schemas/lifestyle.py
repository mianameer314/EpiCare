"""
Lifestyle schemas — sleep, trigger, and stress logs.
"""
from pydantic import Field

from app.schemas.base import StrictDatetime, StrictModel


class SleepLogCreate(StrictModel):
    """Request body for a sleep log entry."""

    slept_at: StrictDatetime
    woke_at: StrictDatetime
    quality: int | None = Field(None, ge=1, le=5)
    notes: str | None = None


class TriggerLogCreate(StrictModel):
    """Request body for a trigger log entry."""

    trigger_name: str = Field(..., min_length=1, max_length=100)
    severity: int = Field(1, ge=1, le=5)
    occurred_at: StrictDatetime
    notes: str | None = None


class StressLogCreate(StrictModel):
    """Request body for a stress log entry."""

    severity: int = Field(1, ge=1, le=5)
    occurred_at: StrictDatetime
    notes: str | None = None


class LifestyleSummaryOut(StrictModel):
    """Aggregated lifestyle summary for the dashboard."""

    avg_sleep_minutes: float | None = None
    recent_triggers: list[str] = []
    stress_levels: list[int] = []

class SleepLogOut(StrictModel):
    id: int
    user_id: int
    slept_at: StrictDatetime
    woke_at: StrictDatetime
    duration_minutes: int
    quality: int | None
    notes: str | None
    created_at: StrictDatetime
    updated_at: StrictDatetime
    model_config = {"from_attributes": True, "strict": True}

class TriggerLogOut(StrictModel):
    id: int
    user_id: int
    trigger_name: str
    severity: int
    occurred_at: StrictDatetime
    notes: str | None
    created_at: StrictDatetime
    updated_at: StrictDatetime
    model_config = {"from_attributes": True, "strict": True}

class LifestyleLogOut(StrictModel):
    id: int
    user_id: int
    log_type: str
    occurred_at: StrictDatetime
    notes: str | None
    created_at: StrictDatetime
    updated_at: StrictDatetime
    model_config = {"from_attributes": True, "strict": True}
