"""
Request context middleware — request IDs, trace IDs, timing, and per-request state.

Every response carries both X-Request-Id and X-Trace-ID headers (same value);
the id is injected into logs via contextvars and propagated to SQL comments
and ProcessPoolExecutor tasks for end-to-end correlation.
"""
import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
request_start_var: ContextVar[float] = ContextVar("request_start", default=0.0)


def get_request_id() -> str:
    """Return the request id for the current request (for log correlation)."""
    return request_id_var.get()


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assigns X-Request-Id / X-Trace-ID, records timing, resolves user_id."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or request.headers.get("x-trace-id") or uuid.uuid4().hex[:16]
        request_id_var.set(request_id)
        request_start_var.set(time.perf_counter())

        # Resolve the authenticated user id (best effort, never raises)
        user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()
            try:
                from app.core.security import decode_token

                payload = decode_token(token)
                if payload.get("type") == "access" and payload.get("sub"):
                    from sqlalchemy import select

                    from app.db.session import SessionLocal
                    from app.models.user import User

                    session = SessionLocal()
                    try:
                        result = await session.execute(
                            select(User.id).where(User.email == payload["sub"])
                        )
                        user_id = result.scalar_one_or_none()
                    finally:
                        await session.close()
            except Exception:
                user_id = None
        request.state.user_id = user_id

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)

        response.headers["X-Request-Id"] = request_id
        response.headers["X-Trace-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = str(duration_ms)
        logger.info(
            "http_request",
            extra={
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "user_id": user_id,
            },
        )
        return response
