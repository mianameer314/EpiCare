"""Phase22 tests for the frozen channel/montage contract."""
import numpy as np
import pytest

from app.services.channel_mapper import (
    CANONICAL_CHANNELS,
    harmonize_direct,
    harmonize_signal,
    inspect_montage_style,
    normalize_direct_channel,
    parse_bipolar_label,
    reconstruct_bipolar,
)


def test_frozen_canonical_channel_order() -> None:
    assert CANONICAL_CHANNELS == [
        "FP1","FP2","F7","F8","F3","F4","T3","T4","C3","C4",
        "T5","T6","P3","P4","O1","O2","FZ","CZ","PZ",
    ]


def test_aliases_follow_frozen_research_direction() -> None:
    assert normalize_direct_channel("EEG T7-REF") == "T3"
    assert normalize_direct_channel("T8") == "T4"
    assert normalize_direct_channel("P7") == "T5"
    assert normalize_direct_channel("P8") == "T6"
    assert normalize_direct_channel("Fz") == "FZ"


def test_direct_full_montage_exact_reorder() -> None:
    rng = np.random.default_rng(1)
    canonical = rng.normal(size=(19, 100))
    labels = list(reversed(CANONICAL_CHANNELS))
    data = canonical[::-1]
    result = harmonize_direct(data, labels)
    np.testing.assert_allclose(result.data, canonical)
    assert result.montage_style == "direct_referential"
    assert result.warnings == []


def test_direct_only_fz_pz_imputation_is_allowed() -> None:
    rng = np.random.default_rng(2)
    labels = [c for c in CANONICAL_CHANNELS if c not in {"FZ", "PZ"}]
    data = rng.normal(size=(len(labels), 50))
    result = harmonize_direct(data, labels)

    index = {name: i for i, name in enumerate(labels)}
    expected_fz = (data[index["F3"]] + data[index["F4"]]) / 2
    expected_pz = (data[index["P3"]] + data[index["P4"]]) / 2

    np.testing.assert_allclose(
        result.data[CANONICAL_CHANNELS.index("FZ")],
        expected_fz,
    )
    np.testing.assert_allclose(
        result.data[CANONICAL_CHANNELS.index("PZ")],
        expected_pz,
    )
    assert len(result.warnings) == 2


def test_direct_missing_other_channel_rejected() -> None:
    labels = [c for c in CANONICAL_CHANNELS if c != "O2"]
    data = np.zeros((len(labels), 100))
    with pytest.raises(ValueError, match="missing required canonical"):
        harmonize_direct(data, labels)


def test_bipolar_parser_and_style() -> None:
    assert parse_bipolar_label("EEG FP1-F7") == ("FP1", "F7")
    labels = [
        f"{CANONICAL_CHANNELS[i]}-{CANONICAL_CHANNELS[i+1]}"
        for i in range(len(CANONICAL_CHANNELS) - 1)
    ]
    assert inspect_montage_style(labels) == "bipolar_graph"


def test_bipolar_graph_reconstruction_recovers_zero_mean_potentials() -> None:
    rng = np.random.default_rng(3)
    potentials = rng.normal(size=(19, 64))
    labels = []
    bipolar_rows = []

    # A connected chain covering all 19 canonical electrodes.
    for i in range(len(CANONICAL_CHANNELS) - 1):
        a = CANONICAL_CHANNELS[i]
        b = CANONICAL_CHANNELS[i + 1]
        labels.append(f"{a}-{b}")
        bipolar_rows.append(potentials[i] - potentials[i + 1])

    bipolar = np.stack(bipolar_rows)
    result = reconstruct_bipolar(bipolar, labels)

    expected = potentials - potentials.mean(axis=0, keepdims=True)
    np.testing.assert_allclose(result.data, expected, atol=1e-10, rtol=1e-10)


def test_unsupported_montage_rejected() -> None:
    data = np.zeros((5, 100))
    labels = ["X1", "X2", "X3", "X4", "X5"]
    with pytest.raises(ValueError, match="unsupported or ambiguous"):
        harmonize_signal(data, labels)
