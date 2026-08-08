"""
Structured JSON logging for the EpiCare backend.

Every emitted record includes: timestamp, log_level, trace_id, module, message,
plus any extra fields passed by the caller (e.g. duration_ms, user_id).

The trace_id is read from the request-context contextvar (set by
app.middleware.request_context) so a single id flows through the whole
request lifecycle — including ProcessPoolExecutor tasks and SQLAlchemy
query comments.
"""
import json
import logging
import sys
from typing import Any

from app.middleware.request_context import request_id_var

_RESERVED_KEYS = {"timestamp", "log_level", "trace_id", "module", "message"}


class JsonFormatter(logging.Formatter):
    """Serialize LogRecords as single-line JSON with the mandated fields."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "log_level": record.levelname,
            "trace_id": request_id_var.get(),
            "module": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info and record.exc_info[0] is not None:
            payload["exception"] = self.formatException(record.exc_info)

        for key, value in record.__dict__.items():
            if key.startswith("_") or key in _RESERVED_KEYS:
                continue
            if isinstance(value, (str, int, float, bool)) or value is None:
                payload[key] = value
            else:
                payload[key] = repr(value)

        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str = "INFO") -> None:
    """Configure the root logger once. Safe to call multiple times (idempotent)."""
    root = logging.getLogger()
    if any(isinstance(h.formatter, JsonFormatter) for h in root.handlers):
        return

    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)

    # Quiet noisy third-party loggers unless they are truly failing
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.INFO)
