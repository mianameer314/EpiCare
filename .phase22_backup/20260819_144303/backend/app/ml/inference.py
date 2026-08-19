"""
Frozen Phase12 ONNX inference + causal temporal post-processing.

This module intentionally contains no model/threshold tuning. The temporal
configuration is loaded from the versioned model package:
    causal_mean(window=3) -> threshold 0.30 -> min_run=1 -> max_gap=0
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.core.exceptions import error_response, service_unavailable_error
from app.ml.contracts import InferenceResult
from app.ml.model_loader import get_model_loader

logger = logging.getLogger(__name__)

DEFAULT_INFERENCE_BATCH = 96


def _run_session(
    session: Any,
    config: Any,
    spectrogram_windows: np.ndarray,
    *,
    batch_size: int = DEFAULT_INFERENCE_BATCH,
) -> list[float]:
    """Run the one-input ONNX detector in bounded batches."""
    x = np.asarray(spectrogram_windows, dtype=np.float32)
    if x.ndim != 4 or tuple(x.shape[1:]) != (1, 70, 19):
        raise ValueError(
            f"Expected spectrogram windows [N,1,70,19], got {x.shape}"
        )
    if len(x) == 0:
        raise ValueError("At least one EEG window is required for inference")
    if not np.isfinite(x).all():
        raise ValueError("Model input contains NaN/Inf")

    expected_names = list(config.input_names or [])
    if expected_names != ["spectrogram"]:
        raise ValueError(
            f"Frozen model input contract mismatch: {expected_names}"
        )

    probabilities: list[float] = []
    for start in range(0, len(x), max(1, int(batch_size))):
        batch = np.ascontiguousarray(
            x[start : start + batch_size],
            dtype=np.float32,
        )
        outputs = session.run(None, {"spectrogram": batch})
        if not outputs:
            raise RuntimeError("ONNX Runtime returned no output")
        p = np.asarray(outputs[0], dtype=np.float32).reshape(-1)
        if len(p) != len(batch):
            raise RuntimeError(
                "ONNX output batch length does not match input batch length"
            )
        if not np.isfinite(p).all() or np.any((p < 0.0) | (p > 1.0)):
            raise RuntimeError("ONNX output is not a finite probability")
        probabilities.extend(float(v) for v in p)

    return probabilities


def causal_mean(probabilities: list[float] | np.ndarray, window: int) -> np.ndarray:
    """Causal trailing mean; no future probability is used."""
    p = np.asarray(probabilities, dtype=np.float64).reshape(-1)
    window = int(window)
    if window < 1:
        raise ValueError("Causal smoothing window must be >= 1")
    out = np.empty_like(p)
    cumsum = np.cumsum(np.insert(p, 0, 0.0))
    for idx in range(len(p)):
        start = max(0, idx - window + 1)
        out[idx] = (cumsum[idx + 1] - cumsum[start]) / (idx - start + 1)
    return out


def _bridge_short_negative_gaps(binary: np.ndarray, maximum_gap: int) -> np.ndarray:
    """Fill bounded zero-runs of length <= maximum_gap between positive runs."""
    out = np.asarray(binary, dtype=np.int8).copy()
    maximum_gap = int(maximum_gap)
    if maximum_gap <= 0 or len(out) == 0:
        return out

    idx = 0
    while idx < len(out):
        if out[idx] != 0:
            idx += 1
            continue
        start = idx
        while idx < len(out) and out[idx] == 0:
            idx += 1
        stop = idx
        gap = stop - start
        left_positive = start > 0 and out[start - 1] == 1
        right_positive = stop < len(out) and out[stop] == 1
        if left_positive and right_positive and gap <= maximum_gap:
            out[start:stop] = 1
    return out


def _remove_short_positive_runs(binary: np.ndarray, minimum_run: int) -> np.ndarray:
    """Remove positive runs shorter than the frozen minimum run length."""
    out = np.asarray(binary, dtype=np.int8).copy()
    minimum_run = int(minimum_run)
    if minimum_run <= 1 or len(out) == 0:
        return out

    idx = 0
    while idx < len(out):
        if out[idx] == 0:
            idx += 1
            continue
        start = idx
        while idx < len(out) and out[idx] == 1:
            idx += 1
        if idx - start < minimum_run:
            out[start:idx] = 0
    return out


def event_ranges(binary: list[int] | np.ndarray) -> list[dict[str, int]]:
    """Return contiguous positive event ranges in window coordinates."""
    b = np.asarray(binary, dtype=np.int8).reshape(-1)
    events: list[dict[str, int]] = []
    idx = 0
    while idx < len(b):
        if b[idx] == 0:
            idx += 1
            continue
        start = idx
        while idx < len(b) and b[idx] == 1:
            idx += 1
        events.append(
            {
                "start_window": int(start),
                "stop_window_exclusive": int(idx),
            }
        )
    return events


def apply_temporal_policy(
    probabilities: list[float] | np.ndarray,
    policy: dict[str, object],
) -> tuple[np.ndarray, np.ndarray, list[dict[str, int]]]:
    """Apply the exact frozen causal temporal policy."""
    p = np.asarray(probabilities, dtype=np.float64).reshape(-1)
    if len(p) == 0:
        raise ValueError("Temporal policy requires at least one probability")

    method = str(policy.get("smoothing_method", ""))
    if method != "causal_mean":
        raise ValueError(
            f"Unsupported frozen smoothing method: {method!r}"
        )

    smoothed = causal_mean(
        p,
        int(policy.get("smoothing_window", 3)),
    )
    threshold = float(policy.get("threshold", 0.30))
    binary = (smoothed >= threshold).astype(np.int8)

    # Current frozen values are gap=0 and min_run=1. Generic handling remains
    # deterministic for contract completeness.
    binary = _bridge_short_negative_gaps(
        binary,
        int(policy.get("maximum_negative_gap", 0)),
    )
    binary = _remove_short_positive_runs(
        binary,
        int(policy.get("minimum_positive_run", 1)),
    )

    return smoothed, binary, event_ranges(binary)


def _aggregate(
    window_probabilities: list[float],
    temporal_policy: dict[str, object],
    model_version: str,
) -> InferenceResult:
    """Aggregate raw ONNX probabilities with the frozen causal policy."""
    raw = np.asarray(window_probabilities, dtype=np.float64)
    if len(raw) == 0:
        raise ValueError("No window probabilities to aggregate")

    smoothed, binary, events = apply_temporal_policy(
        raw,
        temporal_policy,
    )
    threshold = float(temporal_policy["threshold"])
    detected = bool(events)

    predicted_class = "seizure" if detected else "no_seizure"
    max_smoothed = float(smoothed.max())
    confidence = max_smoothed if detected else 1.0 - max_smoothed
    confidence = float(np.clip(confidence, 0.0, 1.0))

    return InferenceResult(
        predicted_class=predicted_class,
        confidence=round(confidence, 4),
        probability=max_smoothed,
        threshold=threshold,
        positive_windows=int(binary.sum()),
        total_windows=int(len(raw)),
        event_count=int(len(events)),
        max_probability=float(raw.max()),
        mean_probability=float(raw.mean()),
        window_probabilities=[round(float(v), 6) for v in raw],
        smoothed_window_probabilities=[
            round(float(v), 6) for v in smoothed
        ],
        positive_event_ranges=events,
        model_version=model_version,
    )


def predict(spectrogram_windows: np.ndarray) -> InferenceResult:
    """
    Run the frozen one-input ONNX model and frozen temporal policy.

    Raises HTTP 503 when the serving package/model is unavailable.
    """
    loader = get_model_loader()
    if (
        not loader.is_ready
        or loader.session is None
        or loader.config is None
    ):
        # Keep the live backend's existing error code for frontend/API compatibility.
        # The message is corrected because Phase22 now expects a frozen serving package,
        # not an untrained placeholder model.
        raise error_response(
            code="MODEL_NOT_TRAINED",
            message="Seizure detection model is not available.",
            status_code=503,
        )

    try:
        probabilities = _run_session(
            loader.session,
            loader.config,
            spectrogram_windows,
        )
        return _aggregate(
            probabilities,
            loader.config.temporal_policy,
            loader.config.version,
        )
    except Exception as exc:
        logger.exception("Frozen seizure inference failed")
        raise service_unavailable_error(
            "Inference failed, please try again later"
        ) from exc
