from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.api.deps import DbDep, TargetPatientIdForRead, TargetPatientIdForWrite
from app.models.enums import UserRole
from app.models.seizure import ManualSeizureLog
from app.schemas.seizure import ManualSeizureLogCreate, ManualSeizureLogUpdate, ManualSeizureLogOut

router = APIRouter(prefix="/seizures", tags=["Manual Seizure Logs"])


@router.post(
    "/manual",
    response_model=ManualSeizureLogOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log Manual Seizure",
    description=(
        "Manually log a seizure that occurred while the patient was not wearing "
        "an EEG device. Tracks core clinical metrics like duration, auras, "
        "and post-ictal symptoms."
    ),
    response_description="The newly created manual seizure log."
)
async def log_manual_seizure(
    log_in: ManualSeizureLogCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    new_log = ManualSeizureLog(
        user_id=target_user_id,
        occurred_at=log_in.occurred_at,
        duration_seconds=log_in.duration_seconds,
        seizure_type=log_in.seizure_type,
        auras_felt=log_in.auras_felt,
        post_ictal_symptoms=log_in.post_ictal_symptoms,
        notes=log_in.notes,
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    return new_log


@router.get(
    "/manual",
    response_model=List[ManualSeizureLogOut],
    summary="List Manual Seizures",
    description="Retrieve a descending history of all manually logged seizures for the authenticated patient.",
    response_description="A list of manual seizure logs."
)
async def get_manual_seizures(db: DbDep, target_user_id: TargetPatientIdForRead):
    result = await db.execute(
        select(ManualSeizureLog)
        .where(ManualSeizureLog.user_id == target_user_id)
        .order_by(ManualSeizureLog.occurred_at.desc())
    )
    return result.scalars().all()


@router.put(
    "/manual/{log_id}",
    response_model=ManualSeizureLogOut,
    summary="Update Manual Seizure Log",
    description="Updates a manual seizure log to correct accidental mistakes.",
)
async def update_manual_seizure(
    log_id: int,
    log_in: ManualSeizureLogUpdate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    result = await db.execute(
        select(ManualSeizureLog).where(
            ManualSeizureLog.id == log_id,
            ManualSeizureLog.user_id == target_user_id
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Manual seizure log not found")

    update_data = log_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)

    await db.commit()
    await db.refresh(log)
    return log


@router.delete(
    "/manual/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Manual Seizure Log",
    description="Deletes a manual seizure log completely.",
)
async def delete_manual_seizure(
    log_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    result = await db.execute(
        select(ManualSeizureLog).where(
            ManualSeizureLog.id == log_id,
            ManualSeizureLog.user_id == target_user_id
        )
    )
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Manual seizure log not found")

    await db.delete(log)
    await db.commit()
    return None
