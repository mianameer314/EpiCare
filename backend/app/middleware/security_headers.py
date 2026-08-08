"""
Security headers middleware — hardened defaults for the API.

Adds CSP, HSTS, frame/frame-ancestors, nosniff, and referrer policy headers.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Applies security headers to every response."""

    SECURITY_HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Permissions-Policy": "geolocation=(self), camera=(), microphone=()",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    }

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for name, value in self.SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response
