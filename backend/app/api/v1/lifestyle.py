from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.api.deps import DbDep, TargetPatientIdForRead, TargetPatientIdForWrite
from app.models.enums import UserRole
from app.models.user import User
from app.models.lifestyle import SleepLog, TriggerLog, LifestyleLog
from app.schemas.lifestyle import (
    SleepLogCreate,
    SleepLogOut,
    TriggerLogCreate,
    TriggerLogOut,
    StressLogCreate,
    MenstruationLogCreate,
    DietLogCreate,
    IllnessLogCreate,
    MedSideEffectLogCreate,
    ScreenTimeLogCreate,
    LifestyleLogOut,
    SleepLogUpdate,
    TriggerLogUpdate,
    LifestyleLogUpdate,
)

router = APIRouter(prefix="/lifestyle")



@router.post(
    "/sleep",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=SleepLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Daily Sleep",
    description=(
        "Logs a sleep session for the authenticated patient. The system automatically "
        "calculates the total duration in minutes. Used to monitor sleep deprivation."
    ),
    response_description="The newly created sleep log object."
)
async def log_sleep(
    log_in: SleepLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    # Calculate duration
    duration = (log_in.woke_at - log_in.slept_at).total_seconds() / 60.0
    
    new_log = SleepLog(
        user_id=target_user_id,
        slept_at=log_in.slept_at,
        woke_at=log_in.woke_at,
        duration_minutes=int(duration),
        quality=log_in.quality,
        notes=log_in.notes,
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


from datetime import date, datetime, time
from app.api.pagination import PaginationParams, get_pagination_params, get_total_count, apply_pagination, create_paginated_response
from app.schemas.common import PaginatedResponse

@router.get(
    "/sleep",
    tags=['🤒 Patient - Health Tracking', '👨\u200d⚕️ Doctor - Diagnostics', '🤝 Caretaker - Proxy Actions'],
    response_model=PaginatedResponse[SleepLogOut],
    summary="List Sleep Logs",
    description="Retrieves a paginated descending history of all sleep logs recorded by the patient.",
    response_description="A paginated list of sleep log entries."
)
async def get_sleep_logs(
    db: DbDep, 
    target_user_id: TargetPatientIdForRead,
    params: PaginationParams = Depends(get_pagination_params),
    start_date: date | None = None,
    end_date: date | None = None
):
    query = select(SleepLog).where(SleepLog.user_id == target_user_id)
    
    if start_date:
        query = query.where(SleepLog.woke_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(SleepLog.woke_at <= datetime.combine(end_date, time.max))
        
    if params.sort_by and hasattr(SleepLog, params.sort_by):
        column = getattr(SleepLog, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(SleepLog.woke_at.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


@router.put(
    "/sleep/{log_id}",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=SleepLogOut,
    summary="Update Sleep Log",
    description="Updates an existing sleep log."
)
async def update_sleep_log(
    log_id: int,
    log_in: SleepLogUpdate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    query = select(SleepLog).where(SleepLog.id == log_id, SleepLog.user_id == target_user_id)
    result = await db.execute(query)
    log_obj = result.scalar_one_or_none()
    
    if not log_obj:
        raise HTTPException(status_code=404, detail="Sleep log not found")
        
    update_data = log_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log_obj, field, value)
        
    if "slept_at" in update_data or "woke_at" in update_data:
        duration = (log_obj.woke_at - log_obj.slept_at).total_seconds() / 60.0
        log_obj.duration_minutes = int(duration)
        
    await db.commit()
    await db.refresh(log_obj)
    return log_obj


@router.delete(
    "/sleep/{log_id}",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Sleep Log",
    description="Deletes a sleep log."
)
async def delete_sleep_log(
    log_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    query = select(SleepLog).where(SleepLog.id == log_id, SleepLog.user_id == target_user_id)
    result = await db.execute(query)
    log_obj = result.scalar_one_or_none()
    
    if not log_obj:
        raise HTTPException(status_code=404, detail="Sleep log not found")
        
    await db.delete(log_obj)
    await db.commit()
    return None


@router.post(
    "/triggers",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=TriggerLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Seizure Trigger",
    description=(
        "Logs an environmental or behavioral trigger (e.g., Flashing Lights, High Stress). "
        "These triggers are aggregated by the Recommender service to warn the patient of patterns."
    ),
    response_description="The recorded trigger log entry."
)
async def log_trigger(
    log_in: TriggerLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    new_log = TriggerLog(
        user_id=target_user_id,
        trigger_name=log_in.trigger_name,
        severity=log_in.severity,
        occurred_at=log_in.occurred_at,
        notes=log_in.notes,
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.get(
    "/triggers",
    tags=['🤒 Patient - Health Tracking', '👨\u200d⚕️ Doctor - Diagnostics', '🤝 Caretaker - Proxy Actions'],
    response_model=PaginatedResponse[TriggerLogOut],
    summary="List Trigger Logs",
    description="Fetches a paginated descending list of all documented triggers for the patient.",
    response_description="A paginated list of trigger logs."
)
async def get_trigger_logs(
    db: DbDep, 
    target_user_id: TargetPatientIdForRead,
    params: PaginationParams = Depends(get_pagination_params),
    start_date: date | None = None,
    end_date: date | None = None,
    trigger_type: str | None = None
):
    query = select(TriggerLog).where(TriggerLog.user_id == target_user_id)
    
    if start_date:
        query = query.where(TriggerLog.occurred_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(TriggerLog.occurred_at <= datetime.combine(end_date, time.max))
    if trigger_type:
        query = query.where(TriggerLog.trigger_name.ilike(f"%{trigger_type}%"))
        
    if params.sort_by and hasattr(TriggerLog, params.sort_by):
        column = getattr(TriggerLog, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(TriggerLog.occurred_at.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


@router.put(
    "/triggers/{log_id}",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=TriggerLogOut,
    summary="Update Trigger Log",
    description="Updates an existing trigger log."
)
async def update_trigger_log(
    log_id: int,
    log_in: TriggerLogUpdate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    query = select(TriggerLog).where(TriggerLog.id == log_id, TriggerLog.user_id == target_user_id)
    result = await db.execute(query)
    log_obj = result.scalar_one_or_none()
    
    if not log_obj:
        raise HTTPException(status_code=404, detail="Trigger log not found")
        
    update_data = log_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log_obj, field, value)
        
    await db.commit()
    await db.refresh(log_obj)
    return log_obj


@router.delete(
    "/triggers/{log_id}",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Trigger Log",
    description="Deletes a trigger log."
)
async def delete_trigger_log(
    log_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    query = select(TriggerLog).where(TriggerLog.id == log_id, TriggerLog.user_id == target_user_id)
    result = await db.execute(query)
    log_obj = result.scalar_one_or_none()
    
    if not log_obj:
        raise HTTPException(status_code=404, detail="Trigger log not found")
        
    await db.delete(log_obj)
    await db.commit()
    return None


@router.post(
    "/stress",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=LifestyleLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Daily Stress Level",
    description=(
        "A specialized endpoint to record the patient's daily stress severity "
        "on a 1-5 scale. This maps generically to a LifestyleLog in the database."
    ),
    response_description="The generated lifestyle log representing stress."
)
async def log_stress(
    log_in: StressLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    new_log = LifestyleLog(
        user_id=target_user_id,
        log_type="STRESS",
        occurred_at=log_in.occurred_at,
        notes=f"Severity: {log_in.severity}/5. {log_in.notes or ''}".strip(),
        metadata_dict={"severity": log_in.severity}
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.post(
    "/menstruation",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=LifestyleLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Menstruation Cycle",
    description="Log menstruation flow to help correlate with catamenial epilepsy patterns.",
    response_description="The generated lifestyle log representing menstruation."
)
async def log_menstruation(
    log_in: MenstruationLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    new_log = LifestyleLog(
        user_id=target_user_id,
        log_type="MENSTRUATION",
        occurred_at=log_in.occurred_at,
        notes=log_in.notes,
        metadata_dict={"flow_intensity": log_in.flow_intensity}
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.post(
    "/diet",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=LifestyleLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Diet & Alcohol",
    description="Track ketogenic diet compliance and alcohol intake (a common seizure trigger).",
    response_description="The generated lifestyle log representing diet/alcohol."
)
async def log_diet(
    log_in: DietLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    metadata = {}
    if log_in.keto_compliant is not None:
        metadata["keto_compliant"] = log_in.keto_compliant
    if log_in.alcohol_units is not None:
        metadata["alcohol_units"] = log_in.alcohol_units

    new_log = LifestyleLog(
        user_id=target_user_id,
        log_type="DIET",
        occurred_at=log_in.occurred_at,
        notes=log_in.notes,
        metadata_dict=metadata
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.post(
    "/illness",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=LifestyleLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Illness & Fever",
    description="Track illnesses and fevers, which can drastically lower the seizure threshold.",
    response_description="The generated lifestyle log representing illness."
)
async def log_illness(
    log_in: IllnessLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    metadata = {}
    if log_in.temperature_f:
        metadata["temperature_f"] = log_in.temperature_f
    if log_in.illness_type:
        metadata["illness_type"] = log_in.illness_type

    new_log = LifestyleLog(
        user_id=target_user_id,
        log_type="ILLNESS",
        occurred_at=log_in.occurred_at,
        notes=log_in.notes,
        metadata_dict=metadata
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.post(
    "/med-side-effects",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=LifestyleLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Medication Side Effects",
    description="Log adverse side effects of anti-epileptic drugs (AEDs) like fatigue or dizziness.",
    response_description="The generated lifestyle log representing a medication side effect."
)
async def log_med_side_effect(
    log_in: MedSideEffectLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    metadata = {
        "medication_name": log_in.medication_name,
        "symptom": log_in.symptom,
        "severity": log_in.severity
    }

    new_log = LifestyleLog(
        user_id=target_user_id,
        log_type="MED_SIDE_EFFECT",
        occurred_at=log_in.occurred_at,
        notes=log_in.notes,
        metadata_dict=metadata
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.post(
    "/screen-time",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=LifestyleLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Screen Time",
    description="Track screen time and device usage, as excessive screen time can trigger seizures in some patients.",
    response_description="The generated lifestyle log representing screen time."
)
async def log_screen_time(
    log_in: ScreenTimeLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    metadata = {
        "duration_hours": log_in.duration_hours,
        "duration_minutes": log_in.duration_minutes,
        "total_duration_minutes": (log_in.duration_hours * 60) + log_in.duration_minutes
    }
    if log_in.device_type:
        metadata["device_type"] = log_in.device_type

    new_log = LifestyleLog(
        user_id=target_user_id,
        log_type="SCREEN_TIME",
        occurred_at=log_in.occurred_at,
        notes=log_in.notes,
        metadata_dict=metadata
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.get(
    "/logs",
    tags=['🤒 Patient - Health Tracking', '👨\u200d⚕️ Doctor - Diagnostics', '🤝 Caretaker - Proxy Actions'],
    response_model=PaginatedResponse[LifestyleLogOut],
    summary="List Generic Lifestyle Logs",
    description="Fetches a paginated history of generic lifestyle logs (e.g. stress, diet, menstruation). Optionally filter by log_type."
)
async def get_lifestyle_logs(
    db: DbDep, 
    target_user_id: TargetPatientIdForRead,
    params: PaginationParams = Depends(get_pagination_params),
    log_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None
):
    query = select(LifestyleLog).where(LifestyleLog.user_id == target_user_id)
    
    if log_type:
        query = query.where(LifestyleLog.log_type == log_type.upper())
    if start_date:
        query = query.where(LifestyleLog.occurred_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(LifestyleLog.occurred_at <= datetime.combine(end_date, time.max))
        
    if params.sort_by and hasattr(LifestyleLog, params.sort_by):
        column = getattr(LifestyleLog, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(LifestyleLog.occurred_at.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


@router.put(
    "/logs/{log_id}",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    response_model=LifestyleLogOut,
    summary="Update Generic Lifestyle Log",
    description="Updates an existing generic lifestyle log."
)
async def update_lifestyle_log(
    log_id: int,
    log_in: LifestyleLogUpdate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    query = select(LifestyleLog).where(LifestyleLog.id == log_id, LifestyleLog.user_id == target_user_id)
    result = await db.execute(query)
    log_obj = result.scalar_one_or_none()
    
    if not log_obj:
        raise HTTPException(status_code=404, detail="Lifestyle log not found")
        
    update_data = log_in.model_dump(exclude_unset=True)
    
    if "occurred_at" in update_data and update_data["occurred_at"] is not None:
        log_obj.occurred_at = update_data["occurred_at"]
    if "notes" in update_data:
        log_obj.notes = update_data["notes"]
    if "metadata_dict" in update_data and update_data["metadata_dict"] is not None:
        current_meta = log_obj.metadata_dict or {}
        new_meta = update_data["metadata_dict"] or {}
        current_meta.update(new_meta)
        log_obj.metadata_dict = current_meta
        
    await db.commit()
    await db.refresh(log_obj)
    return log_obj


@router.delete(
    "/logs/{log_id}",
    tags=['🤒 Patient - Health Tracking', '🤝 Caretaker - Proxy Actions'],
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Generic Lifestyle Log",
    description="Deletes a generic lifestyle log."
)
async def delete_lifestyle_log(
    log_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    query = select(LifestyleLog).where(LifestyleLog.id == log_id, LifestyleLog.user_id == target_user_id)
    result = await db.execute(query)
    log_obj = result.scalar_one_or_none()
    
    if not log_obj:
        raise HTTPException(status_code=404, detail="Lifestyle log not found")
        
    await db.delete(log_obj)
    await db.commit()
    return None
