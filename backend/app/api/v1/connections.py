"""
Connections routes — managing patient-doctor and patient-caretaker relationships (async).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from pydantic import BaseModel

from app.api.deps import DbDep, CurrentUser, RoleChecker, get_verified_doctor, VerifiedDoctor
from app.models.enums import UserRole, ConnectionStatus
from app.models.user import User
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.caretaker_profile import CaretakerProfile
from app.models.networks import PatientDoctorNetwork, PatientCaretakerNetwork
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/connections", tags=["Connections"])


class DoctorSearchResponse(BaseModel):
    doctor_id: int
    full_name: str
    pmdc_number: str
    specialty: str
    hospital_affiliation: str | None


class ConnectionRequest(BaseModel):
    doctor_id: int


class ConnectionResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int | None = None
    caretaker_id: int | None = None
    relationship_status: ConnectionStatus


class CaretakerConnectionRequest(BaseModel):
    caretaker_email: EmailStr


@router.get(
    "/doctors/search",
    response_model=List[DoctorSearchResponse],
    summary="Search verified doctors",
    description="Search for PMDC-verified doctors by name, specialty, hospital, or PMDC number. Only patients can search for doctors.",
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Only patients can search for doctors"},
    },
)
async def search_doctors(
    db: DbDep,
    current_user: User = Depends(RoleChecker([UserRole.PATIENT])),
    pmdc_number: str | None = None,
    name: str | None = None,
    specialty: str | None = None,
    hospital: str | None = None,
    skip: int = 0,
    limit: int = 20,
):
    """Search for verified doctors with optional filters."""
    query = (
        select(DoctorProfile)
        .join(User, DoctorProfile.user_id == User.id)
        .options(selectinload(DoctorProfile.user))
        .where(DoctorProfile.is_pmdc_verified == True)
    )
    
    if pmdc_number:
        query = query.where(DoctorProfile.pmdc_number == pmdc_number)
    if name:
        query = query.where(User.full_name.ilike(f"%{name}%"))
    if specialty:
        query = query.where(DoctorProfile.specialty.ilike(f"%{specialty}%"))
    if hospital:
        query = query.where(DoctorProfile.hospital_affiliation.ilike(f"%{hospital}%"))
        
    query = query.order_by(User.full_name.asc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    doctors = result.scalars().all()
    
    return [
        DoctorSearchResponse(
            doctor_id=doc.id,
            full_name=doc.user.full_name,
            pmdc_number=doc.pmdc_number,
            specialty=doc.specialty,
            hospital_affiliation=doc.hospital_affiliation
        )
        for doc in doctors
    ]


@router.post(
    "/doctors/request",
    response_model=ConnectionResponse,
    summary="Request doctor connection",
    description="Patient sends a connection request to a doctor. A patient can only have one active/pending connection with a specific doctor.",
    responses={
        400: {"description": "Bad Request - Connection already exists or is pending"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Only patients can request doctor connections"},
        404: {"description": "Not Found - Patient profile or doctor not found"},
    },
)
async def request_connection(
    data: ConnectionRequest, 
    db: DbDep, 
    current_user: User = Depends(RoleChecker([UserRole.PATIENT]))
):
    """Patient sends a connection request to a doctor."""
    # Get patient profile
    result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == current_user.id))
    patient_profile = result.scalar_one_or_none()
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    # Check if doctor exists
    result = await db.execute(select(DoctorProfile).where(DoctorProfile.id == data.doctor_id))
    doctor_profile = result.scalar_one_or_none()
    if not doctor_profile:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    # Check if connection already exists
    query = select(PatientDoctorNetwork).where(
        PatientDoctorNetwork.patient_id == patient_profile.id,
        PatientDoctorNetwork.doctor_id == doctor_profile.id
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Connection already exists with status: {existing.relationship_status}")
        
    network = PatientDoctorNetwork(
        patient_id=patient_profile.id,
        doctor_id=doctor_profile.id,
        relationship_status=ConnectionStatus.PENDING
    )
    db.add(network)
    
    from sqlalchemy.exc import IntegrityError
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Connection already exists or is pending")
        
    await db.refresh(network)
    
    return network


@router.post(
    "/doctors/approve/{connection_id}",
    response_model=ConnectionResponse,
    summary="Approve connection request",
    description="A PMDC-verified doctor approves a pending connection request from a patient.",
    responses={
        400: {"description": "Bad Request - Connection is not in pending status"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Only verified doctors can approve connections"},
        404: {"description": "Not Found - Connection request not found"},
    },
)
async def approve_connection(
    connection_id: int, 
    db: DbDep, 
    current_user: VerifiedDoctor
):
    """Doctor approves a pending connection request."""
    # Get doctor profile
    result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == current_user.id))
    doctor_profile = result.scalar_one_or_none()
    
    # Get connection
    query = select(PatientDoctorNetwork).where(
        PatientDoctorNetwork.id == connection_id,
        PatientDoctorNetwork.doctor_id == doctor_profile.id
    )
    result = await db.execute(query)
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection request not found")
        
    if connection.relationship_status != ConnectionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Connection is not in pending status")
        
    connection.relationship_status = ConnectionStatus.ACTIVE
    await db.commit()
    await db.refresh(connection)
    
    return connection


@router.delete(
    "/doctors/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke doctor connection",
    description="Patient revokes an active or pending doctor connection.",
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Only patients can revoke doctor connections"},
        404: {"description": "Not Found - Connection request not found"},
    },
)
async def revoke_doctor_connection(
    connection_id: int, 
    db: DbDep, 
    current_user: User = Depends(RoleChecker([UserRole.PATIENT]))
):
    """Patient revokes a doctor connection."""
    result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == current_user.id))
    patient_profile = result.scalar_one_or_none()
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    query = select(PatientDoctorNetwork).where(
        PatientDoctorNetwork.id == connection_id,
        PatientDoctorNetwork.patient_id == patient_profile.id
    )
    result = await db.execute(query)
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    connection.relationship_status = ConnectionStatus.REVOKED
    await db.commit()
    return None


# ==========================================
# Caretaker Connections
# ==========================================

CaretakerUser = Depends(RoleChecker([UserRole.CARETAKER]))


@router.post(
    "/caretakers/request",
    response_model=ConnectionResponse,
    summary="Request caretaker connection",
    description="Patient requests a connection using the caretaker's email.",
    responses={
        400: {"description": "Bad Request - Connection already exists or is pending"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Only patients can request connections"},
        404: {"description": "Not Found - Patient profile or caretaker not found"},
    },
)
async def request_caretaker_connection(
    data: CaretakerConnectionRequest, 
    db: DbDep, 
    current_user: User = Depends(RoleChecker([UserRole.PATIENT]))
):
    """Patient sends a connection request to a caretaker."""
    # Get patient profile
    result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == current_user.id))
    patient_profile = result.scalar_one_or_none()
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
        
    # Check if caretaker exists by email
    user_query = select(User).where(User.email == data.caretaker_email, User.role == UserRole.CARETAKER)
    result = await db.execute(user_query)
    caretaker_user = result.scalar_one_or_none()
    if not caretaker_user:
        raise HTTPException(status_code=404, detail="Caretaker account with this email not found")

    result = await db.execute(select(CaretakerProfile).where(CaretakerProfile.user_id == caretaker_user.id))
    caretaker_profile = result.scalar_one_or_none()
    if not caretaker_profile:
        raise HTTPException(status_code=404, detail="Caretaker profile not found")
        
    # Check if connection already exists
    query = select(PatientCaretakerNetwork).where(
        PatientCaretakerNetwork.patient_id == patient_profile.id,
        PatientCaretakerNetwork.caretaker_id == caretaker_profile.id
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Connection already exists with status: {existing.relationship_status}")
        
    network = PatientCaretakerNetwork(
        patient_id=patient_profile.id,
        caretaker_id=caretaker_profile.id,
        relationship_status=ConnectionStatus.PENDING
    )
    db.add(network)
    
    from sqlalchemy.exc import IntegrityError
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Connection already exists or is pending")
        
    await db.refresh(network)
    
    return network


@router.get(
    "/caretakers/pending",
    response_model=List[ConnectionResponse],
    summary="List pending requests",
    description="Caretaker views all pending connection requests.",
)
async def get_pending_caretaker_requests(db: DbDep, current_user: User = CaretakerUser):
    # Get caretaker profile
    result = await db.execute(select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.id))
    caretaker_profile = result.scalar_one_or_none()
    
    if not caretaker_profile:
        return []

    query = select(PatientCaretakerNetwork).where(
        PatientCaretakerNetwork.caretaker_id == caretaker_profile.id,
        PatientCaretakerNetwork.relationship_status == ConnectionStatus.PENDING
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "/caretakers/approve/{connection_id}",
    response_model=ConnectionResponse,
    summary="Approve connection request",
    description="Caretaker approves a pending connection request.",
    responses={
        400: {"description": "Bad Request - Connection is not in pending status"},
        404: {"description": "Not Found - Connection request not found"},
    },
)
async def approve_caretaker_connection(
    connection_id: int, 
    db: DbDep, 
    current_user: User = CaretakerUser
):
    """Caretaker approves a pending connection request."""
    # Get caretaker profile
    result = await db.execute(select(CaretakerProfile).where(CaretakerProfile.user_id == current_user.id))
    caretaker_profile = result.scalar_one_or_none()
    
    # Get connection
    query = select(PatientCaretakerNetwork).where(
        PatientCaretakerNetwork.id == connection_id,
        PatientCaretakerNetwork.caretaker_id == caretaker_profile.id
    )
    result = await db.execute(query)
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection request not found")
        
    if connection.relationship_status != ConnectionStatus.PENDING:
        raise HTTPException(status_code=400, detail="Connection is not in pending status")
        
    connection.relationship_status = ConnectionStatus.ACTIVE
    await db.commit()
    await db.refresh(connection)
    
    return connection


@router.delete(
    "/caretakers/{connection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke caretaker connection",
    description="Patient revokes an active or pending caretaker connection.",
    responses={
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - Only patients can revoke caretaker connections"},
        404: {"description": "Not Found - Connection request not found"},
    },
)
async def revoke_caretaker_connection(
    connection_id: int, 
    db: DbDep, 
    current_user: User = Depends(RoleChecker([UserRole.PATIENT]))
):
    """Patient revokes a caretaker connection."""
    result = await db.execute(select(PatientProfile).where(PatientProfile.user_id == current_user.id))
    patient_profile = result.scalar_one_or_none()
    if not patient_profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    
    query = select(PatientCaretakerNetwork).where(
        PatientCaretakerNetwork.id == connection_id,
        PatientCaretakerNetwork.patient_id == patient_profile.id
    )
    result = await db.execute(query)
    connection = result.scalar_one_or_none()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    connection.relationship_status = ConnectionStatus.REVOKED
    await db.commit()
    return None
