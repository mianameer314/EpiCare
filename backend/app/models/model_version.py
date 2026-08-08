"""
Model version model — registry entry for every deployed ML artifact.
"""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    framework: Mapped[str] = mapped_column(String(50), default="onnx", nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    input_schema: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    threshold: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    sensitivity: Mapped[float | None] = mapped_column(Float, nullable=True)
    specificity: Mapped[float | None] = mapped_column(Float, nullable=True)
    f1: Mapped[float | None] = mapped_column(Float, nullable=True)
    auroc: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
