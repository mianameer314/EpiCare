"""
Manual Seizure Log model for seizures not captured by EEG.
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class ManualSeizureLog(TimestampMixin, Base):
    __tablename__ = "manual_seizure_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    
    # Core seizure characteristics
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    seizure_type: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "Focal", "Tonic-Clonic"
    
    # Pre-ictal and post-ictal context
    auras_felt: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_ictal_symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Generic description
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship()
