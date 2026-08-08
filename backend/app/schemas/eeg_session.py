"""
EEG session schemas — upload, validation results, and session lifecycle.
"""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.schemas.common import PaginatedResponse


class EegSessionStatus(str, Enum):
    """Lifecycle statuses for an EEG analysis session."""

    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    INVALID = "INVALID"
    PREPROCESSING = "PREPROCESSING"
    INFERENCE_RUNNING = "INFERENCE_RUNNING"
    REPORT_GENERATING = "REPORT_GENERATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class EegValidationResult(BaseModel):
    """Validation summary returned for an uploaded EEG file."""

    valid: bool
    sampling_rate: float | None = None
    duration_seconds: float | None = None
    channels_found: int | None = None
    channels_used: int | None = None
    warnings: list[str] = Field(default_factory=list)


class EegSessionOut(BaseModel):
    """Response model for an EEG session."""

    id: int
    user_id: int
    original_filename: str
    file_size_bytes: int
    status: EegSessionStatus
    validation_result: EegValidationResult | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EegSessionList(PaginatedResponse[EegSessionOut]):
    """Paginated session list."""
