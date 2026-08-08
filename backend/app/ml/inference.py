"""
Inference — runs the dual-domain model over preprocessed windows.

Window probabilities are aggregated into a session-level decision using the
rule stored in model_config.json (default: >= 2 adjacent windows >= threshold).
"""
import logging
from typing import Any

import numpy as np

from app.core.exceptions import service_unavailable_error
from app.ml.contracts import InferenceResult
from app.ml.model_loader import get_model_loader

logger = logging.getLogger(__name__)


def predict(raw_windows: np.ndarray, spectrogram_windows: np.ndarray) -> InferenceResult:
    """
    Run inference over preprocessed EEG windows.

    Args:
        raw_windows: float32 array of shape (n_windows, channels, samples)
        spectrogram_windows: float32 array of shape (n_windows, channels, freq, time)

    Raises:
        HTTPException(503): when the model is not loaded.
    """
    loader = get_model_loader()
    if not loader.is_ready or loader.session is None or loader.config is None:
        raise service_unavailable_error("Seizure detection model is not available")

    session = loader.session
    config = loader.config

    try:
        window_probabilities = _run_session(session, config, raw_windows, spectrogram_windows)
    except Exception as exc:
        logger.error("Inference failed: %s", exc)
        raise service_unavailable_error("Inference failed, please try again later") from exc

    return _aggregate(window_probabilities, config.threshold, config.version)


def _run_session(
    session: Any,
    config: Any,
    raw_windows: np.ndarray,
    spectrogram_windows: np.ndarray,
) -> list[float]:
    """Run the ONNX session per window and return seizure probabilities."""
    probabilities: list[float] = []
    expected_names = config.input_names or [inp.name for inp in session.get_inputs()]

    for idx in range(raw_windows.shape[0]):
        feed: dict[str, np.ndarray] = {}
        for name in expected_names:
            if name in ("raw_eeg", "raw"):
                feed[name] = raw_windows[idx : idx + 1]
            elif name in ("spectrogram", "spec"):
                feed[name] = spectrogram_windows[idx : idx + 1]
            else:
                raise ValueError(f"Unsupported model input name: {name}")

        outputs = session.run(None, feed)
        probabilities.append(float(np.asarray(outputs[0]).reshape(-1)[0]))

    return probabilities


def _aggregate(
    window_probabilities: list[float],
    threshold: float,
    model_version: str,
) -> InferenceResult:
    """Aggregate window probabilities into a session decision (>=2 adjacent positives)."""
    positive = [p >= threshold for p in window_probabilities]
    consecutive = 0
    detected = False
    for is_positive in positive:
        consecutive = consecutive + 1 if is_positive else 0
        if consecutive >= 2:
            detected = True
            break

    probabilities_arr = np.asarray(window_probabilities, dtype=np.float32)
    predicted_class = "seizure" if detected else "no_seizure"
    confidence = float(probabilities_arr.max()) if detected else float(1.0 - probabilities_arr.max())

    return InferenceResult(
        predicted_class=predicted_class,
        confidence=round(confidence, 4),
        probability=float(probabilities_arr.max()),
        positive_windows=int(probabilities_arr[probabilities_arr >= threshold].size),
        total_windows=len(window_probabilities),
        max_probability=float(probabilities_arr.max()),
        mean_probability=float(probabilities_arr.mean()),
        window_probabilities=[round(p, 4) for p in window_probabilities],
        model_version=model_version,
    )

