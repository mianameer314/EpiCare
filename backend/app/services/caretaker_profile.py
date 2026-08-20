"""
Caretaker profile service — CRUD for caretaker profile rows (async).
"""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.caretaker_profile import CaretakerProfile
from app.schemas.profiles import CaretakerProfileCreate, CaretakerProfileUpdate


async def get_profile_for_user(db: AsyncSession, user_id: int) -> CaretakerProfile | None:
    """Fetch a profile by user id."""
    result = await db.execute(
        select(CaretakerProfile).where(CaretakerProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_profile(db: AsyncSession, user_id: int, data: CaretakerProfileCreate) -> CaretakerProfile:
    """Create a profile. Raises 409 if one already exists."""
    if await get_profile_for_user(db, user_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Caretaker profile already exists",
        )
    profile = CaretakerProfile(user_id=user_id, **data.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def upsert_profile(db: AsyncSession, user_id: int, data: CaretakerProfileUpdate) -> CaretakerProfile:
    """Create or update the profile for a user."""
    profile = await get_profile_for_user(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    if profile is None:
        profile = CaretakerProfile(user_id=user_id, **update_data)
        db.add(profile)
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
