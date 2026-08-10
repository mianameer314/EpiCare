"""
Lifestyle schemas — sleep, trigger, and stress logs.
"""
from pydantic import Field
from typing import Literal

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


class MenstruationLogCreate(StrictModel):
    """Request body for a menstruation cycle log."""
    occurred_at: StrictDatetime
    flow_intensity: Literal["Light", "Medium", "Heavy"] = Field(..., description="e.g., Light, Medium, Heavy")
    notes: str | None = None


class DietLogCreate(StrictModel):
    """Request body for diet and alcohol intake log."""
    occurred_at: StrictDatetime
    keto_compliant: bool | None = None
    alcohol_units: int | None = Field(None, ge=0)
    notes: str | None = None


class IllnessLogCreate(StrictModel):
    """Request body for an illness or fever log."""
    occurred_at: StrictDatetime
    temperature_f: float | None = Field(None, description="Body temperature in Fahrenheit")
    illness_type: str | None = Field(None, description="e.g., Flu, Cold, Infection")
    notes: str | None = None


class MedSideEffectLogCreate(StrictModel):
    """Request body for medication side effect logging."""
    occurred_at: StrictDatetime
    medication_name: str
    severity: int = Field(1, ge=1, le=5)
    symptom: str = Field(..., description="e.g., Dizziness, Fatigue, Nausea")
    notes: str | None = None


class ScreenTimeLogCreate(StrictModel):
    """Request body for screen time logging."""
    occurred_at: StrictDatetime
    duration_hours: int = Field(0, ge=0, description="Hours of screen time")
    duration_minutes: int = Field(0, ge=0, le=59, description="Minutes of screen time")
    device_type: str | None = Field(None, description="e.g., Phone, Computer, TV")
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
    metadata_dict: dict | None = None
    notes: str | None
    created_at: StrictDatetime
    updated_at: StrictDatetime
    model_config = {"from_attributes": True, "strict": True}


class SleepLogUpdate(StrictModel):
    """Request body for updating a sleep log entry."""
    slept_at: StrictDatetime | None = None
    woke_at: StrictDatetime | None = None
    quality: int | None = Field(None, ge=1, le=5)
    notes: str | None = None


class TriggerLogUpdate(StrictModel):
    """Request body for updating a trigger log entry."""
    severity: int | None = Field(None, ge=1, le=5)
    occurred_at: StrictDatetime | None = None
    notes: str | None = None


class LifestyleLogUpdate(StrictModel):
    """Request body for updating a generic lifestyle log entry."""
    occurred_at: StrictDatetime | None = None
    metadata_dict: dict | None = None
    notes: str | None = None
