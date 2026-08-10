"""
Admin service — User management, doctor verification, and platform metrics.
"""
from typing import Sequence
from fastapi import HTTPException, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.enums import UserRole
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.caretaker_profile import CaretakerProfile
from app.models.seizure import ManualSeizureLog
from app.models.medication import Medication
from app.models.lifestyle import SleepLog, TriggerLog
from app.models.eeg_session import EegSession
from app.schemas.admin import AdminDashboardMetricsOut, UserStatusUpdate, DoctorVerificationUpdate


async def get_all_users(db: AsyncSession, skip: int = 0, limit: int = 50, role: UserRole | None = None) -> Sequence[User]:
    """Retrieve all users with optional role filtering."""
    query = select(User)
    if role:
        query = query.where(User.role == role)
    query = query.offset(skip).limit(limit).order_by(User.id.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def get_user_details(db: AsyncSession, user_id: int) -> User:
    """Get a user by ID or raise 404."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


async def update_user_status(db: AsyncSession, user_id: int, data: UserStatusUpdate) -> User:
    """Activate or deactivate a user account."""
    user = await get_user_details(db, user_id)
    user.is_active = data.is_active
    await db.commit()
    await db.refresh(user)
    return user


async def get_pending_doctors(db: AsyncSession) -> Sequence[DoctorProfile]:
    """Fetch all doctors awaiting PMDC verification."""
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.is_pmdc_verified == False)
    )
    return result.scalars().all()


async def verify_doctor(db: AsyncSession, doctor_user_id: int, data: DoctorVerificationUpdate) -> DoctorProfile:
    """Approve or reject a doctor's PMDC verification."""
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == doctor_user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    profile.is_pmdc_verified = data.is_verified
    await db.commit()
    await db.refresh(profile)
    return profile


async def get_platform_metrics(db: AsyncSession) -> AdminDashboardMetricsOut:
    """Aggregate comprehensive counts for the admin dashboard."""
    # User stats
    total_users = await db.scalar(select(func.count(User.id))) or 0
    total_patients = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.PATIENT)) or 0
    total_doctors = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.DOCTOR)) or 0
    total_caretakers = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.CARETAKER)) or 0
    total_admins = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN)) or 0
    
    # Doctor specific stats
    pending_doctors = await db.scalar(select(func.count(DoctorProfile.id)).where(DoctorProfile.is_pmdc_verified == False)) or 0

    # Engagement / Data stats
    total_seizures = await db.scalar(select(func.count(ManualSeizureLog.id))) or 0
    total_meds = await db.scalar(select(func.count(Medication.id))) or 0
    
    # Sleep + triggers combined for lifestyle
    total_sleep = await db.scalar(select(func.count(SleepLog.id))) or 0
    total_triggers = await db.scalar(select(func.count(TriggerLog.id))) or 0
    total_lifestyle = total_sleep + total_triggers
    
    total_eegs = await db.scalar(select(func.count(EegSession.id))) or 0

    return AdminDashboardMetricsOut(
        total_users=total_users,
        total_patients=total_patients,
        total_doctors=total_doctors,
        total_caretakers=total_caretakers,
        total_admins=total_admins,
        pending_doctors=pending_doctors,
        total_seizures_logged=total_seizures,
        total_medications_logged=total_meds,
        total_lifestyle_logs=total_lifestyle,
        total_eegs_processed=total_eegs,
    )
