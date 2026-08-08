"""
Strict Pydantic v2 base for all EpiCare schemas.

Rules:
- strict=True blocks silent coercion (Axios "1" -> int, "1.5" -> float, etc.)
- Date/Datetime/Time fields accept native values OR ISO-8601 strings via
  explicit BeforeValidator parsers, because strict mode otherwise rejects
  strings for these types.
"""
from datetime import date, datetime, time
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict


def parse_date(value: Any) -> date:
    """Accept date or 'YYYY-MM-DD' string; reject anything else."""
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("expected a date in YYYY-MM-DD format") from exc
    raise ValueError("must be a date or YYYY-MM-DD string")


def parse_datetime(value: Any) -> datetime:
    """Accept datetime or ISO-8601 string (Z normalized to +00:00)."""
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("expected an ISO-8601 datetime string") from exc
    raise ValueError("must be a datetime or ISO-8601 string")


def parse_time(value: Any) -> time:
    """Accept time or 'HH:MM[:SS]' string."""
    if isinstance(value, time):
        return value
    if isinstance(value, str):
        try:
            return time.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("expected a time in HH:MM:SS format") from exc
    raise ValueError("must be a time or HH:MM:SS string")


StrictDate = Annotated[date, BeforeValidator(parse_date)]
StrictDatetime = Annotated[datetime, BeforeValidator(parse_datetime)]
StrictTime = Annotated[time, BeforeValidator(parse_time)]


class StrictModel(BaseModel):
    """Base class: strict validation for every schema in the API."""

    model_config = ConfigDict(strict=True)
