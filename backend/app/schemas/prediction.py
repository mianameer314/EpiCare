"""
Prediction and report schemas.
"""
from pydantic import Field

from app.schemas.base import StrictDatetime, StrictModel
from app.schemas.common import PaginatedResponse


class PredictionOut(StrictModel):
    """Response model for a single prediction."""

    id: int
    session_id: int
    user_id: int
    model_version: str | None = None
    predicted_class: str
    confidence: float
    threshold: float
    positive_windows: int
    total_windows: int
    max_probability: float
    mean_probability: float
    window_probabilities: list[float] | None = None
    status: str
    started_at: StrictDatetime
    completed_at: StrictDatetime | None = None
    created_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}


class PredictionList(PaginatedResponse[PredictionOut]):
    """Paginated prediction history."""


class ReportSection(StrictModel):
    """A single section of the structured AI report."""

    heading: str
    body: str


class AiReportOut(StrictModel):
    """Response model for the structured AI report."""

    id: int
    prediction_id: int
    model_version: str
    status: str
    summary: str = ""
    sections: list[ReportSection] = Field(default_factory=list)
    disclaimer: str = ""
    created_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}
