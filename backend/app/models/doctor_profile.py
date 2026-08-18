from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User


class DoctorProfile(Base):
    """Professional profile and PMDC verification data for a doctor."""

    __tablename__ = "doctor_profiles"
    __table_args__ = (
        UniqueConstraint("pmdc_number", name="uq_doctor_profiles_pmdc_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )

    pmdc_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    specialty: Mapped[str] = mapped_column(String(100), default="Neurologist", nullable=False)
    hospital_affiliation: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # Backwards-compatible legacy field. New uploads are stored in pmdc_certificate_path.
    license_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pmdc_certificate_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pmdc_certificate_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pmdc_certificate_mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pmdc_certificate_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # These Python names intentionally map onto columns already present in some
    # local databases, preserving prior profile data during the migration.
    profile_photo_path: Mapped[str | None] = mapped_column("profile_photo_url", String(500), nullable=True)
    profile_photo_mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    years_of_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    consultation_fee: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    available_days: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    available_day_start: Mapped[str | None] = mapped_column(String(20), nullable=True)
    available_day_end: Mapped[str | None] = mapped_column(String(20), nullable=True)
    available_times: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    available_time_start: Mapped[str | None] = mapped_column(String(20), nullable=True)
    available_time_end: Mapped[str | None] = mapped_column(String(20), nullable=True)
    languages_spoken: Mapped[list[str] | None] = mapped_column("languages", JSONB, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    consultation_types: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    is_pmdc_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="doctor_profile")
