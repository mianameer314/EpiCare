from datetime import date, datetime, time, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    CurrentUser,
    DbDep,
    TargetPatientIdForPrescription,
    TargetPatientIdForRead,
    TargetPatientIdForWrite,
)
from app.api.pagination import (
    PaginationParams,
    apply_pagination,
    create_paginated_response,
    get_pagination_params,
    get_total_count,
)
from app.models.enums import UserRole
from app.models.medication import Medication, MedicationLog, MedicationSchedule
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.medication import (
    AdherenceStatsOut,
    MedicationCreate,
    MedicationList,
    MedicationLogCreate,
    MedicationLogOut,
    MedicationOut,
    MedicationScheduleCreate,
    MedicationScheduleOut,
    MedicationUpdate,
    TodayScheduleSlotOut,
)

router = APIRouter(prefix="/medications")


def _format_med_out(med: Medication) -> MedicationOut:
    """Helper to construct MedicationOut with doctor details."""
    prescribed_by_name = None
    prescribed_by_pmdc = None
    if med.prescribed_by_doctor:
        prescribed_by_name = f"Dr. {med.prescribed_by_doctor.full_name}"
        if med.prescribed_by_doctor.doctor_profile:
            prescribed_by_pmdc = med.prescribed_by_doctor.doctor_profile.pmdc_number

    return MedicationOut(
        id=med.id,
        user_id=med.user_id,
        name=med.name,
        generic_name=med.generic_name,
        brand_name=med.brand_name,
        dosage=med.dosage,
        frequency=med.frequency,
        intake_timing=med.intake_timing,
        start_date=med.start_date,
        end_date=med.end_date,
        notes=med.notes,
        prescribed_by_doctor_id=med.prescribed_by_doctor_id,
        prescribed_by_name=prescribed_by_name,
        prescribed_by_pmdc=prescribed_by_pmdc,
        is_active=med.is_active,
        created_at=med.created_at,
        updated_at=med.updated_at,
    )


# ── 1. List Patient Medications ────────────────────────
@router.get(
    "",
    tags=['🤒 Patient - Medications', '👨‍⚕️ Doctor - Prescriptions', '🤝 Caretaker - Proxy Actions'],
    response_model=PaginatedResponse[MedicationOut],
    summary="List Patient Medications",
    description="Fetches a paginated list of medication prescriptions registered to the target patient, including prescriber credentials.",
)
async def get_medications(
    db: DbDep,
    target_user_id: TargetPatientIdForRead,
    params: PaginationParams = Depends(get_pagination_params),
    is_active: bool | None = None,
    search: str | None = None,
):
    query = (
        select(Medication)
        .where(Medication.user_id == target_user_id)
        .options(
            selectinload(Medication.prescribed_by_doctor).selectinload(User.doctor_profile)
        )
    )

    if is_active is not None:
        query = query.where(Medication.is_active == is_active)

    if search:
        search_fmt = f"%{search.strip().lower()}%"
        query = query.where(
            func.lower(Medication.name).like(search_fmt)
            | func.lower(Medication.notes).like(search_fmt)
            | func.lower(Medication.frequency).like(search_fmt)
        )

    if params.sort_by and hasattr(Medication, params.sort_by):
        column = getattr(Medication, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(Medication.is_active.desc(), Medication.start_date.desc())

    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()

    formatted_items = [_format_med_out(m) for m in items]
    return create_paginated_response(formatted_items, total, params.skip, params.limit)


# ── 2. Today's Daily Schedule & Live Dosing Slots ──────
@router.get(
    "/daily-schedule",
    tags=['🤒 Patient - Medications', '👨‍⚕️ Doctor - Prescriptions', '🤝 Caretaker - Proxy Actions'],
    response_model=List[TodayScheduleSlotOut],
    summary="Get Today's Live Dosing Schedule",
    description="Calculates real-time morning, afternoon, and night dosing windows based on active prescriptions and today's dose logs in the database.",
)
async def get_daily_schedule(
    db: DbDep,
    target_user_id: TargetPatientIdForRead,
):
    # Fetch active medications
    meds_res = await db.execute(
        select(Medication)
        .where(Medication.user_id == target_user_id, Medication.is_active == True)
        .options(
            selectinload(Medication.prescribed_by_doctor).selectinload(User.doctor_profile),
            selectinload(Medication.schedules),
        )
    )
    medications = meds_res.scalars().all()

    # Fetch today's logs for this user
    today_start = datetime.combine(date.today(), time.min)
    today_end = datetime.combine(date.today(), time.max)
    logs_res = await db.execute(
        select(MedicationLog).where(
            MedicationLog.user_id == target_user_id,
            MedicationLog.taken_at >= today_start,
            MedicationLog.taken_at <= today_end,
        )
    )
    today_logs = logs_res.scalars().all()
    logged_med_ids = {l.medication_id: l for l in today_logs}

    slots: List[TodayScheduleSlotOut] = []

    for med in medications:
        freq_lower = med.frequency.lower()
        doc_name = (
            f"Dr. {med.prescribed_by_doctor.full_name}"
            if med.prescribed_by_doctor
            else "Self-Reported"
        )

        # Determine scheduled slots based on frequency or specific schedules
        dosing_windows = []
        if "bid" in freq_lower or "twice" in freq_lower or "morning and night" in freq_lower:
            dosing_windows = [
                ("Morning", "08:00 AM", "morning"),
                ("Night", "08:00 PM", "night"),
            ]
        elif "tid" in freq_lower or "three" in freq_lower:
            dosing_windows = [
                ("Morning", "08:00 AM", "morning"),
                ("Afternoon", "02:00 PM", "afternoon"),
                ("Night", "08:00 PM", "night"),
            ]
        elif "night" in freq_lower or "bedtime" in freq_lower:
            dosing_windows = [("Night", "08:00 PM", "night")]
        elif "morning" in freq_lower:
            dosing_windows = [("Morning", "08:00 AM", "morning")]
        else:
            # Default to Morning & Night for standard AED regimens
            dosing_windows = [
                ("Morning", "08:00 AM", "morning"),
                ("Night", "08:00 PM", "night"),
            ]

        # Check if logged today
        is_logged = med.id in logged_med_ids
        log_entry = logged_med_ids.get(med.id)

        for window_name, time_str, slot_key in dosing_windows:
            slot_id = f"slot-{med.id}-{slot_key}"
            slot_status = "TAKEN" if is_logged else "PENDING"
            slots.append(
                TodayScheduleSlotOut(
                    slot_id=slot_id,
                    medication_id=med.id,
                    medication_name=med.name,
                    generic_name=med.generic_name,
                    dosage=med.dosage,
                    frequency=med.frequency,
                    intake_timing=med.intake_timing or "With water after food",
                    time_window=window_name,
                    scheduled_time_display=time_str,
                    status=slot_status,
                    logged_at=log_entry.taken_at if log_entry else None,
                    prescribed_by_name=doc_name,
                )
            )

    return slots


# ── 3. Medication Adherence Statistics ─────────────────
@router.get(
    "/adherence-stats",
    tags=['🤒 Patient - Medications', '👨‍⚕️ Doctor - Prescriptions', '🤝 Caretaker - Proxy Actions'],
    response_model=AdherenceStatsOut,
    summary="Get Calculated Adherence & Clinical Safety Status",
    description="Computes 7-day and 30-day compliance percentage directly from database logs.",
)
async def get_adherence_stats(
    db: DbDep,
    target_user_id: TargetPatientIdForRead,
):
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    # 7-day logs
    res_7d = await db.execute(
        select(
            func.count(MedicationLog.id).filter(MedicationLog.status == "TAKEN"),
            func.count(MedicationLog.id),
        ).where(
            MedicationLog.user_id == target_user_id,
            MedicationLog.taken_at >= seven_days_ago,
        )
    )
    taken_7d, total_7d = res_7d.one()

    # 30-day logs
    res_30d = await db.execute(
        select(
            func.count(MedicationLog.id).filter(MedicationLog.status == "TAKEN"),
            func.count(MedicationLog.id),
        ).where(
            MedicationLog.user_id == target_user_id,
            MedicationLog.taken_at >= thirty_days_ago,
        )
    )
    taken_30d, total_30d = res_30d.one()

    # Active count
    active_res = await db.scalar(
        select(func.count(Medication.id)).where(
            Medication.user_id == target_user_id, Medication.is_active == True
        )
    )
    active_count = active_res or 0

    adherence_7d = round((taken_7d / total_7d * 100), 1) if total_7d and total_7d > 0 else (100.0 if active_count > 0 else 0.0)
    adherence_30d = round((taken_30d / total_30d * 100), 1) if total_30d and total_30d > 0 else (100.0 if active_count > 0 else 0.0)

    if adherence_7d >= 90.0:
        status_level = "OPTIMAL"
    elif adherence_7d >= 75.0:
        status_level = "GOOD"
    else:
        status_level = "AT_RISK"

    # Next reminder time calculation
    if active_count == 0:
        next_rem = "None Scheduled"
    else:
        now = datetime.now()
        if now.hour < 8:
            next_rem = "08:00 AM (Morning)"
        elif now.hour < 14:
            next_rem = "02:00 PM (Afternoon)"
        elif now.hour < 20:
            next_rem = "08:00 PM (Evening)"
        else:
            next_rem = "08:00 AM Tomorrow"

    return AdherenceStatsOut(
        adherence_7d_percent=adherence_7d,
        adherence_30d_percent=adherence_30d,
        taken_7d=taken_7d or 0,
        missed_7d=(total_7d or 0) - (taken_7d or 0),
        total_7d=total_7d or 0,
        active_prescriptions_count=active_count,
        status_level=status_level,
        next_reminder_time=next_rem,
    )


# ── 4. Create Prescription ─────────────────────────────
@router.post(
    "",
    tags=['👨‍⚕️ Doctor - Prescriptions', '🤒 Patient - Medications'],
    response_model=MedicationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create Medication Prescription",
    description="Registers a new medication prescription with automatic schedule creation in the database.",
)
async def create_medication(
    med_in: MedicationCreate,
    db: DbDep,
    current_user: CurrentUser,
    target_user_id: TargetPatientIdForPrescription,
):
    prescriber_id = None
    if current_user.role == UserRole.DOCTOR:
        prescriber_id = current_user.id
    elif med_in.prescribed_by_doctor_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a verified doctor may assign a prescriber.",
        )

    new_med = Medication(
        user_id=target_user_id,
        prescribed_by_doctor_id=prescriber_id,
        name=med_in.name,
        generic_name=med_in.generic_name,
        brand_name=med_in.brand_name,
        dosage=med_in.dosage,
        frequency=med_in.frequency,
        intake_timing=med_in.intake_timing,
        start_date=med_in.start_date,
        end_date=med_in.end_date,
        notes=med_in.notes,
        is_active=med_in.is_active,
    )
    db.add(new_med)
    await db.flush()

    # Automatically generate default schedules in database based on frequency
    freq_lower = med_in.frequency.lower()
    if "bid" in freq_lower or "twice" in freq_lower:
        db.add(MedicationSchedule(medication_id=new_med.id, scheduled_time=time(8, 0), reminder_enabled=True))
        db.add(MedicationSchedule(medication_id=new_med.id, scheduled_time=time(20, 0), reminder_enabled=True))
    elif "tid" in freq_lower or "three" in freq_lower:
        db.add(MedicationSchedule(medication_id=new_med.id, scheduled_time=time(8, 0), reminder_enabled=True))
        db.add(MedicationSchedule(medication_id=new_med.id, scheduled_time=time(14, 0), reminder_enabled=True))
        db.add(MedicationSchedule(medication_id=new_med.id, scheduled_time=time(20, 0), reminder_enabled=True))
    elif "night" in freq_lower or "bedtime" in freq_lower:
        db.add(MedicationSchedule(medication_id=new_med.id, scheduled_time=time(20, 0), reminder_enabled=True))
    else:
        db.add(MedicationSchedule(medication_id=new_med.id, scheduled_time=time(8, 0), reminder_enabled=True))

    await db.commit()
    await db.refresh(new_med)

    # Re-query with joined relationship
    res = await db.execute(
        select(Medication)
        .where(Medication.id == new_med.id)
        .options(selectinload(Medication.prescribed_by_doctor).selectinload(User.doctor_profile))
    )
    full_med = res.scalar_one()
    return _format_med_out(full_med)


# ── 5. Log Medication Intake ───────────────────────────
@router.post(
    "/{med_id}/log",
    tags=['🤒 Patient - Medications', '🤝 Caretaker - Proxy Actions'],
    response_model=MedicationLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Medication Intake",
    description="Logs a dose intake into the PostgreSQL database for adherence tracking.",
)
async def log_medication(
    med_id: int,
    log_in: MedicationLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == target_user_id
        )
    )
    med = med_result.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    new_log = MedicationLog(
        medication_id=med_id,
        user_id=target_user_id,
        status=log_in.status,
        dose_taken=log_in.dose_taken or med.dosage,
        notes=log_in.notes or f"Taken: {med.name} {med.dosage}",
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)

    return MedicationLogOut(
        id=new_log.id,
        medication_id=new_log.medication_id,
        medication_name=med.name,
        taken_at=new_log.taken_at,
        status=new_log.status,
        dose_taken=new_log.dose_taken,
        notes=new_log.notes,
    )


# ── 6. List Dose Logs ──────────────────────────────────
@router.get(
    "/logs",
    tags=['🤒 Patient - Medications', '👨‍⚕️ Doctor - Prescriptions', '🤝 Caretaker - Proxy Actions'],
    response_model=PaginatedResponse[MedicationLogOut],
    summary="List Medication Adherence Logs",
    description="Retrieves historical dose logs from the database.",
)
async def get_medication_logs(
    db: DbDep,
    target_user_id: TargetPatientIdForRead,
    params: PaginationParams = Depends(get_pagination_params),
    status: Optional[str] = None,
):
    query = (
        select(MedicationLog)
        .where(MedicationLog.user_id == target_user_id)
        .options(selectinload(MedicationLog.medication))
    )

    if status:
        query = query.where(MedicationLog.status == status.upper())

    query = query.order_by(MedicationLog.taken_at.desc())

    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    res = await db.execute(query)
    logs = res.scalars().all()

    formatted = [
        MedicationLogOut(
            id=l.id,
            medication_id=l.medication_id,
            medication_name=l.medication.name if l.medication else "Medication",
            taken_at=l.taken_at,
            status=l.status,
            dose_taken=l.dose_taken,
            notes=l.notes,
        )
        for l in logs
    ]

    return create_paginated_response(formatted, total, params.skip, params.limit)


# ── 7. Update Prescription ─────────────────────────────
@router.put(
    "/{med_id}",
    tags=['👨‍⚕️ Doctor - Prescriptions', '🤒 Patient - Medications'],
    response_model=MedicationOut,
    summary="Update Medication Prescription",
)
async def update_medication(
    med_id: int,
    med_in: MedicationUpdate,
    db: DbDep,
    target_user_id: TargetPatientIdForPrescription,
):
    result = await db.execute(
        select(Medication)
        .where(Medication.id == med_id, Medication.user_id == target_user_id)
        .options(selectinload(Medication.prescribed_by_doctor).selectinload(User.doctor_profile))
    )
    med = result.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    update_data = med_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(med, key, value)

    await db.commit()
    await db.refresh(med)
    return _format_med_out(med)


# ── 8. Soft Delete Prescription ────────────────────────
@router.delete(
    "/{med_id}",
    tags=['👨‍⚕️ Doctor - Prescriptions', '🤒 Patient - Medications'],
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Medication (Soft)",
)
async def delete_medication(
    med_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForPrescription,
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


# ── 9. Schedules CRUD ──────────────────────────────────
@router.get(
    "/{med_id}/schedules",
    tags=['🤒 Patient - Medications', '👨‍⚕️ Doctor - Prescriptions', '🤝 Caretaker - Proxy Actions'],
    response_model=PaginatedResponse[MedicationScheduleOut],
    summary="List Medication Schedules",
)
async def get_schedules(
    med_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForRead,
    params: PaginationParams = Depends(get_pagination_params),
):
    med_result = await db.execute(
        select(Medication).where(
            Medication.id == med_id, Medication.user_id == target_user_id
        )
    )
    if not med_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Medication not found")

    query = select(MedicationSchedule).where(MedicationSchedule.medication_id == med_id).order_by(MedicationSchedule.scheduled_time.asc())
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    sched_result = await db.execute(query)
    items = sched_result.scalars().all()

    return create_paginated_response(items, total, params.skip, params.limit)


@router.post(
    "/{med_id}/schedules",
    tags=['👨‍⚕️ Doctor - Prescriptions'],
    response_model=MedicationScheduleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add Medication Schedule",
)
async def create_schedule(
    med_id: int,
    sched_in: MedicationScheduleCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForPrescription,
):
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
