"""
User routes — current user profile and patient profile management (async).
"""
from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbDep
from app.schemas.patient_profile import (
    PatientProfileCreate,
    PatientProfileOut,
    PatientProfileUpdate,
)
from app.schemas.user import UserOut
from app.services import patient_profile as profile_service

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser):
    """Get the current user."""
    return current_user


@router.get("/me/profile", response_model=PatientProfileOut)
async def get_my_profile(current_user: CurrentUser, db: DbDep):
    """Get the current user's patient profile."""
    profile = await profile_service.get_profile_for_user(db, current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    return profile


@router.post("/me/profile", response_model=PatientProfileOut, status_code=status.HTTP_201_CREATED)
async def create_my_profile(data: PatientProfileCreate, current_user: CurrentUser, db: DbDep):
    """Create the current user's patient profile."""
    return await profile_service.create_profile(db, current_user.id, data)


@router.put("/me/profile", response_model=PatientProfileOut)
async def update_my_profile(data: PatientProfileUpdate, current_user: CurrentUser, db: DbDep):
    """Create or update the current user's patient profile."""
    return await profile_service.upsert_profile(db, current_user.id, data)
