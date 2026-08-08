"""
Patient profile schemas.
"""
from pydantic import Field

from app.schemas.base import StrictDate, StrictDatetime, StrictModel


class PatientProfileBase(StrictModel):
    """Shared patient profile fields."""

    full_name: str = Field(..., min_length=1, max_length=150)
    date_of_birth: StrictDate | None = None
    gender: str | None = Field(None, max_length=30)
    height_cm: float | None = Field(None, gt=0, le=300)
    weight_kg: float | None = Field(None, gt=0, le=500)
    known_triggers: list[str] | None = None
    notes: str | None = None
    timezone: str = "UTC"


class PatientProfileCreate(PatientProfileBase):
    """Request body for creating a patient profile."""


class PatientProfileUpdate(StrictModel):
    """Request body for updating a patient profile (all fields optional)."""

    full_name: str | None = Field(None, min_length=1, max_length=150)
    date_of_birth: StrictDate | None = None
    gender: str | None = Field(None, max_length=30)
    height_cm: float | None = Field(None, gt=0, le=300)
    weight_kg: float | None = Field(None, gt=0, le=500)
    known_triggers: list[str] | None = None
    notes: str | None = None
    timezone: str | None = None


class PatientProfileOut(PatientProfileBase):
    """Response model for a patient profile."""

    id: int
    user_id: int
    created_at: StrictDatetime
    updated_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}
