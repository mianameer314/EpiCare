from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date

from app.api.deps import DbDep, TargetPatientIdForRead, TargetPatientIdForWrite
from app.models.enums import UserRole
from app.models.user import User
from app.models.medication import Medication, MedicationSchedule, MedicationLog
from app.schemas.medication import (
    MedicationCreate,
    MedicationUpdate,
    MedicationOut,
    MedicationScheduleCreate,
    MedicationScheduleOut,
    MedicationLogCreate,
    MedicationLogOut,
)

router = APIRouter(prefix="/medications", tags=["Medications"])



@router.get(
    "",
    response_model=List[MedicationOut],
    summary="List Patient Medications",
    description="Fetches a list of all medication prescriptions registered to the authenticated patient.",
    response_description="A list of medication objects."
)
async def get_medications(db: DbDep, target_user_id: TargetPatientIdForRead):
    result = await db.execute(
        select(Medication).where(Medication.user_id == target_user_id)
    )
    return result.scalars().all()


@router.post(
    "",
    response_model=MedicationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Medication Prescription",
    description=(
        "Registers a new medication prescription for the patient. Includes "
        "details like dosage, frequency, and start date. Used for tracking adherence."
    ),
    response_description="The newly registered medication prescription."
)
async def create_medication(
    med_in: MedicationCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    new_med = Medication(
        user_id=target_user_id,
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


@router.put(
    "/{med_id}",
    response_model=MedicationOut,
    summary="Update Medication Prescription",
    description="Updates details for an existing medication (e.g. changing the dosage or making it inactive).",
)
async def update_medication(
    med_id: int,
    med_in: MedicationUpdate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == target_user_id
        )
    )
    med = result.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    update_data = med_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(med, key, value)

    await db.commit()
    await db.refresh(med)
    return med


@router.delete(
    "/{med_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Medication (Soft)",
    description="Soft deletes a medication by marking it as inactive. This preserves historical adherence logs.",
)
async def delete_medication(
    med_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == target_user_id
        )
    )
    med = result.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    med.is_active = False
    await db.commit()
    return None


@router.get(
    "/{med_id}/schedules",
    response_model=List[MedicationScheduleOut],
    summary="List Medication Schedules",
    description="Retrieves all scheduled intake times for a specific medication.",
    response_description="A list of medication schedules."
)
async def get_schedules(med_id: int, db: DbDep, target_user_id: TargetPatientIdForRead):
    # Ensure medication belongs to user
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == target_user_id
        )
    )
    if not med_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Medication not found")

    sched_result = await db.execute(
        select(MedicationSchedule).where(MedicationSchedule.medication_id == med_id)
    )
    return sched_result.scalars().all()


@router.post(
    "/{med_id}/schedules",
    response_model=MedicationScheduleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add Medication Schedule",
    description=(
        "Adds a specific intake schedule (time and days) for a medication. "
        "If reminders are enabled, background jobs will automatically notify "
        "the patient when it is time to take this dose."
    ),
    response_description="The newly created schedule object."
)
async def create_schedule(
    med_id: int,
    sched_in: MedicationScheduleCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    # Ensure medication belongs to user
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == target_user_id
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


@router.post(
    "/{med_id}/log",
    response_model=MedicationLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Medication Intake",
    description=(
        "Manually logs a medication dose as TAKEN, MISSED, or SKIPPED. "
        "These logs are analyzed by the Recommender service to calculate "
        "adherence scores."
    ),
    response_description="The medication log entry."
)
async def log_medication(
    med_id: int,
    log_in: MedicationLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    # Ensure medication belongs to user
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == target_user_id
        )
    )
    if not med_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Medication not found")

    new_log = MedicationLog(
        medication_id=med_id,
        user_id=target_user_id,
        status=log_in.status,
        dose_taken=log_in.dose_taken,
        # schedule_id could be passed in query or body if needed, omitting for simplicity
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log
