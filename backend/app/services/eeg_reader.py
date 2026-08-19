"""
EEG reader for EDF/EDF+ and labeled CSV uploads.

EDF is read through MNE. CSV serving requires an explicit channel-name header;
unlabeled CH1/CH2/... data cannot satisfy the frozen montage contract and is
therefore rejected rather than silently guessed.
"""
from __future__ import annotations

from dataclasses import dataclass
from io import StringIO
import logging
from pathlib import Path
import re
from typing import Any

import numpy as np

from app.core.exceptions import error_response
from app.ml.executor import run_cpu_bound

logger = logging.getLogger(__name__)


@dataclass
class EegReadResult:
    data: np.ndarray  # [channels,samples] float64
    sampling_rate: float
    channel_labels: list[str]
    source_format: str


def _read_edf_block(file_path: str) -> dict[str, Any]:
    try:
        import mne
    except ImportError as exc:
        raise ValueError("EDF support requires MNE (pip install mne)") from exc

    raw = mne.io.read_raw_edf(file_path, preload=True, verbose="ERROR")
    try:
        data = raw.get_data()
        channel_labels = [str(ch).upper() for ch in raw.ch_names]
        sfreq = float(raw.info["sfreq"])
    finally:
        close = getattr(raw, "close", None)
        if callable(close):
            close()

    return {
        "data": np.asarray(data, dtype=np.float32),
        "sampling_rate": sfreq,
        "channel_labels": channel_labels,
        "source_format": "edf",
    }


def _is_numeric(cell: str) -> bool:
    try:
        float(cell)
        return True
    except ValueError:
        return False


def _infer_csv_sampling_rate(text: str) -> float:
    patterns = (
        r"(?:sampling[_-]?rate|sf|fs)\s*[=:]\s*([0-9.]+)",
        r"([0-9.]+)\s*hz",
    )
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return float(match.group(1))
    return 256.0


def _read_csv_block(file_path: str) -> dict[str, Any]:
    """
    Parse a labeled CSV.

    Supported example:

        # sampling_rate=256
        FP1,FP2,F7,F8,...,PZ
        0.01,0.02,...
        ...

    Numeric rows are samples; columns are EEG channels.
    """
    text = Path(file_path).read_text(encoding="utf-8-sig", errors="replace")
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError("CSV is empty")

    metadata_lines = [line for line in lines if line.lstrip().startswith("#")]
    data_lines = [line for line in lines if not line.lstrip().startswith("#")]
    if len(data_lines) < 2:
        raise ValueError("CSV must contain a channel header and numeric samples")

    header_cells = [cell.strip() for cell in data_lines[0].split(",")]
    has_header = bool(header_cells) and not all(
        _is_numeric(cell) for cell in header_cells
    )
    if not has_header:
        raise ValueError(
            "CSV EEG requires an explicit channel-name header for the frozen "
            "19-channel serving contract"
        )

    numeric_text = "\n".join(data_lines[1:])
    values = np.genfromtxt(
        StringIO(numeric_text),
        delimiter=",",
        dtype=np.float64,
    )
    if values.ndim == 1:
        values = values[None, :]
    if values.ndim != 2 or values.size == 0:
        raise ValueError("CSV numeric body must be a 2D samples-by-channels matrix")
    if values.shape[1] != len(header_cells):
        raise ValueError(
            "CSV channel header count does not match numeric column count"
        )
    if not np.isfinite(values).all():
        raise ValueError("CSV EEG contains non-numeric/NaN/Inf samples")

    sampling_rate = _infer_csv_sampling_rate(
        "\n".join(metadata_lines + [data_lines[0]])
    )

    return {
        "data": np.asarray(values.T, dtype=np.float32),
        "sampling_rate": float(sampling_rate),
        "channel_labels": [label.upper() for label in header_cells],
        "source_format": "csv",
    }


def _read_block(payload: dict[str, Any]) -> dict[str, Any]:
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
        data=np.asarray(payload["data"], dtype=np.float32),
        sampling_rate=float(payload["sampling_rate"]),
        channel_labels=list(payload["channel_labels"]),
        source_format=str(payload["source_format"]),
    )
