from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.api.deps import DbDep, TargetPatientIdForRead, TargetPatientIdForWrite
from app.models.enums import UserRole
from app.models.user import User
from app.models.emergency import EmergencyContact, SosEvent, SosDelivery
from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactUpdate,
    EmergencyContactOut,
    SosTriggerRequest,
    SosEventCreateResponse,
)
from app.services.sos_provider import get_sos_provider

router = APIRouter(prefix="/emergency", tags=["Emergency SOS"])

# Only patients can manage contacts and trigger SOS


@router.get(
    "/contacts",
    response_model=List[EmergencyContactOut],
    summary="List Emergency Contacts",
    description="Retrieves the list of configured emergency contacts for the authenticated patient.",
    response_description="A list of emergency contact objects."
)
async def get_emergency_contacts(
    db: DbDep, target_user_id: TargetPatientIdForRead
):
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == target_user_id)
    )
    return result.scalars().all()


@router.post(
    "/contacts",
    response_model=EmergencyContactOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add Emergency Contact",
    description="Adds a new emergency contact for the authenticated patient. A maximum of 3 emergency contacts are permitted per patient.",
    response_description="The newly created emergency contact object."
)
async def add_emergency_contact(
    contact_in: EmergencyContactCreate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    # Check current count
    result = await db.execute(
        select(EmergencyContact).where(EmergencyContact.user_id == target_user_id)
    )
    current_contacts = result.scalars().all()
    if len(current_contacts) >= 3:
        raise HTTPException(
            status_code=400, detail="Maximum of 3 emergency contacts allowed."
        )

    # Add contact
    new_contact = EmergencyContact(
        user_id=target_user_id,
        name=contact_in.name,
        relationship=contact_in.relationship,
        phone_number=contact_in.phone_number,
        is_primary=contact_in.is_primary,
    )
    db.add(new_contact)
    await db.commit()
    await db.refresh(new_contact)
    return new_contact


@router.put(
    "/contacts/{contact_id}",
    response_model=EmergencyContactOut,
    summary="Update Emergency Contact",
    description="Updates an existing emergency contact's details (e.g., phone number or name).",
)
async def update_emergency_contact(
    contact_id: int,
    contact_in: EmergencyContactUpdate,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    result = await db.execute(
        select(EmergencyContact).where(
            EmergencyContact.id == contact_id,
            EmergencyContact.user_id == target_user_id
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    update_data = contact_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)

    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete(
    "/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Emergency Contact",
    description="Removes an emergency contact from the patient's list.",
)
async def delete_emergency_contact(
    contact_id: int,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    result = await db.execute(
        select(EmergencyContact).where(
            EmergencyContact.id == contact_id,
            EmergencyContact.user_id == target_user_id
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    await db.delete(contact)
    await db.commit()
    return None


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


@router.post(
    "/sos/trigger",
    response_model=SosEventCreateResponse,
    summary="Trigger Emergency SOS",
    description=(
        "Triggers an immediate Emergency SOS alert. This logs the event along with "
        "the patient's current GPS coordinates (if available) and instantly dispatches "
        "asynchronous background tasks to notify all registered emergency contacts via "
        "the configured provider (e.g., WhatsApp, Email)."
    ),
    response_description="An object acknowledging the trigger with the SOS event ID."
)
async def trigger_sos(
    request: SosTriggerRequest,
    background_tasks: BackgroundTasks,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
):
    event = SosEvent(
        user_id=target_user_id,
        latitude=request.latitude,
        longitude=request.longitude,
        location_available=request.location_available,
        status="SENDING",
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Dispatch to background
    background_tasks.add_task(process_sos_in_background, db, event.id, target_user_id)

    return SosEventCreateResponse(
        event_id=event.id,
        status=event.status,
        message="SOS alert triggered and is being dispatched.",
    )
