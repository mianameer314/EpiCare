"""
Shared schema components used across EpiCare API modules.
"""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated list wrapper returned by all list endpoints."""
    items: list[T]
    total: int
    page: int
    per_page: int


class ErrorDetail(BaseModel):
    """Canonical API error body."""
    code: str
    message: str
    details: object | None = None


class ErrorResponse(BaseModel):
    """Canonical API error envelope: { "error": { ... } }."""
    error: ErrorDetail
