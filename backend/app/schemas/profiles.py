from datetime import date
from typing import Optional

from pydantic import Field

from app.schemas.base import StrictDatetime, StrictModel, StrictDate


# ------------------------------------------------------------------
# Patient Profile
# ------------------------------------------------------------------

class PatientProfileCreate(StrictModel):
    date_of_birth: StrictDate
    gender: Optional[str] = Field(None, max_length=30)
    blood_type: Optional[str] = Field(None, max_length=10)
    city: Optional[str] = Field(None, max_length=100)
    primary_diagnosis: Optional[str] = Field(None, max_length=100)
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_relation: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, max_length=30)
    known_triggers: Optional[list[str]] = None
    notes: Optional[str] = None
    timezone: Optional[str] = Field("UTC", max_length=64)


class PatientProfileUpdate(StrictModel):
    date_of_birth: Optional[StrictDate] = None
    gender: Optional[str] = Field(None, max_length=30)
    blood_type: Optional[str] = Field(None, max_length=10)
    city: Optional[str] = Field(None, max_length=100)
    primary_diagnosis: Optional[str] = Field(None, max_length=100)
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_relation: Optional[str] = Field(None, max_length=100)
    emergency_contact_phone: Optional[str] = Field(None, max_length=30)
    known_triggers: Optional[list[str]] = None
    notes: Optional[str] = None
    timezone: Optional[str] = Field(None, max_length=64)


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
    pmdc_number: str = Field(..., max_length=50)
    specialty: Optional[str] = Field("Neurologist", max_length=100)
    hospital_affiliation: Optional[str] = Field(None, max_length=200)
    license_image_url: Optional[str] = Field(None, max_length=500)


class DoctorProfileUpdate(StrictModel):
    specialty: Optional[str] = Field(None, max_length=100)
    hospital_affiliation: Optional[str] = Field(None, max_length=200)
    license_image_url: Optional[str] = Field(None, max_length=500)
    # Note: pmdc_number is typically not updated directly after creation, and is_pmdc_verified is managed by admins.


class DoctorProfileOut(StrictModel):
    id: int
    user_id: int
    pmdc_number: str
    specialty: str
    hospital_affiliation: Optional[str] = None
    license_image_url: Optional[str] = None
    is_pmdc_verified: bool
    created_at: StrictDatetime
    updated_at: StrictDatetime

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
