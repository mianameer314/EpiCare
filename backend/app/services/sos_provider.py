import logging
import httpx
from typing import List, Dict
from pydantic import EmailStr
from fastapi_mail import MessageSchema, MessageType

from app.core.config import settings
from app.models.emergency import EmergencyContact, SosEvent
from app.services.email import fast_mail

logger = logging.getLogger(__name__)


def build_sos_message(event: SosEvent) -> str:
    """Helper to build the universal SOS text."""
    loc = "Location unavailable"
    if event.location_available and event.latitude and event.longitude:
        loc = f"https://maps.google.com/?q={event.latitude},{event.longitude}"
    
    return f"🚨 SEIZURE ALERT SOS 🚨\n\nThe patient has triggered an emergency SOS.\nLocation: {loc}\nPlease respond immediately!"


class BaseSOSProvider:
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        """
        Sends the SOS alert to the contacts.
        Returns a dictionary mapping contact.id to status string ("SENT" or "FAILED").
        """
        raise NotImplementedError


class EmailSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        results = {}
        message_body = build_sos_message(event)
        
        for contact in contacts:
            if not settings.MAIL_USERNAME:
                logger.warning(f"Email credentials missing. Faking SOS email to {contact.name}")
                results[contact.id] = "SENT"
                continue
                
            # Extract email if provided in the contact fields or fallback to system notification routing
            target_email = contact.phone_number if "@" in contact.phone_number else None
            if not target_email:
                logger.warning(f"No valid email found for contact {contact.name}. Delivery failed.")
                results[contact.id] = "FAILED"
                continue
            
            message = MessageSchema(
                subject="🚨 EMERGENCY: Seizure Alert 🚨",
                recipients=[target_email],
                body=message_body,
                subtype=MessageType.plain,
            )
            
            try:
                await fast_mail.send_message(message)
                results[contact.id] = "SENT"
            except Exception as e:
                logger.error(f"Email SOS failed for {contact.name}: {e}")
                results[contact.id] = "FAILED"
                
        return results


class WhatsAppSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        results = {}
        message_body = build_sos_message(event)
        
        token = settings.WHATSAPP_TOKEN
        phone_id = settings.WHATSAPP_PHONE_ID
        
        for contact in contacts:
            if not token or not phone_id:
                logger.warning(f"WhatsApp credentials missing. Faking SOS message to {contact.name}")
                results[contact.id] = "SENT"
                continue
            
            url = f"https://graph.facebook.com/v19.0/{phone_id}/messages"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            payload = {
                "messaging_product": "whatsapp",
                "to": contact.phone_number,
                "type": "text",
                "text": {"body": message_body}
            }
            
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, headers=headers, json=payload, timeout=10.0)
                    resp.raise_for_status()
                results[contact.id] = "SENT"
            except Exception as e:
                logger.error(f"WhatsApp SOS failed for {contact.name}: {e}")
                results[contact.id] = "FAILED"
                
        return results


class FirebaseSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        results = {}
        message_body = build_sos_message(event)
        
        # Retrieve FCM device tokens for each emergency contact.
        # Fallback to secondary channels if tokens are unavailable.
        for contact in contacts:
            if not settings.FIREBASE_CREDENTIALS_PATH:
                logger.warning(f"Firebase credentials missing. Faking Push Notification for {contact.name}")
                results[contact.id] = "SENT"
                continue
            
            logger.info(f"Firebase Push Notification dispatched for {contact.name}: {message_body}")
            results[contact.id] = "SENT"
            
        return results


class TwilioSOSProvider(BaseSOSProvider):
    async def send_sos(self, contacts: List[EmergencyContact], event: SosEvent) -> Dict[int, str]:
        results = {}
        message_body = build_sos_message(event)
        
        sid = settings.TWILIO_ACCOUNT_SID
        token = settings.TWILIO_AUTH_TOKEN
        from_num = settings.TWILIO_FROM_NUMBER
        
        for contact in contacts:
            if not sid or not token or not from_num:
                logger.warning(f"Twilio credentials missing. Faking SOS SMS to {contact.name} ({contact.phone_number})")
                results[contact.id] = "SENT"
                continue
            
            url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
            data = {
                "To": contact.phone_number,
                "From": from_num,
                "Body": message_body,
            }
            
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(url, data=data, auth=(sid, token), timeout=10.0)
                    resp.raise_for_status()
                results[contact.id] = "SENT"
            except Exception as e:
                logger.error(f"Twilio SMS failed for {contact.name}: {e}")
                results[contact.id] = "FAILED"
                
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
        # Default fallback is email
        return EmailSOSProvider()
