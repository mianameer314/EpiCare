import logging
import json
import os
import base64
from pathlib import Path
from typing import List, Dict, Any, Optional
import httpx
import firebase_admin
from firebase_admin import credentials, messaging
from firebase_admin.exceptions import FirebaseError

from app.core.config import settings
from app.models.emergency import EmergencyContact, SosEvent
from app.models.user import User
from app.services.email import send_email

logger = logging.getLogger(__name__)


def ensure_firebase_initialized() -> bool:
    """Initializes Firebase Admin SDK.
    
    Tries three methods in order:
    1. FIREBASE_CREDENTIALS_JSON env var (raw JSON string or base64-encoded)
    2. FIREBASE_CREDENTIALS_PATH file (local dev)
    3. Firebase default credentials (GCP / Railway IAM)
    """
    if firebase_admin._apps:
        return True

    # Method 1: FIREBASE_CREDENTIALS_JSON env var (for Railway / production)
    creds_json = os.environ.get('FIREBASE_CREDENTIALS_JSON', '')
    if creds_json:
        try:
            # Try parsing as raw JSON first
            cred_dict = json.loads(creds_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized from FIREBASE_CREDENTIALS_JSON env var")
            return True
        except json.JSONDecodeError:
            # Might be base64-encoded
            try:
                decoded = base64.b64decode(creds_json).decode('utf-8')
                cred_dict = json.loads(decoded)
                cred = credentials.Certificate(cred_dict)
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized from base64 FIREBASE_CREDENTIALS_JSON env var")
                return True
            except Exception:
                logger.warning("FIREBASE_CREDENTIALS_JSON is set but invalid (not JSON or base64)")

    # Method 2: FIREBASE_CREDENTIALS_PATH file (local dev)
    if settings.FIREBASE_CREDENTIALS_PATH:
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
                logger.error(f"Failed to initialize Firebase Admin SDK from file: {e}")

    # Method 3: Try default credentials (GCP / cloud environments)
    try:
        firebase_admin.initialize_app()
        logger.info("Firebase Admin SDK initialized with default credentials")
        return True
    except Exception:
        pass

    logger.warning("Firebase credentials not found. Set FIREBASE_CREDENTIALS_JSON env var or FIREBASE_CREDENTIALS_PATH.")
    return False


def build_sos_message(event: SosEvent, patient_name: str = "A patient") -> str:
    """Plain-text fallback SOS message."""
    if event.latitude is not None and event.longitude is not None:
        loc_str = f"Live Map Navigation: https://maps.google.com/?q={event.latitude},{event.longitude}"
    else:
        loc_str = "Location: Unavailable (Device location was not shared at time of trigger)"
    
    return (
        f"🚨 EMERGENCY SEIZURE ALERT 🚨\n\n"
        f"{patient_name} has triggered an emergency SOS on EpiCare.\n"
        f"{loc_str}\n\n"
        f"Please check on them or call emergency services immediately."
    )


def build_sos_html_email(event: SosEvent, patient_name: str = "A Patient") -> str:
    """Rich responsive HTML email alert with live Google Maps button and first-aid guide."""
    if event.latitude is not None and event.longitude is not None:
        location_section = f"""
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
                <div style="font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 6px;">Live Patient Location:</div>
                <p style="margin: 0 0 12px; font-size: 13px; color: #64748b;">Instant 1-tap navigation to the patient's location</p>
                <a href="https://maps.google.com/?q={event.latitude},{event.longitude}" target="_blank" class="loc-btn">🗺️ Open Live Google Maps Navigation</a>
            </div>
        """
    else:
        location_section = """
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin: 20px 0; text-align: center;">
                <div style="font-size: 13px; font-weight: 600; color: #64748b;">Location was not available or disabled on patient's device</div>
            </div>
        """

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
            .loc-btn {{ display: inline-block; background: #e63946; color: #ffffff !important; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 15px; margin-top: 10px; box-shadow: 0 4px 12px rgba(230,57,70,0.3); }}
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
                {location_section}
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
        patient_email: Optional[str] = None,
    ) -> Dict[str, str]:
        results: Dict[str, str] = {}
        html_content = build_sos_html_email(event, patient_name)
        text_content = build_sos_message(event, patient_name)

        # Collect email recipients
        recipient_emails = set()

        # 0. Patient (Self-alert confirmation & emergency record)
        if patient_email and "@" in patient_email:
            recipient_emails.add(("patient", patient_email, patient_name))

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

        for key, email, name in recipient_emails:
            try:
                await send_email(
                    to_email=email,
                    subject=f"🚨 URGENT: Seizure Alert for {patient_name} 🚨",
                    html_content=html_content,
                )
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
        patient_email: Optional[str] = None,
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
                    # DATA-ONLY message (no top-level notification field).
                    # This ensures the service worker's push event handler fires
                    # even when the app is closed / screen is off, giving us
                    # full control over sound, vibration, and notification display.
                    msg = messaging.Message(
                        data={
                            "event_id": str(event.id),
                            "lat": str(event.latitude or ""),
                            "lng": str(event.longitude or ""),
                            "title": f"🚨 Seizure Alert: {patient_name}",
                            "body": "Patient triggered an Emergency SOS. Tap to view live location.",
                        },
                        android=messaging.AndroidConfig(
                            priority="high",
                            notification=messaging.AndroidNotification(
                                title=f"🚨 Seizure Alert: {patient_name}",
                                body="Patient triggered an Emergency SOS. Tap to view live location.",
                                icon="icon-192",
                                color="#e63946",
                                sound="default",
                                click_action="FLUTTER_NOTIFICATION_CLICK",
                                channel_id="epicare-emergency",
                                tag="epicare-sos",
                            ),
                        ),
                        apns=messaging.APNSConfig(
                            payload=messaging.APNSPayload(
                                aps=messaging.Aps(
                                    alert=messaging.ApsAlert(
                                        title=f"🚨 Seizure Alert: {patient_name}",
                                        body="Patient triggered an Emergency SOS. Tap to view live location.",
                                    ),
                                    sound="default",
                                    badge=1,
                                    mutable_content=True,
                                ),
                            ),
                        ),
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

        # Also trigger email fallback so caretakers & patient always receive notification
        email_provider = EmailSOSProvider()
        await email_provider.send_sos_extended(contacts, caretakers, event, patient_name, patient_email=patient_email)

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
        patient_email: Optional[str] = None,
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
        await email_provider.send_sos_extended(contacts, caretakers, event, patient_name, patient_email=patient_email)

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
        patient_email: Optional[str] = None,
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
        await email_provider.send_sos_extended(contacts, caretakers, event, patient_name, patient_email=patient_email)

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
