from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.api.deps import DbDep, CurrentUser, RoleChecker
from app.models.enums import UserRole
from app.models.user import User
from app.models.emergency import EmergencyContact, SosEvent, SosDelivery
from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactOut,
    SosTriggerRequest,
    SosEventCreateResponse,
)
from app.services.sos_provider import get_sos_provider

router = APIRouter(prefix="/emergency", tags=["Emergency SOS"])

# Only patients can manage contacts and trigger SOS
PatientUser = Depends(RoleChecker([UserRole.PATIENT]))


@router.get("/contacts", response_model=List[EmergencyContactOut])
async def get_emergency_contacts(
    db: DbDep, current_user: User = PatientUser
):
    """Get all emergency contacts for the current patient."""
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == current_user.id)
    )
    return result.scalars().all()


@router.post("/contacts", response_model=EmergencyContactOut, status_code=status.HTTP_201_CREATED)
async def add_emergency_contact(
    contact_in: EmergencyContactCreate,
    db: DbDep,
    current_user: User = PatientUser,
):
    """Add a new emergency contact (Maximum 3)."""
    # Check current count
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == current_user.id)
    )
    current_contacts = result.scalars().all()
    if len(current_contacts) >= 3:
        raise HTTPException(
            status_code=400, detail="Maximum of 3 emergency contacts allowed."
        )

    # Add contact
    new_contact = EmergencyContact(
        user_id=current_user.id,
        name=contact_in.name,
        relationship=contact_in.relationship,
        phone_number=contact_in.phone_number,
        is_primary=contact_in.is_primary,
    )
    db.add(new_contact)
    await db.commit()
    await db.refresh(new_contact)
    return new_contact


async def process_sos_in_background(db: AsyncSession, event_id: int, user_id: int):
    """Background task to dispatch SOS via the configured provider."""
    # Fetch the event
    result = await db.execute(select(SosEvent).where(SosEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        return

    # Fetch contacts
    contacts_result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == user_id)
    )
    contacts = contacts_result.scalars().all()
    if not contacts:
        event.status = "FAILED"
        await db.commit()
        return

    # Send SOS
    provider = get_sos_provider()
    delivery_results = await provider.send_sos(contacts, event)

    # Log deliveries
    for contact in contacts:
        status_str = delivery_results.get(contact.id, "FAILED")
        delivery = SosDelivery(
            sos_event_id=event.id,
            contact_id=contact.id,
            delivery_status=status_str,
        )
        db.add(delivery)

    event.status = "COMPLETED"
    await db.commit()


@router.post("/sos/trigger", response_model=SosEventCreateResponse)
async def trigger_sos(
    request: SosTriggerRequest,
    background_tasks: BackgroundTasks,
    db: DbDep,
    current_user: User = PatientUser,
):
    """
    Trigger an Emergency SOS.
    Logs the event with GPS coordinates and dispatches alerts in the background.
    """
    event = SosEvent(
        user_id=current_user.id,
        latitude=request.latitude,
        longitude=request.longitude,
        location_available=request.location_available,
        status="SENDING",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Dispatch to background
    background_tasks.add_task(process_sos_in_background, db, event.id, current_user.id)

    return SosEventCreateResponse(
        event_id=event.id,
        status=event.status,
        message="SOS alert triggered and is being dispatched.",
    )
