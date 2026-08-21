"""
Notification Service — handles dispatching alerts/reminders to patients.
Prioritizes Firebase/WhatsApp with a strict fallback to Email.
"""
import logging
import httpx
from firebase_admin import messaging
from firebase_admin.exceptions import FirebaseError
from app.models.user import User
from app.core.config import settings
from app.services.email import send_email
from app.services.sos_provider import ensure_firebase_initialized

logger = logging.getLogger(__name__)


async def dispatch_notification(user: User, subject: str, message: str) -> str:
    """
    Attempts to send a notification to the user using the preferred providers.
    Falls back to email if primary channels fail or are unconfigured.
    Returns the status: "SENT_FIREBASE", "SENT_WHATSAPP", or "SENT_EMAIL".
    """
    
    # 1. Firebase Cloud Messaging (Push Notifications)
    if user.fcm_token and ensure_firebase_initialized():
        logger.info(f"Dispatching Firebase push notification to user {user.id}")
        try:
            msg = messaging.Message(
                notification=messaging.Notification(
                    title=subject,
                    body=message,
                ),
                data={
                    "title": subject,
                    "body": message,
                },
                android=messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(
                        title=subject,
                        body=message,
                        icon="icon-192",
                        color="#2d5a3f",
                        sound="default",
                    ),
                ),
                apns=messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(
                            alert=messaging.ApsAlert(
                                title=subject,
                                body=message,
                            ),
                            sound="default",
                            badge=1,
                            mutable_content=True,
                        ),
                    ),
                ),
                token=user.fcm_token,
            )
            response = messaging.send(msg)
            logger.info(f"Successfully sent Firebase message: {response}")
            return "SENT_FIREBASE"
        except FirebaseError as e:
            logger.error(f"Firebase dispatch failed for user {user.id}: {str(e)}")
            # Fall through to secondary channels

    # 2. WhatsApp Business API
    if settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_ID and user.phone_number:
        logger.info(f"Dispatching WhatsApp message to {user.phone_number}")
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"https://graph.facebook.com/v17.0/{settings.WHATSAPP_PHONE_ID}/messages",
                    headers={
                        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": user.phone_number,
                        "type": "text",
                        "text": {"body": f"{subject}\n\n{message}"}
                    },
                    timeout=10.0
                )
                response.raise_for_status()
                return "SENT_WHATSAPP"
        except httpx.HTTPError as e:
            logger.error(f"WhatsApp dispatch failed for {user.phone_number}: {str(e)}")
            # Fall through to email

    # 3. Fallback: Email
    logger.info(f"Falling back to Email for user {user.id}")
    await send_email(
        to_email=user.email,
        subject=subject,
        html_content=f"<p>{message}</p>"
    )
    return "SENT_EMAIL"
