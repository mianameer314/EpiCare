"""
Medication schemas — CRUD, schedules, logs, and adherence.
"""
from pydantic import Field

from app.schemas.base import StrictDate, StrictDatetime, StrictModel, StrictTime
from app.schemas.common import PaginatedResponse


class MedicationCreate(StrictModel):
    """Request body for creating a medication."""

    name: str = Field(..., min_length=1, max_length=150)
    dosage: str = Field(..., min_length=1, max_length=100)
    frequency: str = Field(..., min_length=1, max_length=50)
    start_date: StrictDate
    notes: str | None = None
    is_active: bool = True


class MedicationUpdate(StrictModel):
    """Request body for updating a medication."""

    name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    start_date: StrictDate | None = None
    notes: str | None = None
    is_active: bool | None = None


class MedicationOut(StrictModel):
    """Response model for a medication."""

    id: int
    user_id: int
    name: str
    dosage: str
    frequency: str
    start_date: StrictDate
    notes: str | None
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


class MedicationLogOut(StrictModel):
    """Response model for a medication log."""

    id: int
    medication_id: int
    taken_at: StrictDatetime
    status: str
    dose_taken: str | None

    model_config = {"from_attributes": True, "strict": True}


class AdherenceOut(StrictModel):
    """Adherence percentage summary."""

    adherence_percent: float
    taken: int
    missed: int
    total: int
