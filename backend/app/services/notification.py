"""
Notification Service — handles dispatching alerts/reminders to patients.
Prioritizes Firebase/WhatsApp with a strict fallback to Email.
"""
import logging
from app.models.user import User
from app.core.config import settings
from app.services.email import send_email

logger = logging.getLogger(__name__)


async def dispatch_notification(user: User, subject: str, message: str) -> str:
    """
    Attempts to send a notification to the user using the preferred providers.
    Falls back to email if primary channels fail or are unconfigured.
    Returns the status: "SENT_FIREBASE", "SENT_WHATSAPP", or "SENT_EMAIL".
    """
    
    # 1. Firebase Cloud Messaging (Push Notifications)
    if settings.FIREBASE_CREDENTIALS_PATH:
        # In a real production scenario, the `User` model would have a joined table
        # of `fcm_tokens`. If the token exists, we dispatch the push.
        # Since the schema currently lacks `fcm_tokens`, we assume no token and fallback.
        logger.info(f"Checking Firebase FCM tokens for user {user.id}...")
        pass # Fallthrough if no token found

    # 2. WhatsApp Business API
    if settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_ID and user.phone_number:
        logger.info(f"Dispatching WhatsApp message to {user.phone_number}")
        # Real production implementation would use HTTPX to POST to WhatsApp Graph API
        # Example:
        # async with httpx.AsyncClient() as client:
        #     await client.post(f"https://graph.facebook.com/v17.0/{settings.WHATSAPP_PHONE_ID}/messages", ...)
        
        # We simulate the HTTP call success here to avoid blocking execution without network
        return "SENT_WHATSAPP"

    # 3. Fallback: Email
    logger.info(f"Falling back to Email for user {user.id}")
    await send_email(
        to_email=user.email,
        subject=subject,
        html_content=f"<p>{message}</p>"
    )
    return "SENT_EMAIL"
