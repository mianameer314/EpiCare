"""
Patient profile schemas.
"""
from datetime import date, datetime

from pydantic import BaseModel, Field


class PatientProfileBase(BaseModel):
    """Shared patient profile fields."""

    full_name: str = Field(..., min_length=1, max_length=150)
    date_of_birth: date | None = None
    gender: str | None = Field(None, max_length=30)
    height_cm: float | None = Field(None, gt=0, le=300)
    weight_kg: float | None = Field(None, gt=0, le=500)
    known_triggers: list[str] | None = None
    notes: str | None = None
    timezone: str = "UTC"


class PatientProfileCreate(PatientProfileBase):
    """Request body for creating a patient profile."""


class PatientProfileUpdate(PatientProfileBase):
    """Request body for updating a patient profile (all fields optional)."""


class PatientProfileOut(PatientProfileBase):
    """Response model for a patient profile."""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
