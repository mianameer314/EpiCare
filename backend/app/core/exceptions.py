"""
Application exceptions and the canonical API error shape.

Every API error returns the same structure:

    {
        "error": {
            "code": "INVALID_EEG_FILE",
            "message": "The uploaded EEG file could not be read.",
            "details": null
        }
    }

Mirrors the proposal's Phase 25 error-handling contract while keeping
the BRANDING-SYSTEM convention of raising HTTPException in routes/services.
"""
from typing import Any

from fastapi import HTTPException, status


class AppError(Exception):
    """Domain-level error carrying a stable machine-readable code."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def error_response(
    code: str,
    message: str,
    *,
    status_code: int = status.HTTP_400_BAD_REQUEST,
    details: Any = None,
) -> HTTPException:
    """Build an HTTPException that serializes to the canonical error shape."""
    return HTTPException(
        status_code=status_code,
        detail={
            "error": {
                "code": code,
                "message": message,
                "details": details,
            }
        },
    )


# ------------------------------------------------------------------
# Common helpers
# ------------------------------------------------------------------

def not_found_error(entity: str) -> HTTPException:
    """404 with a stable code for missing resources."""
    return error_response(
        code="NOT_FOUND",
        message=f"{entity} not found",
        status_code=status.HTTP_404_NOT_FOUND,
    )


def conflict_error(code: str, message: str) -> HTTPException:
    """409 for duplicate/conflicting state."""
    return error_response(code=code, message=message, status_code=status.HTTP_409_CONFLICT)


def service_unavailable_error(message: str = "Service temporarily unavailable") -> HTTPException:
    """503 for degraded dependencies (e.g. model not loaded)."""
    return error_response(
        code="SERVICE_UNAVAILABLE",
        message=message,
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )
