"""
Approved AI adapter registry for RAG and VLM modules (Findings 1, 8).
Prevents CWE-94 dynamic execution of unreviewed filesystem scripts and enforces
a structured, allowlisted model adapter lifecycle.
"""
from typing import Any, Callable

_APPROVED_AI_ADAPTERS: dict[str, Callable[..., Any]] = {}


def register_ai_adapter(name: str, fn: Callable[..., Any]) -> None:
    """Register an approved, reviewed AI model adapter."""
    _APPROVED_AI_ADAPTERS[name] = fn


def get_ai_adapter(name: str) -> Callable[..., Any] | None:
    """Retrieve an approved AI adapter by name."""
    return _APPROVED_AI_ADAPTERS.get(name)
