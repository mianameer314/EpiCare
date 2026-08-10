from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date
from app.models.enums import ConnectionStatus

class EnrichedUserBase(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    phone_number: Optional[str] = None

# For Patient viewing their connected Doctor
class PatientDoctorConnectionOut(BaseModel):
    connection_id: int
    relationship_status: ConnectionStatus
    doctor_id: int
    doctor: EnrichedUserBase
    pmdc_number: str
    specialty: str
    hospital_affiliation: Optional[str] = None

# For Patient viewing their connected Caretaker
class PatientCaretakerConnectionOut(BaseModel):
    connection_id: int
    relationship_status: ConnectionStatus
    caretaker_id: int
    caretaker: EnrichedUserBase
    can_proxy: bool

# For Doctor/Caretaker viewing their connected Patient
class ConnectedPatientOut(BaseModel):
    connection_id: int
    relationship_status: ConnectionStatus
    patient_id: int
    patient: EnrichedUserBase
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    can_proxy: Optional[bool] = None # Only relevant for caretakers
