"""Exact parity against the Phase21.5 frozen temporal fixture."""
import json
from pathlib import Path

import numpy as np

from app.ml.inference import apply_temporal_policy


def _version_dir() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "models"
        / "seizure_detector"
        / "versions"
        / "v1"
    )


def test_frozen_temporal_fixture_parity() -> None:
    path = _version_dir() / "phase22_temporal_fixture.json"
    assert path.exists(), f"Missing Phase21.5 fixture: {path}"

    fixture = json.loads(path.read_text(encoding="utf-8"))
    policy = fixture["configuration"]

    assert policy == {
        "smoothing_method": "causal_mean",
        "smoothing_window": 3,
        "ema_alpha": 0.5,
        "threshold": 0.3,
        "minimum_positive_run": 1,
        "maximum_negative_gap": 0,
    }

    for case in fixture["cases"]:
        smoothed, binary, events = apply_temporal_policy(
            case["raw_probability"],
            policy,
        )
        np.testing.assert_allclose(
            smoothed,
            np.asarray(case["expected_smoothed_probability"], dtype=float),
            atol=1e-12,
            rtol=0,
        )
        assert binary.tolist() == case["expected_binary"]
        assert events == case["expected_events"]
