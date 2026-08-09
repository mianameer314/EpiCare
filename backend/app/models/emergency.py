"""
Emergency models — contacts, SOS events, and per-contact SMS delivery state.
"""
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship

from app.db.session import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class EmergencyContact(TimestampMixin, Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    relationship: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(30), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = orm_relationship()


class SosEvent(TimestampMixin, Base):
    __tablename__ = "sos_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="SENDING", nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = orm_relationship()
    deliveries: Mapped[list["SosDelivery"]] = orm_relationship(
        back_populates="sos_event", cascade="all, delete-orphan"
    )


class SosDelivery(Base):
    __tablename__ = "sos_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sos_event_id: Mapped[int] = mapped_column(
        ForeignKey("sos_events.id", ondelete="CASCADE"), index=True, nullable=False
    )
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("emergency_contacts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    delivery_status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False
    )  # PENDING | SENT | FAILED
    provider_message_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sos_event: Mapped["SosEvent"] = orm_relationship(back_populates="deliveries")
