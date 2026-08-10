"""
User routes — profile management for different user roles (async).
"""
from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbDep
from app.schemas.profiles import (
    PatientProfileOut,
    PatientProfileUpdate,
    DoctorProfileOut,
    DoctorProfileUpdate,
    CaretakerProfileOut,
    CaretakerProfileUpdate,
)
from app.services import patient_profile as patient_service
from app.services import doctor_profile as doctor_service
from app.services import caretaker_profile as caretaker_service

# Removed global tags so we can specify them per role
router = APIRouter(prefix="/users")


# ------------------------------------------------------------------
# Patient Profile Endpoints
# ------------------------------------------------------------------

@router.get(
    "/me/patient-profile",
    response_model=PatientProfileOut,
    tags=["🤒 Patient - Profile & Management"],
    summary="Get patient profile",
    description="Retrieve the current authenticated user's patient profile.",
    responses={
        401: {"description": "Unauthorized - Missing or invalid token"},
        404: {"description": "Patient profile not found for this user"},
    },
)
async def get_my_patient_profile(current_user: CurrentUser, db: DbDep):
    """Get the current user's patient profile."""
    profile = await patient_service.get_profile_for_user(db, current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    return profile




@router.put(
    "/me/patient-profile",
    response_model=PatientProfileOut,
    tags=["🤒 Patient - Profile & Management"],
    summary="Update patient profile",
    description="Create or completely update the current user's patient profile.",
    responses={
        400: {"description": "Bad Request - Validation error"},
        401: {"description": "Unauthorized - Missing or invalid token"},
    },
)
async def update_my_patient_profile(data: PatientProfileUpdate, current_user: CurrentUser, db: DbDep):
    """Create or update the current user's patient profile."""
    return await patient_service.upsert_profile(db, current_user.id, data)


@router.delete(
    "/me/patient-profile",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["🤒 Patient - Profile & Management"],
    summary="Delete patient profile",
    description="Delete the current user's patient profile. The underlying user account remains active.",
    responses={
        401: {"description": "Unauthorized - Missing or invalid token"},
        404: {"description": "Patient profile not found"},
    },
)
async def delete_my_patient_profile(current_user: CurrentUser, db: DbDep):
    """Delete the current user's patient profile."""
    success = await patient_service.delete_profile(db, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found",
        )
    return None


# ------------------------------------------------------------------
# Doctor Profile Endpoints
# ------------------------------------------------------------------

@router.get(
    "/me/doctor-profile",
    response_model=DoctorProfileOut,
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="Get doctor profile",
    description="Retrieve the current authenticated user's doctor profile, including PMDC verification status.",
    responses={
        401: {"description": "Unauthorized - Missing or invalid token"},
        404: {"description": "Doctor profile not found for this user"},
    },
)
async def get_my_doctor_profile(current_user: CurrentUser, db: DbDep):
    """Get the current user's doctor profile."""
    profile = await doctor_service.get_profile_for_user(db, current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    return profile


@router.put(
    "/me/doctor-profile",
    response_model=DoctorProfileOut,
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="Update doctor profile",
    description="Update the current user's doctor profile details.",
    responses={
        400: {"description": "Bad Request - Validation error"},
        401: {"description": "Unauthorized - Missing or invalid token"},
    },
)
async def update_my_doctor_profile(data: DoctorProfileUpdate, current_user: CurrentUser, db: DbDep):
    """Update the current user's doctor profile."""
    return await doctor_service.upsert_profile(db, current_user.id, data)


@router.delete(
    "/me/doctor-profile",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="Delete doctor profile",
    description="Delete the current user's doctor profile. The underlying user account remains active.",
    responses={
        401: {"description": "Unauthorized - Missing or invalid token"},
        404: {"description": "Doctor profile not found"},
    },
)
async def delete_my_doctor_profile(current_user: CurrentUser, db: DbDep):
    """Delete the current user's doctor profile."""
    success = await doctor_service.delete_profile(db, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found",
        )
    return None


# ------------------------------------------------------------------
# Caretaker Profile Endpoints
# ------------------------------------------------------------------

@router.get(
    "/me/caretaker-profile",
    response_model=CaretakerProfileOut,
    tags=["🤝 Caretaker - Profile & Management"],
    summary="Get caretaker profile",
    description="Retrieve the current authenticated user's caretaker profile.",
    responses={
        401: {"description": "Unauthorized - Missing or invalid token"},
        404: {"description": "Caretaker profile not found for this user"},
    },
)
async def get_my_caretaker_profile(current_user: CurrentUser, db: DbDep):
    """Get the current user's caretaker profile."""
    profile = await caretaker_service.get_profile_for_user(db, current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caretaker profile not found",
        )
    return profile




@router.put(
    "/me/caretaker-profile",
    response_model=CaretakerProfileOut,
    tags=["🤝 Caretaker - Profile & Management"],
    summary="Update caretaker profile",
    description="Create or completely update the current user's caretaker profile.",
    responses={
        400: {"description": "Bad Request - Validation error"},
        401: {"description": "Unauthorized - Missing or invalid token"},
    },
)
async def update_my_caretaker_profile(data: CaretakerProfileUpdate, current_user: CurrentUser, db: DbDep):
    """Create or update the current user's caretaker profile."""
    return await caretaker_service.upsert_profile(db, current_user.id, data)


@router.delete(
    "/me/caretaker-profile",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["🤝 Caretaker - Profile & Management"],
    summary="Delete caretaker profile",
    description="Delete the current user's caretaker profile. The underlying user account remains active.",
    responses={
        401: {"description": "Unauthorized - Missing or invalid token"},
        404: {"description": "Caretaker profile not found"},
    },
)
async def delete_my_caretaker_profile(current_user: CurrentUser, db: DbDep):
    """Delete the current user's caretaker profile."""
    success = await caretaker_service.delete_profile(db, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caretaker profile not found",
        )
    return None
