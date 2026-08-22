"""
User routes — profile management for different user roles (async).
"""
from pydantic import BaseModel
from fastapi import APIRouter, File, HTTPException, UploadFile, Response, status

from app.api.deps import CurrentUser, DbDep
from app.schemas.user import UserOut
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
from app.services.storage.service import get_storage_service
from app.services.storage.validator import validate_doctor_upload

# Removed global tags so we can specify them per role
router = APIRouter(prefix="/users")


@router.post(
    "/me/profile-photo",
    response_model=UserOut,
    tags=["👤 Shared - Profile Photo"],
    summary="Upload shared profile photo",
)
async def upload_my_profile_photo(current_user: CurrentUser, db: DbDep, file: UploadFile = File(...)):
    data, filename, content_type = await validate_doctor_upload(file, photo=True)
    storage = get_storage_service()
    old_key = current_user.profile_photo_path
    new_key = storage.save_user_photo(data, filename)
    current_user.profile_photo_path = new_key
    current_user.profile_photo_mime_type = content_type
    try:
        await db.commit()
        await db.refresh(current_user)
        storage.clear_pending()
    except Exception:
        await db.rollback()
        storage.rollback_uploads()
        raise
    if old_key and old_key.startswith("user-profile/"):
        storage.delete(old_key)
    return current_user


@router.get(
    "/me/profile-photo",
    tags=["👤 Shared - Profile Photo"],
    summary="View shared profile photo",
)
async def view_my_profile_photo(current_user: CurrentUser):
    if not current_user.profile_photo_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile photo not found")
    storage = get_storage_service()
    if not storage.exists(current_user.profile_photo_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored profile photo not found")
    return Response(content=storage.read(current_user.profile_photo_path), media_type=current_user.profile_photo_mime_type or "image/jpeg")


@router.delete(
    "/me/profile-photo",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["👤 Shared - Profile Photo"],
    summary="Delete shared profile photo",
)
async def delete_my_profile_photo(current_user: CurrentUser, db: DbDep):
    if not current_user.profile_photo_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile photo not found")
    old_key = current_user.profile_photo_path
    current_user.profile_photo_path = None
    current_user.profile_photo_mime_type = None
    await db.commit()
    storage = get_storage_service()
    if old_key.startswith("user-profile/"):
        storage.delete(old_key)
    return None


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


@router.post(
    "/me/doctor-profile/pmdc-certificate",
    response_model=DoctorProfileOut,
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="Upload PMDC certificate",
)
async def upload_my_pmdc_certificate(
    current_user: CurrentUser,
    db: DbDep,
    file: UploadFile = File(...),
):
    """Upload or replace the authenticated doctor's PMDC certificate."""
    data, filename, mime_type = await validate_doctor_upload(file)
    return await doctor_service.save_certificate(
        db, current_user.id, get_storage_service(), data, filename, mime_type
    )


from urllib.parse import quote
from app.services.storage.validator import sanitize_filename


@router.get(
    "/me/doctor-profile/pmdc-certificate",
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="View PMDC certificate",
)
async def view_my_pmdc_certificate(current_user: CurrentUser, db: DbDep):
    """Return the authenticated doctor's certificate with RFC-safe Content-Disposition (Finding 15)."""
    profile = await doctor_service.get_profile_for_user(db, current_user.id)
    if not profile or not profile.pmdc_certificate_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PMDC certificate not found")
    storage = get_storage_service()
    if not storage.exists(profile.pmdc_certificate_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored PMDC certificate not found")
    content = storage.read(profile.pmdc_certificate_path)
    raw_filename = profile.pmdc_certificate_name or "pmdc-certificate.pdf"
    safe_filename = sanitize_filename(raw_filename)
    encoded_filename = quote(safe_filename)
    mime_type = profile.pmdc_certificate_mime_type or "application/pdf"
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-transform, max-age=300",
        },
    )


@router.post(
    "/me/doctor-profile/photo",
    response_model=DoctorProfileOut,
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="Upload doctor profile photo",
)
async def upload_my_doctor_photo(
    current_user: CurrentUser,
    db: DbDep,
    file: UploadFile = File(...),
):
    """Upload or replace the authenticated doctor's profile photo."""
    data, filename, mime_type = await validate_doctor_upload(file, photo=True)
    return await doctor_service.save_profile_photo(
        db, current_user.id, get_storage_service(), data, filename, mime_type
    )


@router.get(
    "/me/doctor-profile/photo",
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="View doctor profile photo",
)
async def view_my_doctor_photo(current_user: CurrentUser, db: DbDep):
    """Return the authenticated doctor's profile photo for an authenticated preview."""
    profile = await doctor_service.get_profile_for_user(db, current_user.id)
    if not profile or not profile.profile_photo_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile photo not found")
    storage = get_storage_service()
    if not storage.exists(profile.profile_photo_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored profile photo not found")
    return Response(
        content=storage.read(profile.profile_photo_path),
        media_type=profile.profile_photo_mime_type or "image/jpeg",
    )


@router.delete(
    "/me/doctor-profile/pmdc-certificate",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="Remove PMDC certificate",
)
async def delete_my_pmdc_certificate(current_user: CurrentUser, db: DbDep):
    """Remove the current certificate metadata without deleting the doctor profile."""
    profile = await doctor_service.get_profile_for_user(db, current_user.id)
    if not profile or not profile.pmdc_certificate_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PMDC certificate not found")
    old_key = profile.pmdc_certificate_path
    profile.pmdc_certificate_path = None
    profile.pmdc_certificate_name = None
    profile.pmdc_certificate_mime_type = None
    profile.pmdc_certificate_size = None
    profile.license_image_url = None
    await db.commit()
    storage = get_storage_service()
    if old_key.startswith("doctor-profile/"):
        storage.delete(old_key)
    return None


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
    "/me/doctor-profile/photo",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["👨‍⚕️ Doctor - Profile & Management"],
    summary="Remove doctor profile photo",
)
async def delete_my_doctor_photo(current_user: CurrentUser, db: DbDep):
    profile = await doctor_service.get_profile_for_user(db, current_user.id)
    if not profile or not profile.profile_photo_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile photo not found")
    old_key = profile.profile_photo_path
    profile.profile_photo_path = None
    profile.profile_photo_mime_type = None
    await db.commit()
    storage = get_storage_service()
    if old_key.startswith("doctor-profile/"):
        storage.delete(old_key)
    return None


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


from pydantic import Field


class FcmTokenUpdate(BaseModel):
    fcm_token: str = Field(min_length=20, max_length=4096, pattern=r"^[A-Za-z0-9_:.\-]+$")


@router.put(
    "/me/fcm-token",
    tags=["👤 Users - Core Authentication & Profile"],
    summary="Register FCM Device Token",
    description="Registers or updates the user's Firebase Cloud Messaging device token for push alerts.",
)
async def update_fcm_token(body: FcmTokenUpdate, current_user: CurrentUser, db: DbDep):
    """Save or update the user's device FCM push token."""
    current_user.fcm_token = body.fcm_token
    await db.commit()
    return {"message": "FCM device token registered successfully"}
