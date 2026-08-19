"""
API dependencies — async DB session, bearer auth guards, current-user resolution.

Every session is created from the async_sessionmaker, tagged with the current
trace_id (SQLAlchemy query comments for end-to-end correlation), and closed
in a finally block.
"""
from app.models.caretaker_profile import CaretakerProfile
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.middleware.request_context import request_id_var
from app.models.user import User
from app.models.enums import UserRole

# ---------- Security Scheme ----------

bearer_scheme = HTTPBearer()

# ---------- Dependency Aliases ----------

DbDep = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]


# ---------- Auth Guards ----------

async def get_current_user(credentials: TokenDep, db: DbDep) -> User:
    """Decode JWT and return the authenticated User, or raise 401."""
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type, expected access token",
            )
        user_email: str | None = payload.get("sub")
        if user_email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return user


async def get_refresh_user(credentials: TokenDep, db: DbDep) -> User:
    """Decode refresh JWT and return the user."""
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type, expected refresh token",
            )
        user_email: str | None = payload.get("sub")
        if user_email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
RefreshUser = Annotated[User, Depends(get_refresh_user)]


# ---------- Role Checking ----------

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: CurrentUser) -> User:
        print(f"DEBUG: user.role='{user.role}' ({type(user.role)}), allowed_roles='{self.allowed_roles}' ([{type(self.allowed_roles[0])}])")
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted",
            )
        return user


async def get_verified_doctor(user: Annotated[User, Depends(RoleChecker([UserRole.DOCTOR]))], db: DbDep) -> User:
    """Ensure the doctor has been PMDC verified by admin."""
    from app.models.doctor_profile import DoctorProfile
    
    result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    
    if not profile or not profile.is_pmdc_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor profile pending PMDC verification",
        )
    return user

VerifiedDoctor = Annotated[User, Depends(get_verified_doctor)]

# ---------- ABAC Authorization ----------

from fastapi import Query
from app.models.enums import ConnectionStatus
from app.models.networks import PatientDoctorNetwork, PatientCaretakerNetwork
from app.models.patient_profile import PatientProfile
from app.models.doctor_profile import DoctorProfile
from app.models.caretaker_profile import CaretakerProfile


async def get_target_patient_for_read(
    db: DbDep, 
    current_user: CurrentUser, 
    patient_user_id: int | None = Query(None, description="Target patient User ID (optional, auto-resolves for connected caretakers/doctors)")
) -> int:
    if current_user.role == UserRole.PATIENT:
        if patient_user_id and patient_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients can only access their own data")
        return current_user.id

    if current_user.role == UserRole.CARETAKER:
        result = await db.execute(select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.id))
        caretaker_profile = result.scalar_one_or_none()
        if not caretaker_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caretaker profile not found")

        # Auto-resolve if not passed
        if not patient_user_id:
            net_res = await db.execute(
                select(PatientProfile.user_id)
                .join(PatientCaretakerNetwork, PatientCaretakerNetwork.patient_id == PatientProfile.id)
                .where(
                    PatientCaretakerNetwork.caretaker_id == caretaker_profile.id,
                    PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
                )
            )
            connected_patient_ids = net_res.scalars().all()
            if not connected_patient_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active connected patient found. Connect with a patient in Care Network first.")
            return connected_patient_ids[0]

        result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == patient_user_id))
        patient_profile = result.scalar_one_or_none()
        if not patient_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target patient profile not found")

        result = await db.execute(
            select(PatientCaretakerNetwork).where(
                PatientCaretakerNetwork.caretaker_id == caretaker_profile.id,
                PatientCaretakerNetwork.patient_id == patient_profile.id,
                PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active connection to this patient")
        return patient_user_id

    if current_user.role == UserRole.DOCTOR:
        result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == current_user.id))
        doctor_profile = result.scalar_one_or_none()
        if not doctor_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor profile not found")

        # Auto-resolve if not passed
        if not patient_user_id:
            net_res = await db.execute(
                select(PatientProfile.user_id)
                .join(PatientDoctorNetwork, PatientDoctorNetwork.patient_id == PatientProfile.id)
                .where(
                    PatientDoctorNetwork.doctor_id == doctor_profile.id,
                    PatientDoctorNetwork.relationship_status == ConnectionStatus.ACTIVE
                )
            )
            connected_patient_ids = net_res.scalars().all()
            if not connected_patient_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active connected patient found. Connect with a patient first.")
            return connected_patient_ids[0]

        result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == patient_user_id))
        patient_profile = result.scalar_one_or_none()
        if not patient_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target patient profile not found")

        result = await db.execute(
            select(PatientDoctorNetwork).where(
                PatientDoctorNetwork.doctor_id == doctor_profile.id,
                PatientDoctorNetwork.patient_id == patient_profile.id,
                PatientDoctorNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active connection to this patient")
        return patient_user_id

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not authorized to view patient data")


async def get_target_patient_for_write(
    db: DbDep, 
    current_user: CurrentUser, 
    patient_user_id: int | None = Query(None, description="Target patient User ID (optional, auto-resolves for connected caretakers)")
) -> int:
    if current_user.role == UserRole.PATIENT:
        if patient_user_id and patient_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients can only access their own data")
        return current_user.id

    if current_user.role == UserRole.DOCTOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctors are strictly read-only for patient data")

    if current_user.role == UserRole.CARETAKER:
        result = await db.execute(select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.id))
        caretaker_profile = result.scalar_one_or_none()
        if not caretaker_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caretaker profile not found")

        # Auto-resolve if not passed
        if not patient_user_id:
            net_res = await db.execute(
                select(PatientProfile.user_id)
                .join(PatientCaretakerNetwork, PatientCaretakerNetwork.patient_id == PatientProfile.id)
                .where(
                    PatientCaretakerNetwork.caretaker_id == caretaker_profile.id,
                    PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
                )
            )
            connected_patient_ids = net_res.scalars().all()
            if not connected_patient_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active connected patient found. Connect with a patient in Care Network first.")
            patient_user_id = connected_patient_ids[0]

        result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == patient_user_id))
        patient_profile = result.scalar_one_or_none()
        if not patient_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target patient profile not found")

        result = await db.execute(
            select(PatientCaretakerNetwork).where(
                PatientCaretakerNetwork.caretaker_id == caretaker_profile.id,
                PatientCaretakerNetwork.patient_id == patient_profile.id,
                PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        network = result.scalar_one_or_none()
        if not network:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active connection to this patient")

        return patient_user_id

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not authorized to write patient data")


async def get_target_patient_for_prescription(
    db: DbDep, 
    current_user: CurrentUser, 
    patient_user_id: int | None = Query(None, description="Target patient User ID (required for prescriptions)")
) -> int:
    if current_user.role == UserRole.PATIENT:
        return current_user.id

    if current_user.role == UserRole.CARETAKER:
        if patient_user_id:
            result = await db.execute(
                select(PatientCaretakerNetwork)
                .join(CaretakerProfile, CaretakerProfile.id == PatientCaretakerNetwork.caretaker_id)
                .join(PatientProfile, PatientProfile.id == PatientCaretakerNetwork.patient_id)
                .where(
                    CaretakerProfile.user_id == current_user.id,
                    PatientProfile.user_id == patient_user_id,
                    PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
                )
            )
            if not result.scalar_one_or_none():
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active connection to this patient")
            return patient_user_id

        result = await db.execute(
            select(PatientProfile.user_id)
            .join(PatientCaretakerNetwork, PatientCaretakerNetwork.patient_id == PatientProfile.id)
            .join(CaretakerProfile, CaretakerProfile.id == PatientCaretakerNetwork.caretaker_id)
            .where(
                CaretakerProfile.user_id == current_user.id,
                PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        connected_patient = result.scalar_one_or_none()
        if not connected_patient:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active connected patient found")
        return connected_patient

    if current_user.role == UserRole.DOCTOR:
        result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == current_user.id))
        doctor_profile = result.scalar_one_or_none()
        if not doctor_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor profile not found")

        if not patient_user_id:
            net_res = await db.execute(
                select(PatientProfile.user_id)
                .join(PatientDoctorNetwork, PatientDoctorNetwork.patient_id == PatientProfile.id)
                .where(
                    PatientDoctorNetwork.doctor_id == doctor_profile.id,
                    PatientDoctorNetwork.relationship_status == ConnectionStatus.ACTIVE
                )
            )
            connected_patient_ids = net_res.scalars().all()
            if not connected_patient_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active connected patient found. Select a patient first.")
            patient_user_id = connected_patient_ids[0]

        result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == patient_user_id))
        patient_profile = result.scalar_one_or_none()
        if not patient_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target patient profile not found")

        result = await db.execute(
            select(PatientDoctorNetwork).where(
                PatientDoctorNetwork.doctor_id == doctor_profile.id,
                PatientDoctorNetwork.patient_id == patient_profile.id,
                PatientDoctorNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active connection to this patient")

        return patient_user_id

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not authorized to prescribe medications")


async def get_target_patient_for_diagnostic_upload(
    db: DbDep, 
    current_user: CurrentUser, 
    patient_user_id: int | None = Query(None, description="Target patient User ID (optional, auto-resolves for connected caretakers and doctors)")
) -> int:
    if current_user.role == UserRole.PATIENT:
        if patient_user_id and patient_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients can only access their own data")
        return current_user.id

    if current_user.role == UserRole.DOCTOR:
        result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == current_user.id))
        doctor_profile = result.scalar_one_or_none()
        if not doctor_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor profile not found")

        if not patient_user_id:
            net_res = await db.execute(
                select(PatientProfile.user_id)
                .join(PatientDoctorNetwork, PatientDoctorNetwork.patient_id == PatientProfile.id)
                .where(
                    PatientDoctorNetwork.doctor_id == doctor_profile.id,
                    PatientDoctorNetwork.relationship_status == ConnectionStatus.ACTIVE
                )
            )
            connected_patient_ids = net_res.scalars().all()
            if not connected_patient_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active connected patient found.")
            patient_user_id = connected_patient_ids[0]

        result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == patient_user_id))
        patient_profile = result.scalar_one_or_none()
        if not patient_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target patient profile not found")

        result = await db.execute(
            select(PatientDoctorNetwork).where(
                PatientDoctorNetwork.doctor_id == doctor_profile.id,
                PatientDoctorNetwork.patient_id == patient_profile.id,
                PatientDoctorNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active connection to this patient")

        return patient_user_id

    if current_user.role == UserRole.CARETAKER:
        result = await db.execute(select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.id))
        caretaker_profile = result.scalar_one_or_none()
        if not caretaker_profile:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Caretaker profile not found")

        if not patient_user_id:
            net_res = await db.execute(
                select(PatientProfile.user_id)
                .join(PatientCaretakerNetwork, PatientCaretakerNetwork.patient_id == PatientProfile.id)
                .where(
                    PatientCaretakerNetwork.caretaker_id == caretaker_profile.id,
                    PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
                )
            )
            connected_patient_ids = net_res.scalars().all()
            if not connected_patient_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active connected patient found.")
            patient_user_id = connected_patient_ids[0]

        result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == patient_user_id))
        patient_profile = result.scalar_one_or_none()
        if not patient_profile:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target patient profile not found")

        result = await db.execute(
            select(PatientCaretakerNetwork).where(
                PatientCaretakerNetwork.caretaker_id == caretaker_profile.id,
                PatientCaretakerNetwork.patient_id == patient_profile.id,
                PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        network = result.scalar_one_or_none()
        if not network:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active connection to this patient")

        return patient_user_id

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not authorized to upload diagnostics")


TargetPatientIdForRead = Annotated[int, Depends(get_target_patient_for_read)]
TargetPatientIdForWrite = Annotated[int, Depends(get_target_patient_for_write)]
TargetPatientIdForPrescription = Annotated[int, Depends(get_target_patient_for_prescription)]
TargetPatientIdForDiagnosticUpload = Annotated[int, Depends(get_target_patient_for_diagnostic_upload)]
