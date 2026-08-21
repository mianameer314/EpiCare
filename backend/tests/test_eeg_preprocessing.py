"""Phase22 tests for the frozen raw-to-[1,70,19] preprocessing contract."""
import numpy as np
import pytest
from scipy.signal import stft

from app.services.eeg_preprocessing import (
    CONTRACT_SAMPLING_RATE,
    HIGH_HZ,
    STFT_NOVERLAP,
    STFT_NPERSEG,
    WINDOW_SAMPLES,
    _base_spectrograms,
    _common_average_reference,
    _make_model_spectrogram,
    _normalize_window,
    _resample,
)


def _window(seed: int = 42) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return rng.normal(size=(19, WINDOW_SAMPLES)).astype(np.float32)


def test_window_normalization_is_per_channel_and_clipped() -> None:
    x = _window()
    z = _normalize_window(x)
    assert z.shape == (19, 2560)
    assert z.dtype == np.float32
    assert float(z.max()) <= 8.0
    assert float(z.min()) >= -8.0
    np.testing.assert_allclose(z.mean(axis=1), 0.0, atol=1e-5)
    np.testing.assert_allclose(z.std(axis=1), 1.0, atol=2e-4)


def test_stft_exact_frozen_shape_and_reference_formula() -> None:
    z = _normalize_window(_window(7))
    actual = _make_model_spectrogram(z)
    assert actual.shape == (1, 70, 19)
    assert actual.dtype == np.float32
    assert np.isfinite(actual).all()
    assert np.all((actual >= 0.0) & (actual <= 1.0))

    freq, _, spectrum = stft(
        z,
        fs=256,
        window="hamming",
        nperseg=256,
        noverlap=128,
        boundary=None,
        padded=False,
        axis=-1,
    )
    image = (np.abs(spectrum) ** 2).mean(axis=0)
    image = np.log1p(image[(freq >= 0.5) & (freq <= 70.0)])
    lo = float(np.percentile(image, 1))
    hi = float(np.percentile(image, 99))
    reference = (
        np.zeros_like(image, dtype=np.float32)
        if hi <= lo
        else np.clip((image - lo) / (hi - lo), 0, 1).astype(np.float32)
    )
    reference = reference[None].astype(np.float16).astype(np.float32)
    np.testing.assert_array_equal(actual, reference)


def test_base_spectrograms_make_one_tensor_per_10_seconds() -> None:
    rng = np.random.default_rng(8)
    canonical = rng.normal(size=(19, WINDOW_SAMPLES * 2 + 17))
    specs, warnings = _base_spectrograms(canonical)
    assert specs.shape == (2, 1, 70, 19)
    assert specs.dtype == np.float32
    assert any("Trimmed trailing 17" in item for item in warnings)


def test_common_average_reference_zeroes_instantaneous_channel_mean() -> None:
    rng = np.random.default_rng(9)
    x = rng.normal(size=(19, 100))
    car = _common_average_reference(x)
    np.testing.assert_allclose(car.mean(axis=0), 0.0, atol=1e-6)


def test_resample_250_to_256_preserves_10_second_length() -> None:
    x = np.zeros((19, 2500), dtype=np.float64)
    y = _resample(x, 250.0, 256)
    assert y.shape == (19, 2560)


def test_sampling_rate_that_cannot_preserve_70hz_is_rejected() -> None:
    x = np.zeros((19, 1280), dtype=np.float64)
    with pytest.raises(ValueError, match="cannot preserve"):
        _resample(x, 128.0, 256)


def test_contract_constants_are_frozen() -> None:
    assert CONTRACT_SAMPLING_RATE == 256
    assert WINDOW_SAMPLES == 2560
    assert HIGH_HZ == 70.0
    assert STFT_NPERSEG == 256
    assert STFT_NOVERLAP == 128
