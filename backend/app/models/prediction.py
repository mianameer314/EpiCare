"""
Prediction model — binary seizure/no-seizure result for an EEG session.
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.ai_report import AiReport
    from app.models.eeg_session import EegSession
    from app.models.model_version import ModelVersion


class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("eeg_sessions.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    model_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("model_versions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    predicted_class: Mapped[str] = mapped_column(String(20), nullable=False)  # seizure | no_seizure
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    positive_windows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_windows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_probability: Mapped[float] = mapped_column(Float, nullable=False)
    mean_probability: Mapped[float] = mapped_column(Float, nullable=False)
    window_probabilities: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="COMPLETED", server_default="COMPLETED", nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped["EegSession"] = relationship(back_populates="prediction")
    report: Mapped["AiReport | None"] = relationship(back_populates="prediction", uselist=False)
    model_version: Mapped["ModelVersion | None"] = relationship()
