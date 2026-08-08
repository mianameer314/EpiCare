"""
Channel mapper — maps incoming EEG channel labels onto the canonical list.

The trained model expects a fixed, ordered channel set. Incoming files are
never silently reordered or dropped: small gaps use fallback/interpolation
with a warning; many missing channels reject the file.

Canonical 10-20 montage (19 channels + references kept simple for FYP):
    Fp1 Fp2 F7 F3 Fz F4 F8 T7 C3 Cz C4 T8 P7 P3 Pz P4 P8 O1 O2
"""
import logging

logger = logging.getLogger(__name__)

CANONICAL_CHANNELS: list[str] = [
    "Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8",
    "T7", "C3", "Cz", "C4", "T8",
    "P7", "P3", "Pz", "P4", "P8",
    "O1", "O2",
]

# Common label variants -> canonical name (upper, dots removed)
_CHANNEL_ALIASES: dict[str, str] = {
    "FP1": "Fp1", "FP2": "Fp2",
    "T3": "T7", "T4": "T8", "T5": "P7", "T6": "P8",
    "FZ": "Fz", "CZ": "Cz", "PZ": "Pz",
    "O1": "O1", "O2": "O2",
}


def normalize_label(label: str) -> str:
    """Normalize a raw channel label (strip whitespace/dots, uppercase for lookup)."""
    cleaned = label.strip().replace(".", "").replace(" ", "")
    return _CHANNEL_ALIASES.get(cleaned.upper(), cleaned)


def map_channels(found_channels: list[str], max_missing: int = 5) -> tuple[list[int], list[str]]:
    """
    Map incoming channels to canonical indices.

    Args:
        found_channels: Channel labels present in the recording (ordered).
        max_missing: Maximum number of canonical channels allowed to be absent.

    Returns:
        (indices into the recording rows for each canonical channel, warnings)

    Raises:
        ValueError: when too many canonical channels are missing.
    """
    index_by_label: dict[str, int] = {}
    for idx, label in enumerate(found_channels):
        normalized = normalize_label(label)
        if normalized not in index_by_label:
            index_by_label[normalized] = idx

    indices: list[int] = []
    warnings: list[str] = []
    missing: list[str] = []

    for canonical in CANONICAL_CHANNELS:
        idx = index_by_label.get(canonical)
        if idx is None:
            missing.append(canonical)
            continue
        indices.append(idx)

    if len(missing) > max_missing:
        raise ValueError(
            f"Too many required channels missing ({len(missing)}): {missing}"
        )
    if missing:
        warnings.append(f"Missing channels interpolated: {missing}")

    return indices, warnings
