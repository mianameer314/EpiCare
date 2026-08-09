from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel

from app.api.deps import DbDep, CurrentUser, RoleChecker, get_verified_doctor, VerifiedDoctor
from app.models.enums import UserRole, ConnectionStatus
from app.models.user import User
from app.models.doctor_profile import DoctorProfile
from app.models.patient_profile import PatientProfile
from app.models.networks import PatientDoctorNetwork

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
    doctor_id: int
    relationship_status: ConnectionStatus


@router.get("/doctors/search", response_model=List[DoctorSearchResponse])
async def search_doctors(pmdc_number: str, db: DbDep, current_user: User = Depends(RoleChecker([UserRole.PATIENT]))):
    """Search for a verified doctor by their PMDC number."""
    query = (
        select(DoctorProfile)
        .options(selectinload(DoctorProfile.user))
        .where(DoctorProfile.pmdc_number == pmdc_number, DoctorProfile.is_pmdc_verified == True)
    )
    result = await db.execute(query)
    doctor_profile = result.scalar_one_or_none()
    
    if not doctor_profile:
        return []
        
    return [
        DoctorSearchResponse(
            doctor_id=doctor_profile.id,
            full_name=doctor_profile.user.full_name,
            pmdc_number=doctor_profile.pmdc_number,
            specialty=doctor_profile.specialty,
            hospital_affiliation=doctor_profile.hospital_affiliation
        )
    ]


@router.post("/doctors/request", response_model=ConnectionResponse)
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


@router.post("/doctors/approve/{connection_id}", response_model=ConnectionResponse)
async def approve_connection(
    connection_id: int, 
    db: DbDep, 
    current_user: User = Depends(VerifiedDoctor)
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
