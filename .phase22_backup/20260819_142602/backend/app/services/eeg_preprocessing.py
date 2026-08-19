"""
EEG preprocessing — the single, frozen preprocessing contract shared by
training and inference (docs/model_contract.md). Every heavy step is
CPU-bound and therefore executed via app.ml.executor.run_cpu_bound so the
event loop never blocks.

Pipeline (identical to training):
    1. Resample to the contract sampling rate (256 Hz) when needed.
    2. Bandpass filter (default 0.5-40 Hz) via a zero-phase Butterworth.
    3. Notch filter at 50/60 Hz to remove line noise.
    4. Per-channel z-score normalization.
    5. Split into 10 s windows (2560 samples).
    6. STFT spectrograms per window for the spectral-domain head.
"""
import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.ml.executor import run_cpu_bound

logger = logging.getLogger(__name__)

CONTRACT_SAMPLING_RATE: int = 256
WINDOW_SECONDS: int = 10
WINDOW_SAMPLES: int = CONTRACT_SAMPLING_RATE * WINDOW_SECONDS  # 2560

# Supported source sampling rates (validated before resampling).
SUPPORTED_SAMPLING_RATES: set[int] = {128, 256, 512, 1024}

# STFT defaults (mirror training/config so there is no train/serve skew).
STFT_NPERSEG: int = 256
STFT_NOVERLAP: int = 128
STFT_FMIN: float = 0.5
STFT_FMAX: float = 70.0


@dataclass
class PreprocessingResult:
    """Frozen output of the preprocessing pipeline (picklable dict payloads)."""

    raw_windows: np.ndarray  # (n_windows, channels, 2560) float32
    spectrogram_windows: np.ndarray  # (n_windows, channels, freq_bins, time_bins) float32
    sampling_rate: int
    window_seconds: int
    windows_count: int
    warnings: list[str] = field(default_factory=list)


def _butterworth_bandpass(
    data: np.ndarray,
    sampling_rate: float,
    low: float = 0.5,
    high: float = 70.0,
    order: int = 4,
) -> np.ndarray:
    """Zero-phase bandpass filter along the last axis (samples)."""
    from scipy.signal import butter, filtfilt

    nyquist = sampling_rate / 2.0
    if high >= nyquist:
        high = nyquist * 0.99
    b, a = butter(order, [low / nyquist, high / nyquist], btype="band")
    return filtfilt(b, a, data, axis=-1)


def _notch_filter(
    data: np.ndarray,
    sampling_rate: float,
    notch_freq: float = 50.0,
    quality: float = 30.0,
) -> np.ndarray:
    """Apply a single notch filter (line noise removal)."""
    from scipy.signal import iirnotch

    if notch_freq >= sampling_rate / 2.0:
        return data
    b, a = iirnotch(notch_freq, quality, sampling_rate)
    return np.asarray([np.asarray(_safe_filtfilt(b, a, channel)) for channel in data])


def _safe_filtfilt(b: Any, a: Any, signal: np.ndarray) -> np.ndarray:
    """filtfilt wrapper that handles single-sample edge cases."""
    from scipy.signal import filtfilt

    if signal.shape[-1] < 15:
        return signal
    return filtfilt(b, a, signal, axis=-1)


def _zscore_per_channel(data: np.ndarray) -> np.ndarray:
    """Normalize each channel to zero mean / unit std (matches training)."""
    mean = data.mean(axis=-1, keepdims=True)
    std = data.std(axis=-1, keepdims=True)
    std = np.where(std < 1e-8, 1.0, std)
    return (data - mean) / std


def _stft_windows(
    data: np.ndarray,
    sampling_rate: float,
) -> np.ndarray:
    """Compute magnitude spectrograms per channel for every window.

    Returns float32 array of shape (n_windows, channels, freq_bins, time_bins).
    """
    from scipy.signal import stft

    windows, channels, samples = data.shape
    nper = int(STFT_NPERSEG)
    noverlap = int(STFT_NOVERLAP)
    freq_bins = nper // 2 + 1
    time_bins = (samples - nper) // (nper - noverlap) + 1

    # Determine the real frame count from a reference STFT (scipy pads the
    # signal by nperseg//2 on both ends, so the shape cannot be hardcoded).
    freqs, _, ref = stft(
        data[0, 0],
        fs=sampling_rate,
        nperseg=nper,
        noverlap=noverlap,
    )
    out = np.zeros((windows, channels, ref.shape[0], ref.shape[1]), dtype=np.float32)
    for w_idx in range(windows):
        for c_idx in range(channels):
            _, _, zxx = stft(
                data[w_idx, c_idx],
                fs=sampling_rate,
                nperseg=nper,
                noverlap=noverlap,
            )
            mag = np.abs(zxx).astype(np.float32)
            out[w_idx, c_idx, : mag.shape[0], : mag.shape[1]] = mag
    return out


def _preprocess_block(payload: dict[str, Any]) -> dict[str, Any]:
    """
    CPU-bound preprocessing entry point (runs inside the process pool).

    Args:
        payload: picklable dict with keys:
            - data: float64 (channels, samples)
            - sampling_rate: float (Hz)
            - channel_indices: list[int] ordered rows for the canonical set

    Returns:
        Serializable dict with raw_windows/spectrogram_windows bytes-encoded
        arrays so the result crosses the process boundary cleanly.
    """
    warnings: list[str] = []
    data = np.asarray(payload["data"], dtype=np.float64)
    sampling_rate = float(payload["sampling_rate"])
    channel_indices = list(payload["channel_indices"])

    if sampling_rate != CONTRACT_SAMPLING_RATE:
        if int(sampling_rate) not in SUPPORTED_SAMPLING_RATES:
            raise ValueError(
                f"Unsupported sampling rate {sampling_rate} Hz; "
                f"supported: {sorted(SUPPORTED_SAMPLING_RATES)}"
            )
        from scipy.signal import resample_poly

        gcd = int(np.gcd(int(sampling_rate), CONTRACT_SAMPLING_RATE))
        up = CONTRACT_SAMPLING_RATE // gcd
        down = int(sampling_rate) // gcd
        data = resample_poly(data, up, down, axis=-1)
        warnings.append(
            f"Resampled {int(sampling_rate)} Hz -> {CONTRACT_SAMPLING_RATE} Hz"
        )
        sampling_rate = float(CONTRACT_SAMPLING_RATE)

    # Select only the canonical mapped channels (ordered).
    data = data[channel_indices]

    data = _butterworth_bandpass(data, sampling_rate)
    data = _notch_filter(data, sampling_rate)

    # Trim to whole windows.
    usable_samples = (data.shape[-1] // WINDOW_SAMPLES) * WINDOW_SAMPLES
    if usable_samples < WINDOW_SAMPLES:
        raise ValueError(
            f"Recording too short for one {WINDOW_SECONDS}s window "
            f"({data.shape[-1]} usable samples)"
        )
    if usable_samples != data.shape[-1]:
        trimmed = data.shape[-1] - usable_samples
        data = data[..., :usable_samples]
        warnings.append(f"Trimmed trailing {trimmed} samples to whole windows")

    data = _zscore_per_channel(data)

    raw_windows = data.reshape(data.shape[0], -1, WINDOW_SAMPLES).astype(np.float32)
    # raw_windows: (channels, n_windows, samples) -> transpose to (n_windows, channels, samples)
    raw_windows = np.transpose(raw_windows, (1, 0, 2))

    spectrogram_windows = _stft_windows(raw_windows, sampling_rate)

    return {
        "raw_windows": raw_windows.tobytes(),
        "raw_shape": list(raw_windows.shape),
        "spectrogram_windows": spectrogram_windows.tobytes(),
        "spectrogram_shape": list(spectrogram_windows.shape),
        "sampling_rate": int(sampling_rate),
        "window_seconds": WINDOW_SECONDS,
        "windows_count": int(raw_windows.shape[0]),
        "warnings": warnings,
    }


def _decode_result(payload: dict[str, Any]) -> PreprocessingResult:
    """Rebuild a PreprocessingResult from the picklable dict payload."""
    raw = np.frombuffer(payload["raw_windows"], dtype=np.float32).reshape(payload["raw_shape"])
    spec = np.frombuffer(payload["spectrogram_windows"], dtype=np.float32).reshape(
        payload["spectrogram_shape"]
    )
    return PreprocessingResult(
        raw_windows=raw,
        spectrogram_windows=spec,
        sampling_rate=int(payload["sampling_rate"]),
        window_seconds=int(payload["window_seconds"]),
        windows_count=int(payload["windows_count"]),
        warnings=list(payload.get("warnings", [])),
    )


async def preprocess_eeg(
    data: np.ndarray,
    sampling_rate: float,
    channel_indices: list[int],
) -> PreprocessingResult:
    """
    Run the full preprocessing pipeline off the event loop.

    Args:
        data: float64 array shape (channels, samples).
        sampling_rate: source sampling rate in Hz.
        channel_indices: ordered row indices matching the canonical channels.

    Raises:
        RuntimeError: wrapped when the worker failed (e.g. unsupported rate).
    """
    payload = {
        "data": np.asarray(data, dtype=np.float64),
        "sampling_rate": float(sampling_rate),
        "channel_indices": [int(idx) for idx in channel_indices],
    }
    result_payload = await run_cpu_bound(
        _preprocess_block, payload, task_name="eeg_preprocess"
    )
    return _decode_result(result_payload)
