"""
Recommendation Feedback model — tracking patient feedback on generated recommendations.
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.recommendation import Recommendation
    from app.models.patient_feature_snapshot import PatientFeatureSnapshot


class RecommendationFeedback(Base):
    __tablename__ = "recommendation_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    recommendation_id: Mapped[int] = mapped_column(
        ForeignKey("recommendations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    feature_snapshot_id: Mapped[int | None] = mapped_column(
        ForeignKey("patient_feature_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    recommendation_category: Mapped[str] = mapped_column(String(50), nullable=False)
    rule_id: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_version: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship()
    recommendation: Mapped["Recommendation"] = relationship()
    feature_snapshot: Mapped["PatientFeatureSnapshot | None"] = relationship()
