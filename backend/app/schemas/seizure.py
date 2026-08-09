from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class ManualSeizureLogCreate(BaseModel):
    occurred_at: datetime
    duration_seconds: int
    seizure_type: Optional[str] = None
    auras_felt: Optional[str] = None
    post_ictal_symptoms: Optional[str] = None
    notes: Optional[str] = None


class ManualSeizureLogOut(ManualSeizureLogCreate):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)
