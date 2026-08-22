from datetime import date
from decimal import Decimal
from typing import Optional, Literal

from zoneinfo import available_timezones

from pydantic import Field, field_validator, model_validator

from app.schemas.base import StrictDatetime, StrictModel, StrictDate


# ------------------------------------------------------------------
# Patient Profile
# ------------------------------------------------------------------

class PatientProfileCreate(StrictModel):
    date_of_birth: StrictDate
    gender: Optional[Literal["Male", "Female", "Other", "Prefer not to say"]] = None
    blood_type: Optional[str] = Field(None, pattern=r"^(A|B|AB|O)[+-]$", max_length=10)
    city: Optional[str] = Field(None, max_length=100)
    primary_diagnosis: Optional[str] = Field(None, max_length=100)
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_relation: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{1,14}$", max_length=30)
    known_triggers: Optional[list[str]] = None
    notes: Optional[str] = None
    timezone: Optional[str] = Field("UTC", max_length=64)

    @field_validator("timezone")
    def validate_timezone(cls, v: str | None) -> str | None:
        if v and v not in available_timezones():
            raise ValueError(f"Invalid timezone: {v}. Must be a valid IANA timezone.")
        return v


class PatientProfileUpdate(StrictModel):
    date_of_birth: Optional[StrictDate] = None
    gender: Optional[Literal["Male", "Female", "Other", "Prefer not to say"]] = None
    blood_type: Optional[str] = Field(None, pattern=r"^(A|B|AB|O)[+-]$", max_length=10)
    city: Optional[str] = Field(None, max_length=100)
    primary_diagnosis: Optional[str] = Field(None, max_length=100)
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_relation: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, pattern=r"^\+?[1-9]\d{1,14}$", max_length=30)
    known_triggers: Optional[list[str]] = None
    notes: Optional[str] = None
    timezone: Optional[str] = Field(None, max_length=64)

    @field_validator("timezone")
    def validate_timezone(cls, v: str | None) -> str | None:
        if v and v not in available_timezones():
            raise ValueError(f"Invalid timezone: {v}. Must be a valid IANA timezone.")
        return v


class PatientProfileOut(StrictModel):
    id: int
    user_id: int
    date_of_birth: StrictDate
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    city: Optional[str] = None
    primary_diagnosis: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    known_triggers: Optional[list[str]] = None
    notes: Optional[str] = None
    timezone: str
    created_at: StrictDatetime
    updated_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}


# ------------------------------------------------------------------
# Doctor Profile
# ------------------------------------------------------------------

class DoctorProfileCreate(StrictModel):
    pmdc_number: str = Field(..., min_length=1, max_length=50)
    specialty: Optional[str] = Field("Neurologist", max_length=100)
    gender: Optional[Literal["Male", "Female", "Other", "Prefer not to say"]] = None
    hospital_affiliation: Optional[str] = Field(None, max_length=200)
    license_image_url: Optional[str] = Field(None, max_length=500)
    years_of_experience: Optional[int] = Field(None, ge=0, le=80)
    consultation_fee: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    available_days: Optional[list[str]] = None
    available_day_start: Optional[str] = Field(None, max_length=20)
    available_day_end: Optional[str] = Field(None, max_length=20)
    available_times: Optional[list[str]] = None
    available_time_start: Optional[str] = Field(None, max_length=20)
    available_time_end: Optional[str] = Field(None, max_length=20)
    languages_spoken: Optional[list[str]] = None
    bio: Optional[str] = Field(None, max_length=2000)
    consultation_types: Optional[list[str]] = None


class DoctorProfileUpdate(StrictModel):
    specialty: Optional[str] = Field(None, max_length=100)
    gender: Optional[Literal["Male", "Female", "Other", "Prefer not to say"]] = None
    hospital_affiliation: Optional[str] = Field(None, max_length=200)
    years_of_experience: Optional[int] = Field(None, ge=0, le=80)
    consultation_fee: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    available_days: Optional[list[str]] = None
    available_day_start: Optional[str] = Field(None, max_length=20)
    available_day_end: Optional[str] = Field(None, max_length=20)
    available_times: Optional[list[str]] = None
    available_time_start: Optional[str] = Field(None, max_length=20)
    available_time_end: Optional[str] = Field(None, max_length=20)
    languages_spoken: Optional[list[str]] = None
    bio: Optional[str] = Field(None, max_length=2000)
    consultation_types: Optional[list[str]] = None
    # pmdc_number and is_pmdc_verified are intentionally managed by registration/admin review.


class DoctorProfileOut(StrictModel):
    id: int
    user_id: int
    pmdc_number: str
    specialty: str
    gender: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    license_image_url: Optional[str] = None
    certificate_available: bool = False
    profile_photo_available: bool = False
    certificate_url: Optional[str] = None
    profile_photo_url: Optional[str] = None
    pmdc_certificate_path: Optional[str] = None
    pmdc_certificate_name: Optional[str] = None
    pmdc_certificate_mime_type: Optional[str] = None
    pmdc_certificate_size: Optional[int] = None
    profile_photo_path: Optional[str] = None
    years_of_experience: Optional[int] = None
    consultation_fee: Optional[Decimal] = None
    available_days: Optional[list[str]] = None
    available_day_start: Optional[str] = None
    available_day_end: Optional[str] = None
    available_times: Optional[list[str]] = None
    available_time_start: Optional[str] = None
    available_time_end: Optional[str] = None
    languages_spoken: Optional[list[str]] = None
    bio: Optional[str] = None
    consultation_types: Optional[list[str]] = None
    is_pmdc_verified: bool
    created_at: StrictDatetime
    updated_at: StrictDatetime

    @model_validator(mode="after")
    def compute_asset_indicators(self) -> "DoctorProfileOut":
        """Compute opaque availability indicators without relying on raw storage paths (Finding 14)."""
        object.__setattr__(self, "certificate_available", bool(self.pmdc_certificate_path or self.license_image_url))
        object.__setattr__(self, "profile_photo_available", bool(self.profile_photo_path))
        if self.certificate_available and not self.certificate_url:
            object.__setattr__(self, "certificate_url", "/api/v1/users/me/doctor-profile/pmdc-certificate")
        if self.profile_photo_available and not self.profile_photo_url:
            object.__setattr__(self, "profile_photo_url", f"/api/v1/users/doctors/{self.user_id}/photo")
        return self

    model_config = {"from_attributes": True, "strict": True}


# ------------------------------------------------------------------
# Caretaker Profile
# ------------------------------------------------------------------

class CaretakerProfileCreate(StrictModel):
    relationship_to_patient: Optional[str] = Field(None, max_length=100)
    crisis_phone_number: Optional[str] = Field(None, max_length=30)


class CaretakerProfileUpdate(StrictModel):
    relationship_to_patient: Optional[str] = Field(None, max_length=100)
    crisis_phone_number: Optional[str] = Field(None, max_length=30)


class CaretakerProfileOut(StrictModel):
    id: int
    user_id: int
    relationship_to_patient: Optional[str] = None
    crisis_phone_number: Optional[str] = None
    created_at: StrictDatetime
    updated_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}
