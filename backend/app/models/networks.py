from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.enums import ConnectionStatus


class PatientDoctorNetwork(Base):
    __tablename__ = "patient_doctor_networks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patient_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    
    relationship_status: Mapped[ConnectionStatus] = mapped_column(
        Enum(ConnectionStatus, name="connection_status_enum", create_type=False), 
        default=ConnectionStatus.PENDING, 
        nullable=False
    )

    date_linked: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PatientCaretakerNetwork(Base):
    __tablename__ = "patient_caretaker_networks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patient_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    caretaker_id: Mapped[int] = mapped_column(
        ForeignKey("caretaker_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    
    relationship_status: Mapped[ConnectionStatus] = mapped_column(
        Enum(ConnectionStatus, name="connection_status_enum", create_type=False), 
        default=ConnectionStatus.PENDING, 
        nullable=False
    )

    date_linked: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
