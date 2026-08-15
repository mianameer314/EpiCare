"""
Medication schemas — CRUD, schedules, logs, and adherence.
"""
from pydantic import Field

from app.schemas.base import StrictDate, StrictDatetime, StrictModel, StrictTime
from app.schemas.common import PaginatedResponse


class MedicationCreate(StrictModel):
    """Request body for creating a medication."""

    name: str = Field(..., min_length=1, max_length=150)
    generic_name: str | None = Field(None, max_length=150)
    brand_name: str | None = Field(None, max_length=150)
    dosage: str = Field(..., min_length=1, max_length=100)
    frequency: str = Field(..., min_length=1, max_length=50)
    intake_timing: str | None = Field(None, max_length=100)
    start_date: StrictDate
    end_date: StrictDate | None = None
    notes: str | None = None
    prescribed_by_doctor_id: int | None = None
    is_active: bool = True


class MedicationUpdate(StrictModel):
    """Request body for updating a medication."""

    name: str | None = None
    generic_name: str | None = None
    brand_name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    intake_timing: str | None = None
    start_date: StrictDate | None = None
    end_date: StrictDate | None = None
    notes: str | None = None
    prescribed_by_doctor_id: int | None = None
    is_active: bool | None = None


class MedicationOut(StrictModel):
    """Response model for a medication."""

    id: int
    user_id: int
    name: str
    generic_name: str | None = None
    brand_name: str | None = None
    dosage: str
    frequency: str
    intake_timing: str | None = None
    start_date: StrictDate
    end_date: StrictDate | None = None
    notes: str | None
    prescribed_by_doctor_id: int | None = None
    prescribed_by_name: str | None = None
    prescribed_by_pmdc: str | None = None
    is_active: bool
    created_at: StrictDatetime
    updated_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}


class MedicationList(PaginatedResponse[MedicationOut]):
    """Paginated medication list."""


class MedicationScheduleCreate(StrictModel):
    """Request body for creating a schedule."""

    scheduled_time: StrictTime
    days_of_week: list[int] | None = None  # 0=Monday ... 6=Sunday
    reminder_enabled: bool = True


class MedicationScheduleOut(StrictModel):
    """Response model for a schedule."""

    id: int
    medication_id: int
    scheduled_time: StrictTime
    days_of_week: list[int] | None
    reminder_enabled: bool

    model_config = {"from_attributes": True, "strict": True}


class MedicationLogCreate(StrictModel):
    """Request body for logging a dose."""

    status: str = "TAKEN"  # TAKEN | MISSED | SKIPPED
    dose_taken: str | None = None
    notes: str | None = None


class MedicationLogOut(StrictModel):
    """Response model for a medication log."""

    id: int
    medication_id: int
    medication_name: str | None = None
    taken_at: StrictDatetime
    status: str
    dose_taken: str | None
    notes: str | None = None

    model_config = {"from_attributes": True, "strict": True}


class TodayScheduleSlotOut(StrictModel):
    """Dynamic calculated daily slot for patient dashboard & reminders."""

    slot_id: str
    medication_id: int
    medication_name: str
    generic_name: str | None = None
    dosage: str
    frequency: str
    intake_timing: str | None = None
    time_window: str  # "Morning" | "Afternoon" | "Night"
    scheduled_time_display: str  # e.g. "08:00 AM"
    status: str  # "TAKEN" | "PENDING" | "MISSED"
    logged_at: StrictDatetime | None = None
    prescribed_by_name: str | None = None


class AdherenceStatsOut(StrictModel):
    """Adherence percentage and clinical safety summary."""

    adherence_7d_percent: float
    adherence_30d_percent: float
    taken_7d: int
    missed_7d: int
    total_7d: int
    active_prescriptions_count: int
    status_level: str  # "OPTIMAL" | "GOOD" | "AT_RISK"
    next_reminder_time: str | None = None
