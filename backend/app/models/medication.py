"""
Medication models — medications, schedules, and adherence logs.
"""
from datetime import date, datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class Medication(TimestampMixin, Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    prescribed_by_doctor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    generic_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    brand_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str] = mapped_column(String(50), nullable=False)
    intake_timing: Mapped[str | None] = mapped_column(String(100), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    prescribed_by_doctor: Mapped["User | None"] = relationship(foreign_keys=[prescribed_by_doctor_id])
    schedules: Mapped[list["MedicationSchedule"]] = relationship(
        back_populates="medication", cascade="all, delete-orphan"
    )


class MedicationSchedule(TimestampMixin, Base):
    __tablename__ = "medication_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    scheduled_time: Mapped[time] = mapped_column(Time, nullable=False)
    days_of_week: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    medication: Mapped["Medication"] = relationship(back_populates="schedules")
    logs: Mapped[list["MedicationLog"]] = relationship(back_populates="schedule")


class MedicationLog(Base):
    __tablename__ = "medication_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_id: Mapped[int | None] = mapped_column(
        ForeignKey("medication_schedules.id", ondelete="SET NULL"), index=True, nullable=True
    )
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    taken_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="TAKEN", nullable=False)  # TAKEN | MISSED | SKIPPED
    dose_taken: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    schedule: Mapped["MedicationSchedule | None"] = relationship(back_populates="logs")
    medication: Mapped["Medication"] = relationship()

