from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.api.deps import DbDep, CurrentUser, RoleChecker
from app.models.enums import UserRole
from app.models.user import User
from app.models.seizure import ManualSeizureLog
from app.schemas.seizure import ManualSeizureLogCreate, ManualSeizureLogOut


router = APIRouter(prefix="/seizures", tags=["Manual Seizure Logs"])

PatientUser = Depends(RoleChecker([UserRole.PATIENT]))


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
    current_user: User = PatientUser,
):
    new_log = ManualSeizureLog(
        user_id=current_user.id,
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
async def get_manual_seizures(db: DbDep, current_user: User = PatientUser):
    result = await db.execute(
        select(ManualSeizureLog)
        .where(ManualSeizureLog.user_id == current_user.id)
        .order_by(ManualSeizureLog.occurred_at.desc())
    )
    return result.scalars().all()
