"""Backend ONNX parity against the Phase21.5 CHB-validation model fixture."""
from pathlib import Path

import numpy as np

from app.ml.inference import _run_session
from app.ml.model_loader import ModelLoader
from app.ml.model_registry import ModelRegistry


EXPECTED_ONNX_SHA = (
    "55d8bffc9389963bbafa02151756f0939467393cbe672b983c5d3a2be2db65ce"
)


def _registry_root() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "models"
        / "seizure_detector"
    )


def test_registry_and_loader_accept_phase21_5_package() -> None:
    registry = ModelRegistry(str(_registry_root()))
    loader = ModelLoader(registry)
    loader.load()

    assert loader.is_ready, loader.last_error
    assert loader.version == "v1"
    assert loader.package is not None
    assert loader.config is not None
    assert loader.config.name == "EpiCarePhase12SpectrogramCNN"
    assert loader.config.input_names == ["spectrogram"]
    assert loader.config.output_names == ["seizure_probability"]
    assert loader.config.threshold == 0.30


def test_phase22_model_input_fixture_probability_parity() -> None:
    registry = ModelRegistry(str(_registry_root()))
    loader = ModelLoader(registry)
    loader.load()
    assert loader.is_ready, loader.last_error
    assert loader.package is not None
    assert loader.session is not None
    assert loader.config is not None

    fixture_path = loader.package.model_fixture_path
    with np.load(fixture_path, allow_pickle=True) as z:
        x = np.asarray(z["spectrogram"], dtype=np.float32)
        expected = np.asarray(z["expected_probability"], dtype=np.float32)
        expected_binary = np.asarray(
            z["expected_threshold_binary"],
            dtype=np.int8,
        )

    actual = np.asarray(
        _run_session(loader.session, loader.config, x),
        dtype=np.float32,
    )

    assert x.shape[1:] == (1, 70, 19)
    assert actual.shape == expected.shape
    diff = np.abs(actual - expected)
    assert float(diff.max()) <= 1e-6
    assert float(diff.mean()) <= 2e-7

    actual_binary = (actual >= loader.config.threshold).astype(np.int8)
    np.testing.assert_array_equal(actual_binary, expected_binary)
