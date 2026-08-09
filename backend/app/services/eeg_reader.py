"""
EEG reader — parses EDF/EDF+/CSV uploads into the canonical processing
shape (channels, samples) plus sampling rate and channel labels.

MNE is imported lazily so the app boots without ML/EEG dependencies; the
heavy parse runs in the process pool (app.ml.executor.run_cpu_bound) so
large files never block the event loop.
"""
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.core.exceptions import error_response
from app.ml.executor import run_cpu_bound

logger = logging.getLogger(__name__)

_CSV_CHANNEL_RE = re.compile(r"^(eeg\s*)?(ch|channel)?\s*[a-z0-9_.\- ]+$", re.IGNORECASE)


@dataclass
class EegReadResult:
    """Parsed EEG matrix and its metadata."""

    data: np.ndarray  # (channels, samples) float64
    sampling_rate: float
    channel_labels: list[str]
    source_format: str


def _read_edf_block(file_path: str) -> dict[str, Any]:
    """Parse an EDF/EDF+ file with MNE (CPU-bound)."""
    try:
        import mne
    except ImportError as exc:
        raise ValueError("EDF support requires MNE (pip install mne)") from exc

    raw = mne.io.read_raw_edf(file_path, preload=True, verbose="ERROR")
    data, times = raw[:, :]
    channel_labels = [str(ch).upper() for ch in raw.ch_names]
    sfreq = float(raw.info["sfreq"])
    return {
        "data": np.asarray(data, dtype=np.float64),
        "sampling_rate": sfreq,
        "channel_labels": channel_labels,
        "source_format": "edf",
    }


def _read_csv_block(file_path: str) -> dict[str, Any]:
    """
    Parse a CSV export into (channels, samples).

    Supported layouts:
      - Header row of channel names, rows are samples (long format).
      - No header: numeric matrix with generated channel labels.
    """
    try:
        values = np.genfromtxt(file_path, delimiter=",", dtype=np.float64)
    except Exception as exc:
        raise ValueError(f"Could not parse CSV: {exc}") from exc

    if values.ndim != 2 or values.shape[0] == 0 or values.shape[1] == 0:
        raise ValueError("CSV must contain a 2D numeric matrix (channels x samples)")

    # Detect a header row: first row contains non-numeric cells.
    with open(file_path, "r", encoding="utf-8", errors="replace") as handle:
        first_line = handle.readline()

    first_cells = [cell.strip() for cell in first_line.split(",")]
    has_header = len(first_cells) == values.shape[1] and not all(
        _is_numeric(cell) for cell in first_cells
    )

    if has_header:
        channel_labels = [label.strip().upper() for label in first_cells]
        data = values
    else:
        channel_labels = [f"CH{idx + 1}" for idx in range(values.shape[0])]
        data = values

    sampling_rate = _infer_csv_sampling_rate(first_line)
    return {
        "data": np.asarray(data, dtype=np.float64),
        "sampling_rate": sampling_rate,
        "channel_labels": channel_labels,
        "source_format": "csv",
    }


def _is_numeric(cell: str) -> bool:
    """Best-effort numeric check for header detection."""
    try:
        float(cell)
        return True
    except ValueError:
        return False


def _infer_csv_sampling_rate(header_line: str) -> float:
    """
    Look for a sampling-rate hint in the CSV header/first line.

    Supports: `sampling_rate=256`, `sf=256`, `fs:256`, `256 Hz`.
    Defaults to 256 Hz (contract) when no hint is found.
    """
    match = re.search(r"(?:sampling[_-]?rate|sf|fs|hz)\s*[=:]\s*([0-9.]+)", header_line, re.IGNORECASE)
    if match:
        return float(match.group(1))
    hz_match = re.search(r"([0-9.]+)\s*hz", header_line, re.IGNORECASE)
    if hz_match:
        return float(hz_match.group(1))
    return 256.0


def _read_block(payload: dict[str, Any]) -> dict[str, Any]:
    """Dispatch to the right parser (process-pool entry point)."""
    file_path = payload["file_path"]
    extension = payload["extension"].lower()
    path = Path(file_path)
    if not path.exists():
        raise ValueError("Stored file missing from disk")

    if extension == ".edf":
        return _read_edf_block(file_path)
    if extension == ".csv":
        return _read_csv_block(file_path)
    raise ValueError(f"Unsupported EEG extension: {extension}")


async def read_eeg_file(file_path: str, extension: str) -> EegReadResult:
    """
    Parse a stored EEG file (EDF/CSV) off the event loop.

    Args:
        file_path: absolute path to the stored file.
        extension: lowercased file extension including the dot ('.edf' | '.csv').

    Raises:
        HTTPException(400): parse errors surface as INVALID_EEG_FILE.
    """
    try:
        payload = await run_cpu_bound(
            _read_block,
            {"file_path": file_path, "extension": extension},
            task_name="eeg_read",
        )
    except Exception as exc:
        logger.warning("eeg_read_failed: %s", exc)
        raise error_response(
            code="INVALID_EEG_FILE",
            message="The uploaded EEG file could not be read.",
            details=str(exc),
            status_code=400,
        ) from exc

    return EegReadResult(
        data=np.asarray(payload["data"], dtype=np.float64),
        sampling_rate=float(payload["sampling_rate"]),
        channel_labels=list(payload["channel_labels"]),
        source_format=str(payload["source_format"]),
    )
