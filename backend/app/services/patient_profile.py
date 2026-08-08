"""
Patient profile service — CRUD for patient profile rows.
"""
from sqlalchemy.orm import Session

from app.models.patient_profile import PatientProfile
from app.schemas.patient_profile import (
    PatientProfileCreate,
    PatientProfileUpdate,
)


def get_profile_for_user(db: Session, user_id: int) -> PatientProfile | None:
    """Fetch a profile by user id."""
    return (
        db.query(PatientProfile)
        .filter(PatientProfile.user_id == user_id)
        .first()
    )


def create_profile(db: Session, user_id: int, data: PatientProfileCreate) -> PatientProfile:
    """Create a profile. Raises 409 if one already exists."""
    from fastapi import HTTPException, status

    if get_profile_for_user(db, user_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Patient profile already exists",
        )
    profile = PatientProfile(user_id=user_id, **data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def upsert_profile(db: Session, user_id: int, data: PatientProfileUpdate) -> PatientProfile:
    """Create or update the profile for a user."""
    profile = get_profile_for_user(db, user_id)
    update_data = data.model_dump(exclude_unset=True, exclude_none=True)

    if profile is None:
        profile = PatientProfile(user_id=user_id, **update_data)
        db.add(profile)
    else:
        for field, value in update_data.items():
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile
