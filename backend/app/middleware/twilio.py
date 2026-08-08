"""
Twilio webhook signature validation middleware.

Implements the official Twilio request-signature algorithm (HMAC-SHA1 of
the canonical URL + sorted POST params, base64-encoded) and rejects any
request to /api/v1/webhooks/twilio/* whose X-Twilio-Signature does not match.

When TWILIO_AUTH_TOKEN is unset (local dev), validation is skipped with a
warning — it must be set in production.
"""
import base64
import hashlib
import hmac
import logging
from urllib.parse import urlencode

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.config import settings

logger = logging.getLogger(__name__)

TWILIO_WEBHOOK_PREFIX = "/api/v1/webhooks/twilio/"


def compute_twilio_signature(url: str, params: dict[str, str], auth_token: str) -> str:
    """
    Compute the canonical Twilio signature.

    Algorithm: base64(HMAC-SHA1(auth_token, url + sorted query params)).
    """
    sorted_params = urlencode(sorted(params.items()))
    signature_input = url
    if sorted_params:
        signature_input += sorted_params
    digest = hmac.new(
        auth_token.encode("utf-8"),
        signature_input.encode("utf-8"),
        hashlib.sha1,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


class TwilioSignatureMiddleware(BaseHTTPMiddleware):
    """Validates X-Twilio-Signature on Twilio webhook routes."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if not path.startswith(TWILIO_WEBHOOK_PREFIX):
            return await call_next(request)

        expected = request.headers.get("x-twilio-signature", "")
        auth_token = settings.TWILIO_AUTH_TOKEN

        if not auth_token:
            logger.warning("Twilio middleware: TWILIO_AUTH_TOKEN unset — signature validation skipped")
            return await call_next(request)

        if not expected:
            logger.warning("Twilio middleware: missing X-Twilio-Signature header", extra={"path": path})
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=403,
                content={"error": {"code": "INVALID_TWILIO_SIGNATURE", "message": "Missing signature", "details": None}},
            )

        # Twilio signs the full URL (including query string) plus POST body params
        canonical_url = str(request.url)
        form = await request.form()
        params = {key: str(value) for key, value in form.items()}

        computed = compute_twilio_signature(canonical_url, params, auth_token)
        if not hmac.compare_digest(computed, expected):
            logger.warning("Twilio middleware: signature mismatch", extra={"path": path})
            from fastapi.responses import JSONResponse

            return JSONResponse(
                status_code=403,
                content={"error": {"code": "INVALID_TWILIO_SIGNATURE", "message": "Signature validation failed", "details": None}},
            )

        return await call_next(request)
