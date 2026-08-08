"""
Chat and recommendation schemas.
"""
from pydantic import Field

from app.schemas.base import StrictDatetime, StrictModel


# ------------------------------------------------------------------
# Chat
# ------------------------------------------------------------------

class ChatSessionCreate(StrictModel):
    """Request body for creating a chat session."""

    title: str = "New chat"


class ChatSessionOut(StrictModel):
    """Response model for a chat session."""

    id: int
    user_id: int
    title: str
    created_at: StrictDatetime
    updated_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}


class ChatMessageCreate(StrictModel):
    """Request body for sending a chat message."""

    content: str = Field(..., min_length=1, max_length=4000)


class ChatSource(StrictModel):
    """A single source citation for a chatbot answer."""

    title: str
    snippet: str


class ChatMessageOut(StrictModel):
    """Response model for a chat message (assistant replies include sources)."""

    id: int
    session_id: int
    role: str
    content: str
    sources: list[ChatSource] | None = None
    created_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}


# ------------------------------------------------------------------
# Recommendations
# ------------------------------------------------------------------

class RecommendationOut(StrictModel):
    """Response model for a recommendation."""

    id: int
    user_id: int
    category: str
    title: str
    body: str
    rationale: str | None
    evidence_tags: list[str] | None
    is_dismissed: bool
    created_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}
