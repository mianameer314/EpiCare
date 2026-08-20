from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class RecommendationOut(BaseModel):
    id: int
    category: str
    title: str
    body: str
    rationale: Optional[str] = None
    action_url: Optional[str] = None
    priority: str
    source: str
    is_active: bool
    is_dismissed: bool
    evidence_tags: Optional[list] = None
    created_at: datetime
    user_feedback: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


class RecommendationWhyOut(BaseModel):
    rule_id: str
    rule_version: str
    condition_description: str
    feature_values_used: dict
    generated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RecommendationStatsOut(BaseModel):
    total_generated: int
    total_read: int
    total_dismissed: int
    total_helpful: int
    total_not_helpful: int
    categories: dict[str, int]


class FeedbackCreate(BaseModel):
    event_type: str  # HELPFUL | NOT_HELPFUL | SHOWN | READ | DISMISSED | CLICKED_ACTION
    feedback_text: Optional[str] = None
