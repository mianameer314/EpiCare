"""
Shared schema components used across EpiCare API modules.
"""
from typing import Generic, TypeVar

from app.schemas.base import StrictModel

T = TypeVar("T")


class PaginatedResponse(StrictModel, Generic[T]):
    """Generic paginated list wrapper returned by all list endpoints."""
    items: list[T]
    total: int
    page: int
    per_page: int


class ErrorDetail(StrictModel):
    """Canonical API error body."""
    code: str
    message: str
    details: object | None = None


class ErrorResponse(StrictModel):
    """Canonical API error envelope: { "error": { ... } }."""
    error: ErrorDetail
