"""
Email service with dual-mode sending:
  1. Gmail API over HTTPS  — used when GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN are set.
     Works on Railway and any host that blocks outbound SMTP.
  2. SMTP via fastapi-mail — used locally or when SMTP ports are reachable.

The Gmail API path uses only httpx (already an FastAPI/Starlette dependency)
and Python stdlib (email.mime, base64), so NO new pip packages are needed.
"""

import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

import httpx
from pydantic import EmailStr

from app.core.config import settings

logger = logging.getLogger(__name__)

# Path to the templates folder
TEMPLATE_FOLDER = Path(__file__).parent.parent / "templates" / "email"

# ---------------------------------------------------------------------------
# Gmail API over HTTPS helpers
# ---------------------------------------------------------------------------

async def _get_gmail_access_token() -> str:
    """Exchange the long-lived refresh token for a short-lived access token."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GMAIL_CLIENT_ID,
                "client_secret": settings.GMAIL_CLIENT_SECRET,
                "refresh_token": settings.GMAIL_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
        )
        response.raise_for_status()
        return response.json()["access_token"]


def _render_template(template_name: str, context: dict) -> str:
    """Render an HTML email template with Jinja2."""
    from jinja2 import Environment, FileSystemLoader
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_FOLDER)))
    template = env.get_template(template_name)
    return template.render(**context)


async def _send_via_gmail_api(to_email: str, subject: str, html_body: str) -> None:
    """Send an email using the Gmail REST API over HTTPS (port 443)."""
    access_token = await _get_gmail_access_token()

    msg = MIMEMultipart("alternative")
    msg["To"] = to_email
    msg["From"] = f"{settings.MAIL_FROM_NAME} <{settings.MAIL_FROM}>"
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"raw": raw},
        )
        response.raise_for_status()
        logger.info(f"Gmail API: email sent to {to_email} (id={response.json().get('id')})")


def _use_gmail_api() -> bool:
    """Return True if Gmail API credentials are fully configured."""
    return bool(
        settings.GMAIL_CLIENT_ID
        and settings.GMAIL_CLIENT_SECRET
        and settings.GMAIL_REFRESH_TOKEN
    )


# ---------------------------------------------------------------------------
# SMTP fallback (local dev)
# ---------------------------------------------------------------------------

def _get_fast_mail():
    """Lazy-init the FastMail SMTP client only when needed."""
    from fastapi_mail import ConnectionConfig, FastMail
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
    return FastMail(conf)


async def _send_via_smtp(to_email: str, subject: str, template_name: str, template_body: dict) -> None:
    """Send email via SMTP using fastapi-mail."""
    from fastapi_mail import MessageSchema, MessageType
    fm = _get_fast_mail()
    message = MessageSchema(
        subject=subject,
        recipients=[to_email],
        template_body=template_body,
        subtype=MessageType.html,
    )
    await fm.send_message(message, template_name=template_name)
    logger.info(f"SMTP: email sent to {to_email}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def send_verification_email(email: EmailStr, otp: str, user_name: str) -> None:
    """Send an OTP verification email. Picks Gmail API or falls back to SMTP automatically."""
    logger.info(f"send_verification_email called for {email}")
    sent = False

    if _use_gmail_api():
        try:
            html_body = _render_template("verification.html", {
                "user_name": user_name,
                "otp_code": otp,
            })
            await _send_via_gmail_api(email, "Verify your EpiCare Account", html_body)
            sent = True
            logger.info(f"Verification email sent to {email} via Gmail API")
        except Exception as e:
            logger.error(
                f"FAILED to send verification email via Gmail API to {email}: "
                f"{type(e).__name__}: {str(e)}. Falling back to SMTP...",
                exc_info=True,
            )

    if not sent and settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
        logger.info("Using SMTP transport for verification email")
        try:
            await _send_via_smtp(
                email,
                "Verify your EpiCare Account",
                "verification.html",
                {"user_name": user_name, "otp_code": otp},
            )
            sent = True
            logger.info(f"Verification email sent to {email} via SMTP fallback")
        except Exception as e:
            logger.error(
                f"FAILED to send verification email via SMTP to {email}: "
                f"{type(e).__name__}: {str(e)}",
                exc_info=True,
            )

    if not sent:
        recipient_domain = email.split("@")[-1] if "@" in email else "unknown"
        logger.warning(
            f"No email transport configured or all transports failed. Verification email could not be delivered to domain: {recipient_domain}."
        )


async def send_email(to_email: str, subject: str, html_content: str) -> None:
    """Send a generic HTML email. Tries Gmail API first; automatically falls back to SMTP if OAuth token expires or fails."""
    sent = False
    if _use_gmail_api():
        try:
            await _send_via_gmail_api(to_email, subject, html_content)
            sent = True
            logger.info(f"Email sent to {to_email} via Gmail API")
        except Exception as e:
            logger.error(f"Failed to send email via Gmail API to {to_email}: {str(e)}. Falling back to SMTP...")

    if not sent and settings.MAIL_USERNAME and settings.MAIL_PASSWORD:
        from fastapi_mail import MessageSchema, MessageType
        fm = _get_fast_mail()
        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=html_content,
            subtype=MessageType.html,
        )
        try:
            await fm.send_message(message)
            sent = True
            logger.info(f"Email sent to {to_email} via SMTP fallback")
        except Exception as e:
            logger.error(f"Failed to send email via SMTP to {to_email}: {str(e)}")

    if not sent:
        logger.warning(f"No email transport configured or all failed. Suppressed email to {to_email}")
