"""
Frozen EpiCare seizure-detector preprocessing and signal-driven routing.

Serving pipeline:
    channel/montage harmonization
    -> resample to 256 Hz
    -> 0.5-70 Hz Butterworth bandpass
    -> common-average reference
    -> 10 s windows
    -> per-window/per-channel z-score + clip [-8,8]
    -> Hamming STFT (256/128, boundary=None, padded=False)
    -> power |STFT|^2, mean across 19 channels
    -> 1-70 Hz bins, log1p, p1/p99 normalize, clip [0,1]
    -> base tensor [N,1,70,19]
    -> frozen logistic_C_2 recording route
    -> frozen TUH/Siena/CHB/self frequency transform

No dataset identity, seizure label, threshold tuning, or model fitting occurs.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction
from functools import lru_cache
import json
from pathlib import Path
from typing import Any

import numpy as np

from app.ml.executor import run_cpu_bound
from app.services.channel_mapper import (
    CANONICAL_CHANNELS,
    harmonize_signal,
    inspect_montage_style,
    normalize_direct_channel,
    parse_bipolar_label,
)

CONTRACT_SAMPLING_RATE = 256
WINDOW_SECONDS = 10
WINDOW_SAMPLES = CONTRACT_SAMPLING_RATE * WINDOW_SECONDS
LOW_HZ = 0.5
HIGH_HZ = 70.0
STFT_NPERSEG = 256
STFT_NOVERLAP = 128
PROFILE_MAX_WINDOWS = 30
POWERLINE_SAMPLE_SECONDS = 120.0
POWERLINE_CONFIDENT_PEAK_RATIO = 1.25


@dataclass
class PreprocessingResult:
    """Model-ready result returned to the EEG session service."""

    model_inputs: np.ndarray  # [N,1,70,19] float32
    sampling_rate: int
    window_seconds: int
    windows_count: int
    universal_route: str
    montage_style: str
    warnings: list[str] = field(default_factory=list)


def _read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path.name} must contain a JSON object")
    return payload


@lru_cache(maxsize=4)
def _load_serving_assets(package_root: str) -> dict[str, Any]:
    root = Path(package_root)
    required = [
        "serving_contract.json",
        "universal_router.json",
        "universal_router_parameters.npz",
        "universal_router_prototypes.npz",
        "universal_frequency_transforms.npz",
    ]
    missing = [name for name in required if not (root / name).exists()]
    if missing:
        raise ValueError(
            "Frozen serving package missing preprocessing artifacts: "
            + ", ".join(missing)
        )

    serving = _read_json(root / "serving_contract.json")
    router_meta = _read_json(root / "universal_router.json")

    with np.load(
        root / "universal_router_parameters.npz",
        allow_pickle=True,
    ) as z:
        router = {
            "feature_columns": [str(v) for v in z["feature_columns"].tolist()],
            "classes": np.asarray(z["classes"]).astype(str),
            "scaler_mean": np.asarray(z["scaler_mean"], dtype=np.float64),
            "scaler_scale": np.asarray(z["scaler_scale"], dtype=np.float64),
            "coef": np.asarray(z["coef"], dtype=np.float64),
            "intercept": np.asarray(z["intercept"], dtype=np.float64),
            "ood_threshold": float(
                np.asarray(z["ood_min_distance_threshold"]).reshape(-1)[0]
            ),
        }

    with np.load(
        root / "universal_router_prototypes.npz",
        allow_pickle=True,
    ) as z:
        prototypes = {
            domain: {
                "center": np.asarray(z[f"{domain}_center"], dtype=np.float32),
                "scale": np.asarray(z[f"{domain}_scale"], dtype=np.float32),
                "radius": float(
                    np.asarray(z[f"{domain}_radius"]).reshape(-1)[0]
                ),
            }
            for domain in ("tuh", "siena", "chb")
        }

    with np.load(
        root / "universal_frequency_transforms.npz",
        allow_pickle=True,
    ) as z:
        transforms = {
            "tuh_mean": np.asarray(z["tuh_mean"], dtype=np.float32),
            "tuh_std": np.asarray(z["tuh_std"], dtype=np.float32),
            "siena_mean": np.asarray(z["siena_mean"], dtype=np.float32),
            "siena_std": np.asarray(z["siena_std"], dtype=np.float32),
            "siena_alpha": float(
                np.asarray(z["siena_alpha"]).reshape(-1)[0]
            ),
            "chb_mean": np.asarray(z["chb_mean"], dtype=np.float32),
            "chb_std": np.asarray(z["chb_std"], dtype=np.float32),
            "self_alpha": float(
                np.asarray(z["self_alpha"]).reshape(-1)[0]
            ),
        }

    expected_features = list(router_meta.get("feature_columns", []))
    if router["feature_columns"] != expected_features:
        raise ValueError(
            "Router parameter feature order does not match universal_router.json"
        )
    if router_meta.get("selected_candidate") != "logistic_C_2":
        raise ValueError("Unexpected frozen router candidate")

    if router["coef"].shape[1] != len(router["feature_columns"]):
        raise ValueError("Router coefficient dimension mismatch")
    if router["classes"].shape[0] != router["coef"].shape[0]:
        raise ValueError("Router class/coefficient dimension mismatch")

    for domain, proto in prototypes.items():
        if (
            proto["center"].shape != (70,)
            or proto["scale"].shape != (70,)
            or not np.isfinite(proto["center"]).all()
            or not np.isfinite(proto["scale"]).all()
            or proto["radius"] <= 0
        ):
            raise ValueError(f"Invalid frozen router prototype: {domain}")

    for name, arr in transforms.items():
        if isinstance(arr, np.ndarray):
            if arr.shape != (70,) or not np.isfinite(arr).all():
                raise ValueError(f"Invalid frozen frequency transform: {name}")

    input_shape = (
        serving.get("onnx", {}).get("input_shape")
        if isinstance(serving.get("onnx"), dict)
        else None
    )
    if input_shape != ["batch", 1, 70, 19]:
        raise ValueError(
            f"Unexpected frozen serving input shape: {input_shape}"
        )

    return {
        "serving": serving,
        "router_meta": router_meta,
        "router": router,
        "prototypes": prototypes,
        "transforms": transforms,
    }


def _resample(
    data: np.ndarray,
    source_rate: float,
    target_rate: int = CONTRACT_SAMPLING_RATE,
) -> np.ndarray:
    from scipy.signal import resample_poly

    source_rate = float(source_rate)
    if not np.isfinite(source_rate) or source_rate <= 2 * HIGH_HZ:
        raise ValueError(
            f"Sampling rate {source_rate:g} Hz cannot preserve the frozen "
            f"0.5-{HIGH_HZ:g} Hz bandwidth"
        )
    if np.isclose(source_rate, target_rate):
        return np.asarray(data, dtype=np.float32)

    ratio = Fraction(target_rate / source_rate).limit_denominator(10_000)
    arr = np.asarray(data, dtype=np.float32)
    target_samples = int(np.round(arr.shape[1] * ratio.numerator / ratio.denominator))
    out = np.empty((arr.shape[0], target_samples), dtype=np.float32)
    for ch in range(arr.shape[0]):
        out[ch] = resample_poly(arr[ch], ratio.numerator, ratio.denominator).astype(np.float32)
    return out


def _bandpass(
    data: np.ndarray,
    sampling_rate: float,
) -> np.ndarray:
    from scipy.signal import butter, sosfiltfilt

    nyquist = sampling_rate / 2.0
    if HIGH_HZ >= nyquist:
        raise ValueError(
            f"Target sampling rate {sampling_rate:g} Hz has insufficient "
            f"Nyquist frequency for {HIGH_HZ:g} Hz filtering"
        )
    sos = butter(
        4,
        [LOW_HZ / nyquist, HIGH_HZ / nyquist],
        btype="band",
        output="sos",
    )
    # Channel-by-channel filtering avoids huge temporary allocations on cloud containers
    out = np.empty_like(data, dtype=np.float32)
    for ch in range(data.shape[0]):
        out[ch] = sosfiltfilt(sos, data[ch]).astype(np.float32)
    return out


def _common_average_reference(data: np.ndarray) -> np.ndarray:
    arr = np.asarray(data, dtype=np.float32)
    return arr - arr.mean(axis=0, keepdims=True)


def _normalize_window(window: np.ndarray) -> np.ndarray:
    x = np.asarray(window, dtype=np.float32)
    if x.shape != (19, WINDOW_SAMPLES):
        raise ValueError(
            f"Unexpected 10-second window shape {x.shape}; "
            f"expected (19,{WINDOW_SAMPLES})"
        )
    mean = x.mean(axis=1, keepdims=True)
    std = x.std(axis=1, keepdims=True)
    safe = np.where(std < 1e-6, 1.0, std)
    return np.clip((x - mean) / safe, -8.0, 8.0).astype(np.float32)


def _make_model_spectrogram(window_z: np.ndarray) -> np.ndarray:
    """Build the exact frozen [1,70,19] base spectrogram."""
    from scipy.signal import stft

    freq, _time, spectrum = stft(
        window_z,
        fs=CONTRACT_SAMPLING_RATE,
        window="hamming",
        nperseg=STFT_NPERSEG,
        noverlap=STFT_NOVERLAP,
        boundary=None,
        padded=False,
        axis=-1,
    )

    image = (np.abs(spectrum) ** 2).mean(axis=0)
    mask = (freq >= LOW_HZ) & (freq <= HIGH_HZ)
    image = np.log1p(image[mask])

    lo = float(np.percentile(image, 1))
    hi = float(np.percentile(image, 99))
    if hi <= lo:
        image = np.zeros_like(image, dtype=np.float32)
    else:
        image = np.clip(
            (image - lo) / (hi - lo),
            0.0,
            1.0,
        ).astype(np.float32)

    out = image[None, ...]
    if out.shape != (1, 70, 19):
        raise ValueError(
            f"Frozen STFT produced {out.shape}; expected (1,70,19)"
        )

    # Research Phase02 materialization stored the model input as float16 and
    # loaded it back as float32. Preserve that quantization parity.
    return out.astype(np.float16).astype(np.float32)


def _base_spectrograms(
    canonical_data: np.ndarray,
) -> tuple[np.ndarray, list[str]]:
    usable = (canonical_data.shape[-1] // WINDOW_SAMPLES) * WINDOW_SAMPLES
    if usable < WINDOW_SAMPLES:
        raise ValueError(
            f"Recording too short for one {WINDOW_SECONDS}s model window"
        )

    warnings: list[str] = []
    if usable != canonical_data.shape[-1]:
        warnings.append(
            f"Trimmed trailing {canonical_data.shape[-1] - usable} samples "
            "to whole 10-second windows"
        )

    data = canonical_data[:, :usable]
    n_windows = usable // WINDOW_SAMPLES
    specs = np.empty((n_windows, 1, 70, 19), dtype=np.float32)

    for idx in range(n_windows):
        start = idx * WINDOW_SAMPLES
        stop = start + WINDOW_SAMPLES
        normalized = _normalize_window(data[:, start:stop])
        specs[idx] = _make_model_spectrogram(normalized)

    return specs, warnings


def _profile_from_spectrograms(
    base_specs: np.ndarray,
    max_windows: int = PROFILE_MAX_WINDOWS,
) -> tuple[np.ndarray, np.ndarray]:
    n_windows = len(base_specs)
    if n_windows <= 0:
        raise ValueError("Cannot build router profile from zero windows")

    if n_windows > max_windows:
        indices = np.unique(
            np.linspace(
                0,
                n_windows - 1,
                max_windows,
            ).round().astype(int)
        )
    else:
        indices = np.arange(n_windows)

    sum_x = np.zeros(70, dtype=np.float64)
    sum_x2 = np.zeros(70, dtype=np.float64)
    n = 0

    for idx in indices:
        x = np.asarray(base_specs[idx, 0], dtype=np.float32)  # [70,19]
        sum_x += x.sum(axis=1)
        sum_x2 += (x.astype(np.float64) ** 2).sum(axis=1)
        n += x.shape[1]

    mu = sum_x / n
    ex2 = sum_x2 / n
    sd = np.sqrt(np.maximum(ex2 - mu**2, 1e-8))
    return mu.astype(np.float32), sd.astype(np.float32)


def _line_peak_ratio(
    frequency: np.ndarray,
    psd: np.ndarray,
    center: float,
) -> float:
    narrow = (frequency >= center - 0.5) & (frequency <= center + 0.5)
    local = (
        (frequency >= center - 5.0)
        & (frequency <= center + 5.0)
        & ~(
            (frequency >= center - 1.5)
            & (frequency <= center + 1.5)
        )
    )
    if not narrow.any() or not local.any():
        return 0.0
    numerator = float(np.mean(psd[narrow]))
    denominator = float(np.median(psd[local]))
    return numerator / max(denominator, 1e-30)


def _line_features(
    original_data: np.ndarray,
    sampling_rate: float,
    channel_names: list[str],
) -> dict[str, float]:
    """Match the frozen router's first-120-second 50/60-Hz evidence."""
    from scipy.signal import welch

    arr = np.asarray(original_data, dtype=np.float64)
    picks = [
        idx
        for idx, label in enumerate(channel_names)
        if (
            parse_bipolar_label(label) is not None
            or normalize_direct_channel(label) in CANONICAL_CHANNELS
        )
    ]
    if not picks:
        picks = list(range(min(32, arr.shape[0])))
    picks = picks[:32]

    stop = min(
        arr.shape[-1],
        max(1, int(round(POWERLINE_SAMPLE_SECONDS * float(sampling_rate)))),
    )
    data = arr[picks, :stop]
    data = data - data.mean(axis=1, keepdims=True)

    nperseg = min(
        max(64, int(round(float(sampling_rate) * 4))),
        data.shape[-1],
    )
    frequency, pxx = welch(
        data,
        fs=float(sampling_rate),
        nperseg=nperseg,
        axis=-1,
    )
    mean_psd = np.mean(pxx, axis=0)

    score50 = _line_peak_ratio(frequency, mean_psd, 50.0)
    score60 = _line_peak_ratio(frequency, mean_psd, 60.0)

    eps = 1e-8
    log50 = float(np.log1p(max(score50, 0.0)))
    log60 = float(np.log1p(max(score60, 0.0)))
    log_ratio = float(
        np.log((score50 + eps) / (score60 + eps))
    )
    return {
        "line_peak_ratio_50": float(score50),
        "line_peak_ratio_60": float(score60),
        "line_log50": log50,
        "line_log60": log60,
        "line_log_ratio_50_60": log_ratio,
        "line_abs_log_margin": float(abs(log_ratio)),
        "line_max_log_strength": float(max(log50, log60)),
    }


def _router_feature_vector(
    profile_mean: np.ndarray,
    montage_style: str,
    line: dict[str, float],
    assets: dict[str, Any],
) -> tuple[np.ndarray, float]:
    normalized_distance: dict[str, float] = {}
    for domain in ("tuh", "siena", "chb"):
        proto = assets["prototypes"][domain]
        raw = float(
            np.mean(
                np.abs(
                    (profile_mean - proto["center"])
                    / np.maximum(proto["scale"], 1e-12)
                )
            )
        )
        normalized_distance[domain] = raw / max(
            float(proto["radius"]),
            1e-6,
        )

    ordered = sorted(normalized_distance.values())
    nearest = float(ordered[0])
    second = float(ordered[1])

    values = {
        "montage_direct": float(montage_style == "direct_referential"),
        "montage_bipolar": float(montage_style == "bipolar_graph"),
        "montage_unknown": float(
            montage_style not in {"direct_referential", "bipolar_graph"}
        ),
        "line_log50": float(line["line_log50"]),
        "line_log60": float(line["line_log60"]),
        "line_log_ratio_50_60": float(line["line_log_ratio_50_60"]),
        "line_abs_log_margin": float(line["line_abs_log_margin"]),
        "line_max_log_strength": float(line["line_max_log_strength"]),
        "normalized_distance_tuh": normalized_distance["tuh"],
        "normalized_distance_siena": normalized_distance["siena"],
        "normalized_distance_chb": normalized_distance["chb"],
        "nearest_normalized_distance": nearest,
        "second_nearest_normalized_distance": second,
        "prototype_distance_margin": second - nearest,
        "tuh_minus_siena_distance": (
            normalized_distance["tuh"] - normalized_distance["siena"]
        ),
        "tuh_minus_chb_distance": (
            normalized_distance["tuh"] - normalized_distance["chb"]
        ),
        "siena_minus_chb_distance": (
            normalized_distance["siena"] - normalized_distance["chb"]
        ),
    }

    feature_columns = assets["router"]["feature_columns"]
    vector = np.asarray(
        [values[name] for name in feature_columns],
        dtype=np.float64,
    )
    return vector, nearest


def _select_route(
    profile_mean: np.ndarray,
    montage_style: str,
    line: dict[str, float],
    assets: dict[str, Any],
) -> str:
    router = assets["router"]
    x, nearest = _router_feature_vector(
        profile_mean,
        montage_style,
        line,
        assets,
    )
    z = (
        x - router["scaler_mean"]
    ) / np.maximum(router["scaler_scale"], 1e-12)
    logits = router["coef"] @ z + router["intercept"]
    route = str(router["classes"][int(np.argmax(logits))])

    if nearest > float(router["ood_threshold"]):
        route = "self"

    if route not in {"tuh", "siena", "chb", "self"}:
        raise ValueError(f"Frozen router returned unsupported route: {route}")
    return route


def _align(
    x: np.ndarray,
    source_mean: np.ndarray,
    source_std: np.ndarray,
    target_mean: np.ndarray,
    target_std: np.ndarray,
) -> np.ndarray:
    return (
        (x - source_mean[None, :, None])
        / np.maximum(source_std[None, :, None], 1e-6)
    ) * target_std[None, :, None] + target_mean[None, :, None]


def _apply_route(
    base_specs: np.ndarray,
    route: str,
    profile: tuple[np.ndarray, np.ndarray],
    assets: dict[str, Any],
) -> np.ndarray:
    t = assets["transforms"]
    output = np.empty_like(base_specs, dtype=np.float32)

    for idx, base in enumerate(base_specs):
        x = np.asarray(base, dtype=np.float32)
        if route == "tuh":
            transformed = x
        elif route == "siena":
            aligned = _align(
                x,
                t["siena_mean"],
                t["siena_std"],
                t["tuh_mean"],
                t["tuh_std"],
            )
            alpha = float(t["siena_alpha"])
            transformed = (1.0 - alpha) * x + alpha * aligned
        elif route == "chb":
            transformed = _align(
                x,
                t["chb_mean"],
                t["chb_std"],
                t["tuh_mean"],
                t["tuh_std"],
            )
        elif route == "self":
            own_mean, own_std = profile
            aligned = _align(
                x,
                own_mean,
                own_std,
                t["tuh_mean"],
                t["tuh_std"],
            )
            alpha = float(t["self_alpha"])
            transformed = (1.0 - alpha) * x + alpha * aligned
        else:
            raise ValueError(route)

        output[idx] = np.clip(
            transformed,
            0.0,
            1.0,
        ).astype(np.float32)

    if output.shape[1:] != (1, 70, 19) or not np.isfinite(output).all():
        raise ValueError("Frozen route transform produced invalid model input")
    return output


def _preprocess_block(payload: dict[str, Any]) -> dict[str, Any]:
    original = np.asarray(payload["data"], dtype=np.float64)
    sampling_rate = float(payload["sampling_rate"])
    channel_labels = [str(v) for v in payload["channel_labels"]]
    package_root = str(payload["package_root"])

    if (
        original.ndim != 2
        or original.shape[0] != len(channel_labels)
        or original.shape[-1] == 0
    ):
        raise ValueError("Invalid EEG matrix/channel metadata")
    if not np.isfinite(original).all():
        raise ValueError("EEG contains NaN/Inf")

    montage_style = inspect_montage_style(channel_labels)
    line = _line_features(
        original,
        sampling_rate,
        channel_labels,
    )

    harmonized = harmonize_signal(
        original,
        channel_labels,
    )
    warnings = list(harmonized.warnings)

    data = _resample(
        harmonized.data,
        sampling_rate,
        CONTRACT_SAMPLING_RATE,
    )
    if not np.isclose(sampling_rate, CONTRACT_SAMPLING_RATE):
        warnings.append(
            f"Resampled {sampling_rate:g} Hz -> {CONTRACT_SAMPLING_RATE} Hz"
        )

    data = _bandpass(data, CONTRACT_SAMPLING_RATE)
    data = _common_average_reference(data)

    base_specs, trim_warnings = _base_spectrograms(data)
    warnings.extend(trim_warnings)

    profile = _profile_from_spectrograms(base_specs)
    assets = _load_serving_assets(package_root)
    route = _select_route(
        profile[0],
        montage_style,
        line,
        assets,
    )
    model_inputs = _apply_route(
        base_specs,
        route,
        profile,
        assets,
    )

    return {
        "model_inputs": model_inputs.tobytes(),
        "model_shape": list(model_inputs.shape),
        "sampling_rate": CONTRACT_SAMPLING_RATE,
        "window_seconds": WINDOW_SECONDS,
        "windows_count": int(len(model_inputs)),
        "universal_route": route,
        "montage_style": harmonized.montage_style,
        "warnings": warnings,
    }


def _decode_result(payload: dict[str, Any]) -> PreprocessingResult:
    model_inputs = np.frombuffer(
        payload["model_inputs"],
        dtype=np.float32,
    ).reshape(payload["model_shape"])

    return PreprocessingResult(
        model_inputs=model_inputs,
        sampling_rate=int(payload["sampling_rate"]),
        window_seconds=int(payload["window_seconds"]),
        windows_count=int(payload["windows_count"]),
        universal_route=str(payload["universal_route"]),
        montage_style=str(payload["montage_style"]),
        warnings=list(payload.get("warnings", [])),
    )


async def preprocess_eeg(
    data: np.ndarray,
    sampling_rate: float,
    channel_labels: list[str],
    package_root: str,
) -> PreprocessingResult:
    """Run frozen raw-to-model-input preprocessing off the asyncio event loop."""
    payload = {
        "data": np.asarray(data, dtype=np.float64),
        "sampling_rate": float(sampling_rate),
        "channel_labels": [str(v) for v in channel_labels],
        "package_root": str(package_root),
    }
    result_payload = await run_cpu_bound(
        _preprocess_block,
        payload,
        task_name="frozen_eeg_preprocess",
    )
    return _decode_result(result_payload)
