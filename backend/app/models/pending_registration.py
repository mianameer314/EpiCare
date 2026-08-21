"""
PendingRegistration model — temporary storage for unverified registrations.
Records are created when a user clicks 'Send OTP' and are promoted to actual
User records only after successful OTP verification. This prevents ghost users.
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.enums import UserRole


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", create_type=False),
        default=UserRole.PATIENT,
        nullable=False,
    )
    pmdc_number: Mapped[str | None] = mapped_column(String(50), nullable=True)

    otp_secret_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    otp_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    otp_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
