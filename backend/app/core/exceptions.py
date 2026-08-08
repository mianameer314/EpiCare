"""
Global exception handling — sanitized error responses with trace_id.

All unhandled exceptions are caught, logged as structured JSON (with stack
trace), and returned as:

    {"error": {"code": "INTERNAL_ERROR", "message": "Internal server error",
               "details": null}, "trace_id": "..."}

Known HTTPExceptions pass through unchanged (with their detail), so the
canonical error envelope from app/core/exceptions.py still applies.
"""
import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.middleware.request_context import get_request_id

logger = logging.getLogger(__name__)


def _trace_id() -> str:
    return get_request_id()


def _error_body(
    code: str,
    message: str,
    *,
    details: Any = None,
    status_code: int = 500,
) -> dict[str, Any]:
    return {
        "error": {"code": code, "message": message, "details": details},
        "trace_id": _trace_id(),
        "status_code": status_code,
    }


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Passthrough for raised HTTPExceptions (already shaped by callers)."""
    detail = exc.detail
    if isinstance(detail, dict) and "error" in detail:
        body = {**detail, "trace_id": _trace_id()}
    else:
        body = _error_body(
            code="HTTP_ERROR",
            message=str(detail),
            details=None,
            status_code=exc.status_code,
        )
    return JSONResponse(status_code=exc.status_code, content=body)


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """422 responses: surface field-level validation errors without stack traces."""
    details: list[dict[str, Any]] = []
    for error in exc.errors():
        details.append(
            {
                "loc": [str(part) for part in error.get("loc", [])],
                "msg": error.get("msg"),
                "type": error.get("type"),
            }
        )
    logger.warning(
        "request_validation_failed",
        extra={
            "path": request.url.path,
            "method": request.method,
            "errors": details,
        },
    )
    return JSONResponse(
        status_code=422,
        content=_error_body(
            code="VALIDATION_ERROR",
            message="Request validation failed",
            details=details,
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all: log the stack trace, return a sanitized 500 with trace_id."""
    logger.exception(
        "unhandled_exception",
        extra={
            "path": request.url.path,
            "method": request.method,
        },
    )
    body = _error_body(
        code="INTERNAL_ERROR",
        message="Internal server error",
        details=str(exc) if settings.DEBUG else None,
    )
    return JSONResponse(status_code=500, content=body)


def register_exception_handlers(app: FastAPI) -> None:
    """Wire the global exception handlers onto the FastAPI app."""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

# ------------------------------------------------------------------
# Convenience helpers (kept for route/service use)
# ------------------------------------------------------------------

def error_response(
    code: str,
    message: str,
    *,
    status_code: int = 400,
    details: Any = None,
) -> StarletteHTTPException:
    """Build an HTTPException that serializes to the canonical error shape."""
    from fastapi import HTTPException

    return HTTPException(
        status_code=status_code,
        detail={"error": {"code": code, "message": message, "details": details}},
    )


def not_found_error(entity: str) -> StarletteHTTPException:
    """404 with a stable code for missing resources."""
    return error_response(code="NOT_FOUND", message=f"{entity} not found", status_code=404)


def conflict_error(code: str, message: str) -> StarletteHTTPException:
    """409 for duplicate/conflicting state."""
    return error_response(code=code, message=message, status_code=409)


def service_unavailable_error(message: str = "Service temporarily unavailable") -> StarletteHTTPException:
    """503 for degraded dependencies (e.g. model not loaded)."""
    return error_response(code="SERVICE_UNAVAILABLE", message=message, status_code=503)
