"""
EEG validation — lightweight structural checks that run in the process pool.

Heavy signal inspection (sampling rate, channels, duration, NaN/Inf, flat
channels, variance) is CPU-bound and therefore executed via
app.ml.executor.run_cpu_bound so the event loop stays responsive.
"""
import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class EegValidationResult:
    """Validation summary for an uploaded EEG file."""

    valid: bool
    sampling_rate: float | None = None
    duration_seconds: float | None = None
    channels_found: int | None = None
    channels_used: int | None = None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def _validate_signal_block(
    data: np.ndarray | dict[str, Any],
    sampling_rate: float | None = None,
    channel_labels: list[str] | None = None,
    min_channels: int = 8,
    min_duration_seconds: float = 5.0,
) -> dict[str, Any]:
    """
    CPU-bound validation of a raw EEG matrix.

    Args:
        data: float64 array shape (channels, samples) or dict payload.
        sampling_rate: Hz.
        channel_labels: Ordered channel names (len == channels).

    Returns:
        Serializable dict (picklable across the process boundary).
    """
    if isinstance(data, dict):
        sampling_rate = float(data.get("sampling_rate", 256.0))
        channel_labels = list(data.get("channel_labels", []))
        min_channels = int(data.get("min_channels", min_channels))
        min_duration_seconds = float(data.get("min_duration_seconds", min_duration_seconds))
        data = np.asarray(data["data"], dtype=np.float64)
    else:
        sampling_rate = float(sampling_rate or 256.0)
        channel_labels = list(channel_labels or [])
        data = np.asarray(data, dtype=np.float64)
    warnings: list[str] = []
    errors: list[str] = []
    channels, samples = data.shape

    if channels == 0:
        errors.append("No usable channels found")
    if samples == 0:
        errors.append("Zero-duration recording")

    duration = samples / sampling_rate if sampling_rate > 0 else 0.0
    if duration < min_duration_seconds:
        errors.append(f"Recording too short ({duration:.1f}s < {min_duration_seconds}s)")

    if channels < min_channels:
        errors.append(f"Too few channels ({channels} < {min_channels})")

    if len(channel_labels) != channels:
        warnings.append("Channel label count does not match data rows")

    # NaN / Inf check
    if not np.isfinite(data).all():
        errors.append("Signal contains NaN/Inf values")

    # Flat / dead channels
    flat_channels: list[str] = []
    variances = np.var(data, axis=1)
    for idx in range(channels):
        if variances[idx] < 1e-12:
            label = channel_labels[idx] if idx < len(channel_labels) else str(idx)
            flat_channels.append(label)
    if flat_channels:
        warnings.append(f"Flat channels detected: {flat_channels}")

    # Duplicate channel labels
    if len(set(channel_labels)) != len(channel_labels):
        warnings.append("Duplicate channel labels detected")

    return {
        "valid": not errors,
        "sampling_rate": float(sampling_rate),
        "duration_seconds": round(duration, 3),
        "channels_found": channels,
        "channels_used": channels,
        "warnings": warnings,
        "errors": errors,
    }


def build_validation_result(payload: dict[str, Any]) -> EegValidationResult:
    """Convert a process-pool result dict into the dataclass."""
    return EegValidationResult(
        valid=bool(payload.get("valid", False)),
        sampling_rate=payload.get("sampling_rate"),
        duration_seconds=payload.get("duration_seconds"),
        channels_found=payload.get("channels_found"),
        channels_used=payload.get("channels_used"),
        warnings=list(payload.get("warnings", [])),
        errors=list(payload.get("errors", [])),
    )
