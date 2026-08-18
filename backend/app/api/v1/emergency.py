import logging
from datetime import date, datetime, time, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

logger = logging.getLogger(__name__)

from app.api.deps import DbDep, TargetPatientIdForRead, TargetPatientIdForWrite
from app.db.session import SessionLocal
from app.models.enums import UserRole, ConnectionStatus
from app.models.user import User
from app.models.patient_profile import PatientProfile
from app.models.caretaker_profile import CaretakerProfile
from app.models.networks import PatientCaretakerNetwork
from app.models.emergency import EmergencyContact, SosEvent, SosDelivery
from app.schemas.emergency import (
    EmergencyContactCreate,
    EmergencyContactUpdate,
    EmergencyContactOut,
    SosTriggerRequest,
    SosEventCreateResponse,
)
from app.services.sos_provider import get_sos_provider

router = APIRouter(prefix="/emergency")

# Only patients can manage contacts and trigger SOS


@router.get(
    "/contacts",
    tags=['🤒 Patient - Emergency SOS', '🤝 Caretaker - Proxy Actions'],
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
    tags=['🤒 Patient - Emergency SOS', '🤝 Caretaker - Proxy Actions'],
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
    tags=['🤒 Patient - Emergency SOS', '🤝 Caretaker - Proxy Actions'],
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
    tags=['🤒 Patient - Emergency SOS', '🤝 Caretaker - Proxy Actions'],
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


async def process_sos_in_background(event_id: int, user_id: int):
    """Background task to dispatch SOS via all configured channels to contacts and Care Network."""
    try:
        async with SessionLocal() as db:
            # 1. Fetch the event
            result = await db.execute(select(SosEvent).where(SosEvent.id == event_id))
            event = result.scalar_one_or_none()
            if not event:
                logger.error(f"[SOS] Event {event_id} not found")
                return

            # 2. Fetch patient user & name
            patient_user = await db.get(User, user_id)
            patient_name = patient_user.full_name if patient_user else "Patient"

            # 3. Fetch registered Emergency Contacts
            contacts_result = await db.execute(
                select(EmergencyContact).where(EmergencyContact.user_id == user_id)
            )
            contacts = list(contacts_result.scalars().all())

            # 4. Fetch active connected Caretakers from Care Network
            caretakers = []
            patient_prof_res = await db.execute(
                select(PatientProfile).where(PatientProfile.user_id == user_id)
            )
            patient_prof = patient_prof_res.scalar_one_or_none()

            if patient_prof:
                ct_query = await db.execute(
                    select(User)
                    .join(CaretakerProfile, CaretakerProfile.user_id == User.id)
                    .join(PatientCaretakerNetwork, PatientCaretakerNetwork.caretaker_id == CaretakerProfile.id)
                    .where(
                        PatientCaretakerNetwork.patient_id == patient_prof.id,
                        PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
                    )
                )
                caretakers = list(ct_query.scalars().all())

            logger.info(f"[SOS] Event {event_id}: Found {len(caretakers)} caretakers, {len(contacts)} contacts for {patient_name}")
            for ct in caretakers:
                logger.info(f"[SOS] Caretaker: {ct.full_name} (id={ct.id}, fcm_token={'YES' if ct.fcm_token else 'NO'})")

            # 5. Dispatch alerts via SOS Provider
            provider = get_sos_provider()
            logger.info(f"[SOS] Using provider: {type(provider).__name}")
            if hasattr(provider, "send_sos_extended"):
                delivery_results = await provider.send_sos_extended(
                    contacts=contacts,
                    caretakers=caretakers,
                    event=event,
                    patient_name=patient_name
                )
            else:
                contact_res = await provider.send_sos(contacts, event)
                delivery_results = {f"contact_{cid}": status for cid, status in contact_res.items()}

            logger.info(f"[SOS] Event {event_id} delivery results: {delivery_results}")

            # Direct push notification fallback — ensure every caretaker with an FCM token gets a push
            from app.services.sos_provider import ensure_firebase_initialized
            from firebase_admin import messaging as fb_messaging
            from firebase_admin.exceptions import FirebaseError

            if ensure_firebase_initialized():
                for ct in caretakers:
                    if ct.fcm_token and delivery_results.get(f"caretaker_{ct.id}") != "SENT":
                        try:
                            msg = fb_messaging.Message(
                                data={
                                    "event_id": str(event.id),
                                    "lat": str(event.latitude or ""),
                                    "lng": str(event.longitude or ""),
                                    "title": f"🚨 Seizure Alert: {patient_name}",
                                    "body": "Patient triggered an Emergency SOS. Tap to view live location.",
                                },
                                android=fb_messaging.AndroidConfig(
                                    priority="high",
                                    notification=fb_messaging.AndroidNotification(
                                        title=f"🚨 Seizure Alert: {patient_name}",
                                        body="Patient triggered an Emergency SOS. Tap to view live location.",
                                        icon="icon-192",
                                        color="#e63946",
                                        sound="default",
                                        channel_id="epicare-emergency",
                                    ),
                                ),
                                webpush=fb_messaging.WebpushConfig(
                                    notification=fb_messaging.WebpushNotification(
                                        title=f"🚨 Seizure Alert: {patient_name}",
                                        body="Patient triggered an Emergency SOS. Tap to view live location.",
                                        icon="/icon-192.png",
                                        badge="/favicon.svg",
                                        vibrate=[300, 100, 300, 100, 500],
                                        require_interaction=True,
                                    ),
                                ),
                                token=ct.fcm_token,
                            )
                            resp = fb_messaging.send(msg)
                            logger.info(f"[SOS] Direct push to {ct.full_name}: {resp}")
                            delivery_results[f"caretaker_{ct.id}"] = "SENT"
                        except FirebaseError as e:
                            logger.error(f"[SOS] Direct push failed for {ct.full_name}: {e}")
                            delivery_results[f"caretaker_{ct.id}"] = "FAILED"

            # 6. Log deliveries for contacts
            for contact in contacts:
                status_str = delivery_results.get(f"contact_{contact.id}", "SENT")
                delivery = SosDelivery(
                    sos_event_id=event.id,
                    contact_id=contact.id,
                    delivery_status=status_str,
                )
                db.add(delivery)

            event.status = "COMPLETED"
            await db.commit()
            logger.info(f"[SOS] Event {event_id} completed successfully")

    except Exception as e:
        logger.error(f"[SOS] Background task FAILED for event {event_id}: {e}", exc_info=True)
        # Try to mark the event as FAILED so it doesn't stay stuck at SENDING
        try:
            async with SessionLocal() as db2:
                evt = await db2.get(SosEvent, event_id)
                if evt:
                    evt.status = "FAILED"
                    await db2.commit()
        except Exception:
            pass


from datetime import date, datetime, time
from app.api.pagination import PaginationParams, get_pagination_params, get_total_count, apply_pagination, create_paginated_response
from app.schemas.common import PaginatedResponse
from app.schemas.emergency import SosEventOut

from sqlalchemy.orm import selectinload

@router.get(
    "/sos",
    tags=['🤒 Patient - Emergency SOS', '🤝 Caretaker - Proxy Actions'],
    response_model=PaginatedResponse[SosEventOut],
    summary="List SOS Events",
    description="Retrieves a paginated history of all triggered SOS events for the patient.",
    response_description="A paginated list of SOS events."
)
async def get_sos_events(
    db: DbDep, 
    target_user_id: TargetPatientIdForRead,
    params: PaginationParams = Depends(get_pagination_params),
    start_date: date | None = None,
    end_date: date | None = None,
    status: str | None = None
):
    query = select(SosEvent).options(selectinload(SosEvent.deliveries)).where(SosEvent.user_id == target_user_id)
    
    if start_date:
        query = query.where(SosEvent.triggered_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(SosEvent.triggered_at <= datetime.combine(end_date, time.max))
    if status:
        query = query.where(SosEvent.status == status)
        
    if params.sort_by and hasattr(SosEvent, params.sort_by):
        column = getattr(SosEvent, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(SosEvent.triggered_at.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


@router.get(
    "/fcm-diagnostic",
    tags=['🤒 Patient - Emergency SOS'],
    summary="FCM Push Notification Diagnostic",
    description="Shows FCM token status for the current user and their connected caretakers. Use this to verify push notifications are configured correctly.",
)
async def fcm_diagnostic(
    db: DbDep,
    target_user_id: TargetPatientIdForRead,
):
    from app.core.config import settings
    from app.services.sos_provider import ensure_firebase_initialized
    from sqlalchemy.orm import selectinload

    patient_user = await db.get(User, target_user_id)
    fb_ready = ensure_firebase_initialized()

    # Check connected caretakers' FCM status
    caretaker_info = []
    patient_prof_res = await db.execute(
        select(PatientProfile).where(PatientProfile.user_id == target_user_id)
    )
    patient_prof = patient_prof_res.scalar_one_or_none()
    if patient_prof:
        ct_query = await db.execute(
            select(User)
            .join(CaretakerProfile, CaretakerProfile.user_id == User.id)
            .join(PatientCaretakerNetwork, PatientCaretakerNetwork.caretaker_id == CaretakerProfile.id)
            .where(
                PatientCaretakerNetwork.patient_id == patient_prof.id,
                PatientCaretakerNetwork.relationship_status == ConnectionStatus.ACTIVE
            )
        )
        for ct in ct_query.scalars().all():
            caretaker_info.append({
                "name": ct.full_name,
                "email": ct.email,
                "has_fcm_token": bool(ct.fcm_token),
                "fcm_token_preview": (ct.fcm_token[:20] + "...") if ct.fcm_token else None,
            })

    return {
        "firebase_admin_initialized": fb_ready,
        "sos_provider": settings.SOS_PROVIDER,
        "firebase_credentials_path": settings.FIREBASE_CREDENTIALS_PATH or "NOT SET",
        "patient": {
            "name": patient_user.full_name if patient_user else None,
            "has_fcm_token": bool(patient_user.fcm_token) if patient_user else False,
        },
        "connected_caretakers": caretaker_info,
        "diagnosis": (
            "OK — Firebase is configured and SOS_PROVIDER is set to firebase."
            if fb_ready and settings.SOS_PROVIDER.lower() == "firebase"
            else f"ISSUE — firebase_initialized={fb_ready}, SOS_PROVIDER={settings.SOS_PROVIDER}. "
            + ("Check FIREBASE_CREDENTIALS_PATH in .env" if not fb_ready else "Change SOS_PROVIDER to 'firebase' in .env")
        ),
    }


@router.post(
    "/sos/trigger",
    tags=['🤒 Patient - Emergency SOS', '🤝 Caretaker - Proxy Actions'],
    response_model=SosEventCreateResponse,
    summary="Trigger Emergency SOS",
    description=(
        "Triggers an immediate Emergency SOS alert. This logs the event along with "
        "the patient's current GPS coordinates (if available) and instantly dispatches "
        "asynchronous background tasks to notify all registered emergency contacts and "
        "connected Care Network caregivers via email, SMS, WhatsApp, and Firebase."
    ),
    response_description="An object acknowledging the trigger with the SOS event ID."
)
async def trigger_sos(
    request: SosTriggerRequest,
    background_tasks: BackgroundTasks,
    db: DbDep,
    target_user_id: TargetPatientIdForWrite,
    x_idempotency_key: str | None = Header(None, alias="X-Idempotency-Key"),
):
    now = datetime.now(timezone.utc)
    cooldown_cutoff = now - timedelta(seconds=15)
    idem_key = request.idempotency_key or x_idempotency_key

    # 1. Idempotency Key check: if an event was created with this key, return it idempotently
    if idem_key:
        idem_query = await db.execute(
            select(SosEvent).where(
                SosEvent.user_id == target_user_id,
                SosEvent.payload["idempotency_key"].astext == idem_key,
            )
        )
        existing_idem = idem_query.scalar_one_or_none()
        if existing_idem:
            return SosEventCreateResponse(
                event_id=existing_idem.id,
                status=existing_idem.status,
                message="SOS alert already active and being dispatched (idempotent duplicate prevented).",
            )

    # 2. Accidental double-click debounce check (within 15-second window)
    recent_query = await db.execute(
        select(SosEvent)
        .where(
            SosEvent.user_id == target_user_id,
            SosEvent.triggered_at >= cooldown_cutoff,
        )
        .order_by(SosEvent.triggered_at.desc())
        .limit(1)
    )
    recent_event = recent_query.scalar_one_or_none()
    if recent_event:
        return SosEventCreateResponse(
            event_id=recent_event.id,
            status=recent_event.status,
            message="Active SOS alert already in progress (double-click prevented).",
        )

    # 3. Create new SOS Event with idempotency metadata
    payload_data = {}
    if idem_key:
        payload_data["idempotency_key"] = idem_key

    event = SosEvent(
        user_id=target_user_id,
        latitude=request.latitude,
        longitude=request.longitude,
        location_available=bool(request.latitude is not None and request.longitude is not None),
        status="SENDING",
        payload=payload_data if payload_data else None,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Dispatch to background with independent session
    background_tasks.add_task(process_sos_in_background, event.id, target_user_id)

    return SosEventCreateResponse(
        event_id=event.id,
        status=event.status,
        message="SOS alert triggered and is being dispatched.",
    )
