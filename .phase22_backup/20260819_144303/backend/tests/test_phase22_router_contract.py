"""Frozen router/transform artifact contract tests."""
from pathlib import Path

import numpy as np

from app.services.eeg_preprocessing import (
    _apply_route,
    _load_serving_assets,
)


def _version_dir() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "models"
        / "seizure_detector"
        / "versions"
        / "v1"
    )


def test_router_assets_are_complete_and_frozen() -> None:
    assets = _load_serving_assets(str(_version_dir()))
    router = assets["router"]

    assert assets["router_meta"]["selected_candidate"] == "logistic_C_2"
    assert router["feature_columns"] == assets["router_meta"]["feature_columns"]
    assert router["coef"].shape[1] == 17
    assert np.isclose(router["ood_threshold"], 1.75)
    assert set(router["classes"]).issubset({"tuh", "siena", "chb"})


def test_frequency_route_formulas_match_frozen_artifacts() -> None:
    assets = _load_serving_assets(str(_version_dir()))
    t = assets["transforms"]

    rng = np.random.default_rng(123)
    base = rng.uniform(0, 1, size=(2, 1, 70, 19)).astype(np.float32)
    own_mu = base[:, 0].mean(axis=(0, 2))
    # profile std over all time pixels per frequency
    own_sd = base[:, 0].transpose(1, 0, 2).reshape(70, -1).std(axis=1)
    own_sd = np.maximum(own_sd, 1e-4).astype(np.float32)
    profile = (own_mu.astype(np.float32), own_sd)

    tuh = _apply_route(base, "tuh", profile, assets)
    np.testing.assert_array_equal(tuh, base)

    chb = _apply_route(base, "chb", profile, assets)
    expected_chb = (
        (base - t["chb_mean"][None, None, :, None])
        / np.maximum(t["chb_std"][None, None, :, None], 1e-6)
    ) * t["tuh_std"][None, None, :, None] + t["tuh_mean"][None, None, :, None]
    expected_chb = np.clip(expected_chb, 0, 1).astype(np.float32)
    np.testing.assert_allclose(chb, expected_chb, atol=1e-6, rtol=1e-6)
