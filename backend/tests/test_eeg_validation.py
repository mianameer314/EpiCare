"""
Unit tests for the EEG validation service (process-pool payload functions).

These exercise the pure functions directly (no DB / no HTTP) so they run
fast and without external services.
"""
import numpy as np
import pytest

from app.services.eeg_validation import _validate_signal_block, build_validation_result


def _synthetic_eeg(channels: int = 19, samples: int = 2560, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    data = rng.standard_normal((channels, samples))
    return data.astype(np.float64)


def test_valid_signal_passes() -> None:
    data = _synthetic_eeg(channels=19, samples=2560)
    labels = [f"CH{i}" for i in range(19)]
    payload = _validate_signal_block(data, 256.0, labels)
    result = build_validation_result(payload)
    assert result.valid is True
    assert result.channels_found == 19
    assert result.sampling_rate == 256.0
    assert result.duration_seconds == pytest.approx(10.0)
    assert result.errors == []


def test_too_few_channels_fails() -> None:
    data = _synthetic_eeg(channels=4, samples=2560)
    labels = [f"CH{i}" for i in range(4)]
    result = build_validation_result(_validate_signal_block(data, 256.0, labels))
    assert result.valid is False
    assert any("Too few channels" in error for error in result.errors)


def test_too_short_recording_fails() -> None:
    data = _synthetic_eeg(channels=19, samples=256)
    labels = [f"CH{i}" for i in range(19)]
    result = build_validation_result(_validate_signal_block(data, 256.0, labels))
    assert result.valid is False
    assert any("too short" in error.lower() for error in result.errors)


def test_nan_signal_fails() -> None:
    data = _synthetic_eeg(channels=19, samples=2560)
    data[0, 100] = np.nan
    labels = [f"CH{i}" for i in range(19)]
    result = build_validation_result(_validate_signal_block(data, 256.0, labels))
    assert result.valid is False
    assert any("NaN/Inf" in error for error in result.errors)


def test_flat_channel_warns() -> None:
    data = _synthetic_eeg(channels=19, samples=2560)
    data[5, :] = 0.0
    labels = [f"CH{i}" for i in range(19)]
    result = build_validation_result(_validate_signal_block(data, 256.0, labels))
    assert result.valid is True
    assert any("Flat channels" in warning for warning in result.warnings)


def test_zero_channels_fails() -> None:
    data = np.zeros((0, 10))
    result = build_validation_result(_validate_signal_block(data, 256.0, []))
    assert result.valid is False
