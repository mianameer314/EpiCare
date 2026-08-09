from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date

from app.api.deps import DbDep, CurrentUser, RoleChecker
from app.models.enums import UserRole
from app.models.user import User
from app.models.medication import Medication, MedicationSchedule, MedicationLog
from app.schemas.medication import (
    MedicationCreate,
    MedicationOut,
    MedicationScheduleCreate,
    MedicationScheduleOut,
    MedicationLogCreate,
    MedicationLogOut,
)

router = APIRouter(prefix="/medications", tags=["Medications"])

PatientUser = Depends(RoleChecker([UserRole.PATIENT]))


@router.get("", response_model=List[MedicationOut])
async def get_medications(db: DbDep, current_user: User = PatientUser):
    """Get all medications for the current patient."""
    result = await db.execute(
        select(Medication).where(Medication.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("", response_model=MedicationOut, status_code=status.HTTP_201_CREATED)
async def create_medication(
    med_in: MedicationCreate,
    db: DbDep,
    current_user: User = PatientUser,
):
    """Create a new medication prescription."""
    new_med = Medication(
        user_id=current_user.id,
        name=med_in.name,
        dosage=med_in.dosage,
        frequency=med_in.frequency,
        start_date=med_in.start_date,
        notes=med_in.notes,
        is_active=med_in.is_active,
    )
    db.add(new_med)
    await db.commit()
    await db.refresh(new_med)
    return new_med


@router.get("/{med_id}/schedules", response_model=List[MedicationScheduleOut])
async def get_schedules(med_id: int, db: DbDep, current_user: User = PatientUser):
    """Get all schedules for a specific medication."""
    # Ensure medication belongs to user
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == current_user.id
        )
    )
    if not med_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Medication not found")

    sched_result = await db.execute(
        select(MedicationSchedule).where(MedicationSchedule.medication_id == med_id)
    )
    return sched_result.scalars().all()


@router.post("/{med_id}/schedules", response_model=MedicationScheduleOut, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    med_id: int,
    sched_in: MedicationScheduleCreate,
    db: DbDep,
    current_user: User = PatientUser,
):
    """Add a schedule time for a medication."""
    # Ensure medication belongs to user
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == current_user.id
        )
    )
    if not med_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Medication not found")

    new_sched = MedicationSchedule(
        medication_id=med_id,
        scheduled_time=sched_in.scheduled_time,
        days_of_week=sched_in.days_of_week,
        reminder_enabled=sched_in.reminder_enabled,
    )
    db.add(new_sched)
    await db.commit()
    await db.refresh(new_sched)
    return new_sched


@router.post("/{med_id}/log", response_model=MedicationLogOut, status_code=status.HTTP_201_CREATED)
async def log_medication(
    med_id: int,
    log_in: MedicationLogCreate,
    db: DbDep,
    current_user: User = PatientUser,
):
    """Log a medication dose as TAKEN, MISSED, or SKIPPED."""
    # Ensure medication belongs to user
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == current_user.id
        )
    )
    if not med_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Medication not found")

    new_log = MedicationLog(
        medication_id=med_id,
        user_id=current_user.id,
        status=log_in.status,
        dose_taken=log_in.dose_taken,
        # schedule_id could be passed in query or body if needed, omitting for simplicity
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log
