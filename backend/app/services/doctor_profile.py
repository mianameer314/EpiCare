"""
Doctor profile service — CRUD for doctor profile rows (async).
"""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.doctor_profile import DoctorProfile
from app.schemas.profiles import DoctorProfileCreate, DoctorProfileUpdate


async def get_profile_for_user(db: AsyncSession, user_id: int) -> DoctorProfile | None:
    """Fetch a profile by user id."""
    result = await db.execute(
        select(DoctorProfile).where(DoctorProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_profile(db: AsyncSession, user_id: int, data: DoctorProfileCreate) -> DoctorProfile:
    """Create a profile. Raises 409 if one already exists."""
    if await get_profile_for_user(db, user_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Doctor profile already exists",
        )
    profile = DoctorProfile(user_id=user_id, **data.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def upsert_profile(db: AsyncSession, user_id: int, data: DoctorProfileUpdate) -> DoctorProfile:
    """Create or update the profile for a user."""
    profile = await get_profile_for_user(db, user_id)
    update_data = data.model_dump(exclude_unset=True, exclude_none=True)

    if profile is None:
        # Note: We can't easily create a doctor profile without pmdc_number. 
        # For full upsert, it's safer to ensure one exists or require it.
        # However, doctor profiles are created at registration with pmdc_number.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor profile must be created during registration with PMDC number."
        )
    else:
        for field, value in update_data.items():
            setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile


async def delete_profile(db: AsyncSession, user_id: int) -> bool:
    """Delete the profile for a user."""
    profile = await get_profile_for_user(db, user_id)
    if profile is None:
        return False
    await db.delete(profile)
    await db.commit()
    return True
