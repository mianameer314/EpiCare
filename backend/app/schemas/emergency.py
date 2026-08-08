"""
Emergency schemas — contacts, SOS trigger, and delivery state.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class EmergencyContactCreate(BaseModel):
    """Request body for adding an emergency contact."""

    name: str = Field(..., min_length=1, max_length=150)
    relationship: str = Field(..., min_length=1, max_length=100)
    phone_number: str = Field(..., min_length=7, max_length=30)
    is_primary: bool = False


class EmergencyContactUpdate(BaseModel):
    """Request body for updating an emergency contact."""

    name: str | None = None
    relationship: str | None = None
    phone_number: str | None = None
    is_primary: bool | None = None


class EmergencyContactOut(BaseModel):
    """Response model for an emergency contact."""

    id: int
    user_id: int
    name: str
    relationship: str
    phone_number: str
    is_primary: bool
    verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SosTriggerRequest(BaseModel):
    """Request body for triggering an SOS alert."""

    latitude: float | None = None
    longitude: float | None = None
    location_available: bool = False


class SosDeliveryOut(BaseModel):
    """Per-contact SMS delivery state."""

    contact_name: str
    phone_number: str
    delivery_status: str
    error_message: str | None = None

    model_config = {"from_attributes": True}


class SosEventOut(BaseModel):
    """Response model for an SOS event."""

    id: int
    triggered_at: datetime
    latitude: float | None
    longitude: float | None
    location_available: bool
    status: str
    deliveries: list[SosDeliveryOut] = []

    model_config = {"from_attributes": True}


class SosEventCreateResponse(BaseModel):
    """Confirmation response after triggering SOS."""

    event_id: int
    status: str
    message: str
