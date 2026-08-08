"""
Chat and recommendation schemas.
"""
from datetime import datetime

from pydantic import BaseModel, Field


# ------------------------------------------------------------------
# Chat
# ------------------------------------------------------------------

class ChatSessionCreate(BaseModel):
    """Request body for creating a chat session."""

    title: str = "New chat"


class ChatSessionOut(BaseModel):
    """Response model for a chat session."""

    id: int
    user_id: int
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    """Request body for sending a chat message."""

    content: str = Field(..., min_length=1, max_length=4000)


class ChatSource(BaseModel):
    """A single source citation for a chatbot answer."""

    title: str
    snippet: str


class ChatMessageOut(BaseModel):
    """Response model for a chat message (assistant replies include sources)."""

    id: int
    session_id: int
    role: str
    content: str
    sources: list[ChatSource] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ------------------------------------------------------------------
# Recommendations
# ------------------------------------------------------------------

class RecommendationOut(BaseModel):
    """Response model for a recommendation."""

    id: int
    user_id: int
    category: str
    title: str
    body: str
    rationale: str | None
    evidence_tags: list[str] | None
    is_dismissed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
