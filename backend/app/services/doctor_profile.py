"""Doctor profile service — CRUD and transactional file updates."""
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.doctor_profile import DoctorProfile
from app.schemas.profiles import DoctorProfileCreate, DoctorProfileUpdate
from app.services.storage.service import StorageService


async def get_profile_for_user(db: AsyncSession, user_id: int) -> DoctorProfile | None:
    """Fetch a profile by user id."""
    result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def create_profile(db: AsyncSession, user_id: int, data: DoctorProfileCreate) -> DoctorProfile:
    """Create a profile. Raises 409 if one already exists."""
    if await get_profile_for_user(db, user_id) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Doctor profile already exists")
    profile = DoctorProfile(user_id=user_id, **data.model_dump())
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def upsert_profile(db: AsyncSession, user_id: int, data: DoctorProfileUpdate) -> DoctorProfile:
    """Update the existing doctor profile without allowing PMDC verification changes."""
    profile = await get_profile_for_user(db, user_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor profile must be created during registration with PMDC number.",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return profile


async def save_certificate(
    db: AsyncSession,
    user_id: int,
    storage: StorageService,
    data: bytes,
    filename: str,
    mime_type: str,
) -> DoctorProfile:
    """Persist a PMDC certificate and its metadata atomically with the DB row."""
    profile = await get_profile_for_user(db, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    old_key = profile.pmdc_certificate_path
    new_key = storage.save_doctor_file(data, filename)
    profile.pmdc_certificate_path = new_key
    profile.pmdc_certificate_name = filename
    profile.pmdc_certificate_mime_type = mime_type
    profile.pmdc_certificate_size = len(data)
    # Keep the legacy response field useful for older clients while the new
    # certificate-specific fields become the source of truth.
    profile.license_image_url = new_key

    try:
        await db.commit()
        await db.refresh(profile)
        storage.clear_pending()
    except Exception:
        await db.rollback()
        storage.rollback_uploads()
        raise

    if old_key and old_key != new_key and old_key.startswith("doctor-profile/"):
        storage.delete(old_key)
    return profile


async def save_profile_photo(
    db: AsyncSession,
    user_id: int,
    storage: StorageService,
    data: bytes,
    filename: str,
    mime_type: str,
) -> DoctorProfile:
    """Persist a profile photo and replace the previous photo after commit."""
    profile = await get_profile_for_user(db, user_id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    old_key = profile.profile_photo_path
    new_key = storage.save_doctor_file(data, filename, photo=True)
    profile.profile_photo_path = new_key
    profile.profile_photo_mime_type = mime_type

    try:
        await db.commit()
        await db.refresh(profile)
        storage.clear_pending()
    except Exception:
        await db.rollback()
        storage.rollback_uploads()
        raise

    if old_key and old_key != new_key and old_key.startswith("doctor-profile/"):
        storage.delete(old_key)
    return profile


async def delete_profile(db: AsyncSession, user_id: int) -> bool:
    """Delete the profile for a user."""
    profile = await get_profile_for_user(db, user_id)
    if profile is None:
        return False
    await db.delete(profile)
    await db.commit()
    return True
