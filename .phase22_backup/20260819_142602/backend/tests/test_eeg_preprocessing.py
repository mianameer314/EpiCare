"""
Unit tests for EEG preprocessing (pure functions, no DB / no HTTP).

The heavy pipeline runs in a process pool in production; here we call the
worker block directly to keep the suite fast and deterministic.
"""
import numpy as np
import pytest

from app.services.eeg_preprocessing import (
    CONTRACT_SAMPLING_RATE,
    WINDOW_SAMPLES,
    _preprocess_block,
)


def _payload(channels: int = 19, samples: int = 2560, rate: float = 256.0) -> dict:
    rng = np.random.default_rng(42)
    data = rng.standard_normal((channels, samples)).astype(np.float64)
    return {
        "data": data,
        "sampling_rate": rate,
        "channel_indices": list(range(channels)),
    }


def test_preprocess_returns_expected_shapes() -> None:
    payload = _payload(channels=19, samples=2560 * 2)
    result = _preprocess_block(payload)
    assert result["raw_shape"] == [2, 19, WINDOW_SAMPLES]
    assert result["windows_count"] == 2
    assert result["sampling_rate"] == CONTRACT_SAMPLING_RATE
    # 129 freq bins = 256 // 2 + 1; time bins for one 2560-sample window
    assert result["spectrogram_shape"][2] == 129
    assert len(result["warnings"]) == 0


def test_preprocess_resamples_128hz() -> None:
    payload = _payload(channels=19, samples=2560, rate=128.0)
    result = _preprocess_block(payload)
    assert result["sampling_rate"] == CONTRACT_SAMPLING_RATE
    assert result["raw_shape"][0] == 2  # 10s at 128Hz -> 1280 samples -> 2560 @256Hz + another window
    assert any("Resampled" in warning for warning in result["warnings"])


def test_preprocess_rejects_unsupported_rate() -> None:
    payload = _payload(channels=19, samples=1000, rate=100.0)
    with pytest.raises(ValueError, match="Unsupported sampling rate"):
        _preprocess_block(payload)


def test_preprocess_rejects_too_short() -> None:
    payload = _payload(channels=19, samples=1000, rate=256.0)
    with pytest.raises(ValueError, match="too short"):
        _preprocess_block(payload)


def test_preprocess_trims_trailing_samples() -> None:
    payload = _payload(channels=19, samples=2560 * 2 + 100, rate=256.0)
    result = _preprocess_block(payload)
    assert result["raw_shape"][0] == 2
    assert any("Trimmed" in warning for warning in result["warnings"])


def test_preprocess_channels_mapped() -> None:
    # 21 rows, canonical mapping picks rows 0..18
    payload = _payload(channels=21, samples=2560, rate=256.0)
    payload["channel_indices"] = list(range(19))
    result = _preprocess_block(payload)
    assert result["raw_shape"][1] == 19
