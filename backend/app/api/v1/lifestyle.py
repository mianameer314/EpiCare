from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.api.deps import DbDep, CurrentUser, RoleChecker
from app.models.enums import UserRole
from app.models.user import User
from app.models.lifestyle import SleepLog, TriggerLog, LifestyleLog
from app.schemas.lifestyle import (
    SleepLogCreate,
    SleepLogOut,
    TriggerLogCreate,
    TriggerLogOut,
    StressLogCreate,
    LifestyleLogOut,
)

router = APIRouter(prefix="/lifestyle", tags=["Lifestyle & Diary"])

PatientUser = Depends(RoleChecker([UserRole.PATIENT]))


@router.post("/sleep", response_model=SleepLogOut, status_code=status.HTTP_201_CREATED)
async def log_sleep(
    log_in: SleepLogCreate,
    db: DbDep,
    current_user: User = PatientUser,
):
    """Log a daily sleep record."""
    # Calculate duration
    duration = (log_in.woke_at - log_in.slept_at).total_seconds() / 60.0
    
    new_log = SleepLog(
        user_id=current_user.id,
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


@router.get("/sleep", response_model=List[SleepLogOut])
async def get_sleep_logs(db: DbDep, current_user: User = PatientUser):
    """Get all sleep logs for the current patient."""
    result = await db.execute(
        select(SleepLog).where(SleepLog.user_id == current_user.id).order_by(SleepLog.woke_at.desc())
    )
    return result.scalars().all()


@router.post("/triggers", response_model=TriggerLogOut, status_code=status.HTTP_201_CREATED)
async def log_trigger(
    log_in: TriggerLogCreate,
    db: DbDep,
    current_user: User = PatientUser,
):
    """Log a specific trigger occurrence."""
    new_log = TriggerLog(
        user_id=current_user.id,
        trigger_name=log_in.trigger_name,
        severity=log_in.severity,
        occurred_at=log_in.occurred_at,
        notes=log_in.notes,
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.get("/triggers", response_model=List[TriggerLogOut])
async def get_trigger_logs(db: DbDep, current_user: User = PatientUser):
    """Get all trigger logs."""
    result = await db.execute(
        select(TriggerLog).where(TriggerLog.user_id == current_user.id).order_by(TriggerLog.occurred_at.desc())
    )
    return result.scalars().all()


@router.post("/stress", response_model=LifestyleLogOut, status_code=status.HTTP_201_CREATED)
async def log_stress(
    log_in: StressLogCreate,
    db: DbDep,
    current_user: User = PatientUser,
):
    """Log daily stress levels."""
    new_log = LifestyleLog(
        user_id=current_user.id,
        log_type="STRESS",
        occurred_at=log_in.occurred_at,
        notes=f"Severity: {log_in.severity}/5. {log_in.notes or ''}".strip(),
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log
