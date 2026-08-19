"""CSV reader tests for the frozen serving input contract."""
from pathlib import Path

import numpy as np
import pytest

from app.services.eeg_reader import _read_csv_block
from app.services.channel_mapper import CANONICAL_CHANNELS


def test_labeled_csv_is_transposed_to_channels_by_samples(tmp_path: Path) -> None:
    path = tmp_path / "eeg.csv"
    rows = [
        "# sampling_rate=256",
        ",".join(CANONICAL_CHANNELS),
        ",".join(["1"] * 19),
        ",".join(["2"] * 19),
        ",".join(["3"] * 19),
    ]
    path.write_text("\n".join(rows), encoding="utf-8")

    result = _read_csv_block(str(path))
    assert result["sampling_rate"] == 256.0
    assert result["channel_labels"] == CANONICAL_CHANNELS
    assert result["data"].shape == (19, 3)
    np.testing.assert_array_equal(result["data"][:, 0], 1.0)
    np.testing.assert_array_equal(result["data"][:, 2], 3.0)


def test_unlabeled_csv_is_rejected_instead_of_guessing_channels(
    tmp_path: Path,
) -> None:
    path = tmp_path / "unlabeled.csv"
    path.write_text("1,2,3\n4,5,6\n", encoding="utf-8")
    with pytest.raises(ValueError, match="explicit channel-name header"):
        _read_csv_block(str(path))
