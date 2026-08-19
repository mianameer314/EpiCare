"""
Phase22 no-DB preflight for the frozen EpiCare seizure detector backend.

Run from backend/:
    python scripts/phase22_preflight.py

This checks package integrity, ONNX fixture parity, temporal fixture parity, and
a synthetic raw direct-referential preprocessing smoke test.
"""
from __future__ import annotations

import json
from pathlib import Path
import sys

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ml.inference import _run_session, apply_temporal_policy
from app.ml.model_loader import ModelLoader
from app.ml.model_registry import ModelRegistry
from app.services.channel_mapper import CANONICAL_CHANNELS
from app.services.eeg_preprocessing import _preprocess_block


def main() -> int:
    registry_root = REPO_ROOT / "models" / "seizure_detector"
    registry = ModelRegistry(str(registry_root))
    loader = ModelLoader(registry)
    loader.load()

    if not loader.is_ready:
        raise RuntimeError(f"Model loader unavailable: {loader.last_error}")
    assert loader.package is not None
    assert loader.session is not None
    assert loader.config is not None

    print("1/4 Model package + ONNX loader: PASS")
    print("    model:", loader.config.name)
    print("    version:", loader.version)
    print("    threshold:", loader.config.threshold)
    print("    root:", loader.package.root)

    with np.load(loader.package.model_fixture_path, allow_pickle=True) as z:
        fixture_x = np.asarray(z["spectrogram"], dtype=np.float32)
        expected = np.asarray(z["expected_probability"], dtype=np.float32)

    actual = np.asarray(
        _run_session(loader.session, loader.config, fixture_x),
        dtype=np.float32,
    )
    diff = np.abs(actual - expected)
    if float(diff.max()) > 1e-6:
        raise RuntimeError(
            f"Model fixture parity failed: max_abs_diff={float(diff.max())}"
        )
    print("2/4 Model-input fixture parity: PASS")
    print("    max_abs_diff:", float(diff.max()))

    temporal_fixture = json.loads(
        loader.package.temporal_fixture_path.read_text(encoding="utf-8")
    )
    for case in temporal_fixture["cases"]:
        smoothed, binary, events = apply_temporal_policy(
            case["raw_probability"],
            temporal_fixture["configuration"],
        )
        np.testing.assert_allclose(
            smoothed,
            case["expected_smoothed_probability"],
            atol=1e-12,
            rtol=0,
        )
        if binary.tolist() != case["expected_binary"]:
            raise RuntimeError("Temporal binary fixture mismatch")
        if events != case["expected_events"]:
            raise RuntimeError("Temporal event fixture mismatch")
    print("3/4 Frozen temporal fixture parity: PASS")

    # Deterministic 30-second synthetic direct-referential EEG.
    rng = np.random.default_rng(2201)
    seconds = 30
    samples = seconds * 256
    t = np.arange(samples, dtype=np.float64) / 256.0
    data = []
    for idx in range(19):
        signal = (
            20e-6 * np.sin(2 * np.pi * (8.0 + idx * 0.1) * t)
            + 2e-6 * rng.standard_normal(samples)
        )
        data.append(signal)
    raw = np.stack(data)

    processed = _preprocess_block(
        {
            "data": raw,
            "sampling_rate": 256.0,
            "channel_labels": CANONICAL_CHANNELS,
            "package_root": str(loader.package.root),
        }
    )
    shape = tuple(processed["model_shape"])
    if shape != (3, 1, 70, 19):
        raise RuntimeError(f"Synthetic preprocessing shape mismatch: {shape}")
    if processed["universal_route"] not in {"tuh", "siena", "chb", "self"}:
        raise RuntimeError("Synthetic router returned unsupported route")
    print("4/4 Raw preprocessing + frozen router smoke: PASS")
    print("    shape:", shape)
    print("    montage:", processed["montage_style"])
    print("    route:", processed["universal_route"])

    print()
    print("=" * 88)
    print("PHASE22 PREFLIGHT PASS")
    print("Backend frozen-model contract is ready for pytest/API integration tests.")
    print("=" * 88)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
