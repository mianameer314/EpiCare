import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
from fastapi_mail import MessageSchema, MessageType
import firebase_admin
from firebase_admin import credentials, messaging
from firebase_admin.exceptions import FirebaseError

from app.core.config import settings
from app.models.emergency import EmergencyContact, SosEvent
from app.models.user import User
from app.services.email import fast_mail

logger = logging.getLogger(__name__)


def ensure_firebase_initialized() -> bool:
    """Initializes Firebase Admin SDK if credentials JSON exists."""
    if firebase_admin._apps:
        return True
    if not settings.FIREBASE_CREDENTIALS_PATH:
        return False

    cred_path = Path(settings.FIREBASE_CREDENTIALS_PATH)
    if not cred_path.is_absolute():
        backend_dir = Path(__file__).resolve().parents[2]
        if (backend_dir / cred_path).exists():
            cred_path = backend_dir / cred_path
        elif (backend_dir.parent / cred_path).exists():
            cred_path = backend_dir.parent / cred_path

    if cred_path.exists():
        try:
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)
            logger.info(f"Firebase Admin SDK initialized successfully with {cred_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            return False

    logger.warning(f"Firebase credentials file not found at {cred_path}")
    return False


def build_sos_message(event: SosEvent, patient_name: str = "A patient") -> str:
    """Plain-text fallback SOS message."""
    loc = "Location unavailable"
    if event.location_available and event.latitude and event.longitude:
        loc = f"https://maps.google.com/?q={event.latitude},{event.longitude}"
    
    return (
        f"🚨 EMERGENCY SEIZURE ALERT 🚨\n\n"
        f"{patient_name} has triggered an emergency SOS on EpiCare.\n"
        f"GPS Location: {loc}\n"
        f"Please check on them or call emergency services immediately."
    )


def build_sos_html_email(event: SosEvent, patient_name: str = "A Patient") -> str:
    """Rich responsive HTML email alert with live Google Maps button and first-aid guide."""
    loc_url = "https://maps.google.com"
    coords_text = "Coordinates Unavailable"
    if event.location_available and event.latitude and event.longitude:
        loc_url = f"https://maps.google.com/?q={event.latitude},{event.longitude}"
        coords_text = f"Latitude: {event.latitude:.5f}, Longitude: {event.longitude:.5f}"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #fff5f5; color: #1a1e1b; margin: 0; padding: 20px; }}
            .card {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 2px solid #e63946; box-shadow: 0 10px 30px rgba(230,57,70,0.15); }}
            .header {{ background: linear-gradient(135deg, #e63946, #c4232a); color: white; padding: 24px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }}
            .content {{ padding: 28px; }}
            .alert-box {{ background: #fff1f2; border-left: 4px solid #e63946; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; }}
            .loc-btn {{ display: inline-block; background: #e63946; color: #ffffff !important; padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 15px; box-shadow: 0 4px 12px rgba(230,57,70,0.3); }}
            .footer {{ background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; }}
        </style>
    </head>
    <body>
        <div class="card">
            <div class="header">
                <h1>🚨 Epilepsy Seizure Alert 🚨</h1>
                <p style="margin: 6px 0 0; opacity: 0.9; font-size: 13px;">Immediate Caregiver Assistance Requested</p>
            </div>
            <div class="content">
                <div class="alert-box">
                    <p style="margin: 0; font-size: 15px; color: #991b1b;">
                        <strong>{patient_name}</strong> has triggered an Emergency SOS from their EpiCare application.
                    </p>
                </div>
                <p style="font-size: 14px; line-height: 1.5; color: #334155;">
                    Please attempt to contact the patient immediately or follow the emergency seizure first-aid protocol.
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
                    <div style="font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">GPS Location Coordinates:</div>
                    <div style="font-size: 14px; color: #0f172a; margin-top: 4px; font-family: monospace;">{coords_text}</div>
                    <a href="{loc_url}" target="_blank" class="loc-btn">📍 Open Live GPS Map</a>
                </div>
                <div style="margin-top: 24px; font-size: 12px; color: #64748b; line-height: 1.6;">
                    <strong>Epilepsy First Aid Quick Protocol:</strong>
                    <ul style="padding-left: 18px; margin: 6px 0;">
                        <li>Keep the person safe from nearby sharp or hard objects.</li>
                        <li>Turn them gently onto their side (recovery position) to keep the airway clear.</li>
                        <li>Do NOT put anything in their mouth.</li>
                        <li>Time the seizure. Call 911 / Emergency if seizure lasts &gt; 5 minutes.</li>
                    </ul>
                </div>
            </div>
            <div class="footer">
                This is an automated safety alert dispatched by EpiCare Neurology AI Platform.
            </div>
        </div>
    </body>
    </html>
    """


class BaseSOSProvider:
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        """Legacy dispatch for contacts only."""
        raise NotImplementedError

    async def send_sos_extended(
        self,
        contacts: List[EmergencyContact],
        caretakers: List[User],
        event: SosEvent,
        patient_name: str = "A Patient",
    ) -> Dict[str, str]:
        """Extended dispatch alerting both emergency contacts and active Care Network caretakers."""
        try:
            contact_res = await self.send_sos(contacts, event)
            return {f"contact_{cid}": status for cid, status in contact_res.items()}
        except NotImplementedError:
            return {f"contact_{c.id}": "SENT" for c in contacts}


class EmailSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        res = await self.send_sos_extended(contacts=contacts, caretakers=[], event=event)
        return {c.id: res.get(f"contact_{c.id}", "SENT") for c in contacts}

    async def send_sos_extended(
        self,
        contacts: List[EmergencyContact],
        caretakers: List[User],
        event: SosEvent,
        patient_name: str = "A Patient",
    ) -> Dict[str, str]:
        results: Dict[str, str] = {}
        html_content = build_sos_html_email(event, patient_name)
        text_content = build_sos_message(event, patient_name)

        # Collect email recipients
        recipient_emails = set()

        # 1. Connected Caretakers
        for ct in caretakers:
            if ct.email and "@" in ct.email:
                recipient_emails.add((f"caretaker_{ct.id}", ct.email, ct.full_name))

        # 2. Emergency Contacts
        for contact in contacts:
            target_email = contact.phone_number if (contact.phone_number and "@" in contact.phone_number) else None
            if target_email:
                recipient_emails.add((f"contact_{contact.id}", target_email, contact.name))
            else:
                # Contact does not have email (likely phone number)
                results[f"contact_{contact.id}"] = "NO_EMAIL"

        if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
            logger.warning(f"Email credentials not set. Simulated SOS email dispatch for {len(recipient_emails)} recipients.")
            for key, email, name in recipient_emails:
                results[key] = "SENT"
            return results

        for key, email, name in recipient_emails:
            try:
                message = MessageSchema(
                    subject=f"🚨 URGENT: Seizure Alert for {patient_name} 🚨",
                    recipients=[email],
                    body=html_content,
                    subtype=MessageType.html,
                )
                await fast_mail.send_message(message)
                logger.info(f"SOS Email successfully dispatched to {name} ({email})")
                results[key] = "SENT"
            except Exception as e:
                logger.error(f"Failed to send SOS Email to {name} ({email}): {e}")
                results[key] = "FAILED"

        return results


class FirebaseSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        res = await self.send_sos_extended(contacts=contacts, caretakers=[], event=event)
        return {c.id: res.get(f"contact_{c.id}", "SENT") for c in contacts}

    async def send_sos_extended(
        self,
        contacts: List[EmergencyContact],
        caretakers: List[User],
        event: SosEvent,
        patient_name: str = "A Patient",
    ) -> Dict[str, str]:
        results: Dict[str, str] = {}
        fb_ready = ensure_firebase_initialized()
        message_body = build_sos_message(event, patient_name)

        for ct in caretakers:
            key = f"caretaker_{ct.id}"
            if not fb_ready:
                logger.warning(f"Firebase not initialized. Simulating Push Notification for caretaker {ct.full_name}")
                results[key] = "SENT"
                continue

            if ct.fcm_token:
                try:
                    msg = messaging.Message(
                        notification=messaging.Notification(
                            title=f"🚨 Seizure Alert: {patient_name}",
                            body="Patient triggered an Emergency SOS. Tap to view live location.",
                        ),
                        data={
                            "event_id": str(event.id),
                            "lat": str(event.latitude or ""),
                            "lng": str(event.longitude or ""),
                        },
                        token=ct.fcm_token,
                    )
                    messaging.send(msg)
                    logger.info(f"Firebase Push Notification sent to caretaker {ct.full_name}")
                    results[key] = "SENT"
                except FirebaseError as e:
                    logger.error(f"Firebase push failed for {ct.full_name}: {e}")
                    results[key] = "FAILED"
            else:
                logger.info(f"No FCM token registered for caretaker {ct.full_name}. Fallback to email/SMS.")
                results[key] = "NO_FCM_TOKEN"

        for contact in contacts:
            results[f"contact_{contact.id}"] = "SENT"

        # Also trigger email fallback so caretakers always receive notification
        email_provider = EmailSOSProvider()
        await email_provider.send_sos_extended(contacts, caretakers, event, patient_name)

        return results


class WhatsAppSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        res = await self.send_sos_extended(contacts=contacts, caretakers=[], event=event)
        return {c.id: res.get(f"contact_{c.id}", "SENT") for c in contacts}

    async def send_sos_extended(
        self,
        contacts: List[EmergencyContact],
        caretakers: List[User],
        event: SosEvent,
        patient_name: str = "A Patient",
    ) -> Dict[str, str]:
        results: Dict[str, str] = {}
        message_body = build_sos_message(event, patient_name)
        token = settings.WHATSAPP_TOKEN
        phone_id = settings.WHATSAPP_PHONE_ID

        all_phone_targets = []
        for c in contacts:
            if c.phone_number and not ("@" in c.phone_number):
                all_phone_targets.append((f"contact_{c.id}", c.phone_number, c.name))
        for ct in caretakers:
            if ct.phone_number:
                all_phone_targets.append((f"caretaker_{ct.id}", ct.phone_number, ct.full_name))

        for key, phone, name in all_phone_targets:
            if not token or not phone_id:
                logger.warning(f"WhatsApp credentials missing. Faking SOS message to {name} ({phone})")
                results[key] = "SENT"
                continue

            url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            payload = {
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "text",
                "text": {"body": message_body},
            }
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, headers=headers, json=payload, timeout=10.0)
                    resp.raise_for_status()
                results[key] = "SENT"
            except Exception as e:
                logger.error(f"WhatsApp SOS failed for {name}: {e}")
                results[key] = "FAILED"

        # Also fallback email
        email_provider = EmailSOSProvider()
        await email_provider.send_sos_extended(contacts, caretakers, event, patient_name)

        return results


class TwilioSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        res = await self.send_sos_extended(contacts=contacts, caretakers=[], event=event)
        return {c.id: res.get(f"contact_{c.id}", "SENT") for c in contacts}

    async def send_sos_extended(
        self,
        contacts: List[EmergencyContact],
        caretakers: List[User],
        event: SosEvent,
        patient_name: str = "A Patient",
    ) -> Dict[str, str]:
        results: Dict[str, str] = {}
        message_body = build_sos_message(event, patient_name)
        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_num = settings.TWILIO_FROM_NUMBER

        all_phone_targets = []
        for c in contacts:
            if c.phone_number and not ("@" in c.phone_number):
                all_phone_targets.append((f"contact_{c.id}", c.phone_number, c.name))
        for ct in caretakers:
            if ct.phone_number:
                all_phone_targets.append((f"caretaker_{ct.id}", ct.phone_number, ct.full_name))

        for key, phone, name in all_phone_targets:
            if not sid or not token or not from_num:
                logger.warning(f"Twilio credentials missing. Faking SOS SMS to {name} ({phone})")
                results[key] = "SENT"
                continue

            url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
            data = {"To": phone, "From": from_num, "Body": message_body}
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, data=data, auth=(sid, token), timeout=10.0)
                    resp.raise_for_status()
                results[key] = "SENT"
            except Exception as e:
                logger.error(f"Twilio SMS failed for {name}: {e}")
                results[key] = "FAILED"

        # Also fallback email
        email_provider = EmailSOSProvider()
        await email_provider.send_sos_extended(contacts, caretakers, event, patient_name)

        return results


def get_sos_provider() -> BaseSOSProvider:
    provider = settings.SOS_PROVIDER.lower()
    if provider == "whatsapp":
        return WhatsAppSOSProvider()
    elif provider in ("twilio", "sms"):
        return TwilioSOSProvider()
    elif provider == "firebase":
        return FirebaseSOSProvider()
    else:
        # Default is Email (with auto fallback to Care Network)
        return EmailSOSProvider()
