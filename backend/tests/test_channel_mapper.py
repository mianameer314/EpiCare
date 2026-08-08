"""
Unit tests for the canonical channel mapper.
"""
import pytest

from app.services.channel_mapper import CANONICAL_CHANNELS, map_channels, normalize_label


def test_normalize_label_handles_variants() -> None:
    assert normalize_label(" Fp1 ") == "Fp1"
    assert normalize_label("FP1") == "Fp1"
    assert normalize_label("T3") == "T7"
    assert normalize_label("T4") == "T8"
    assert normalize_label("Cz.") == "Cz"
    assert normalize_label("O2") == "O2"


def test_map_channels_full_set() -> None:
    indices, warnings = map_channels(CANONICAL_CHANNELS)
    assert indices == list(range(len(CANONICAL_CHANNELS)))
    assert warnings == []


def test_map_channels_reordered() -> None:
    reversed_channels = list(reversed(CANONICAL_CHANNELS))
    indices, warnings = map_channels(reversed_channels)
    assert len(indices) == len(CANONICAL_CHANNELS)
    assert len(set(indices)) == len(CANONICAL_CHANNELS)  # no duplicates
    assert warnings == []


def test_map_channels_alias_lookup() -> None:
    aliased = ["Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8",
               "T3", "C3", "Cz", "C4", "T4",
               "P7", "P3", "Pz", "P4", "P8", "O1", "O2"]
    indices, warnings = map_channels(aliased)
    assert warnings == []
    # T3 -> T7, T4 -> T8 must resolve to the canonical rows
    assert indices[7] == 7  # T7 position
    assert indices[11] == 11  # T8 position


def test_map_channels_missing_below_limit_warns() -> None:
    missing_one = CANONICAL_CHANNELS[:18]  # drop O2
    indices, warnings = map_channels(missing_one)
    assert len(indices) == 18
    assert warnings and "Missing channels interpolated" in warnings[0]


def test_map_channels_too_many_missing_raises() -> None:
    few = CANONICAL_CHANNELS[:5]
    with pytest.raises(ValueError, match="Too many required channels missing"):
        map_channels(few)
