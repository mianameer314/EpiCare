import logging
from pathlib import Path
from typing import Any

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from pydantic import EmailStr

from app.core.config import settings

logger = logging.getLogger(__name__)

# Path to the templates folder
TEMPLATE_FOLDER = Path(__file__).parent.parent / "templates" / "email"

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    TEMPLATE_FOLDER=str(TEMPLATE_FOLDER),
)

fast_mail = FastMail(conf)


async def send_verification_email(email: EmailStr, otp: str, user_name: str) -> None:
    """Send an elegant OTP verification email."""
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning(
            "Email settings not fully configured (MAIL_USERNAME / MAIL_PASSWORD). "
            f"Would have sent OTP {otp} to {email}."
        )
        return

    message = MessageSchema(
        subject="Verify your EpiCare Account",
        recipients=[email],
        template_body={
            "user_name": user_name,
            "otp_code": otp,
        },
        subtype=MessageType.html,
    )

    try:
        await fast_mail.send_message(message, template_name="verification.html")
        logger.info(f"Verification email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {str(e)}")
        # We don't raise the exception here because we don't want to fail the registration
        # entirely if the email fails to send. The user can request a new OTP later.


async def send_email(to_email: str, subject: str, html_content: str) -> None:
    """Send a generic HTML email."""
    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning(f"Email settings unconfigured. Suppressed email to {to_email} with subject {subject}")
        return

    message = MessageSchema(
        subject=subject,
        recipients=[to_email],
        body=html_content,
        subtype=MessageType.html,
    )

    try:
        await fast_mail.send_message(message)
        logger.info(f"Email sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
