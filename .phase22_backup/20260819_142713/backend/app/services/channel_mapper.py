"""
Frozen Phase19/21.5 EEG montage harmonization.

Supported deployment inputs:
1. Direct-referential recordings with the frozen 19 canonical electrodes.
   Only FZ and/or PZ may be imputed, using symmetric neighbors:
       FZ = (F3 + F4) / 2
       PZ = (P3 + P4) / 2
2. Structurally complete bipolar recordings, reconstructed into a
   pseudo-referential 19-electrode signal by least squares with one zero-mean
   gauge constraint per connected graph component.

No dataset name is used and no unsupported channel is silently fabricated.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
import re

import numpy as np

CANONICAL_CHANNELS: list[str] = [
    "FP1", "FP2", "F7", "F8", "F3", "F4", "T3", "T4", "C3", "C4",
    "T5", "T6", "P3", "P4", "O1", "O2", "FZ", "CZ", "PZ",
]
LATENT_GRAPH_ELECTRODES: list[str] = ["FT9", "FT10"]
GRAPH_ELECTRODES: list[str] = CANONICAL_CHANNELS + LATENT_GRAPH_ELECTRODES

ELECTRODE_ALIASES: dict[str, str] = {
    "T7": "T3",
    "T8": "T4",
    "P7": "T5",
    "P8": "T6",
    "T9": "FT9",
    "T10": "FT10",
    **{c: c for c in GRAPH_ELECTRODES},
}

DIRECT_IMPUTE: dict[str, tuple[str, str]] = {
    "FZ": ("F3", "F4"),
    "PZ": ("P3", "P4"),
}


@dataclass(frozen=True)
class HarmonizedSignal:
    data: np.ndarray
    montage_style: str
    warnings: list[str] = field(default_factory=list)


def clean_duplicate_suffix(name: str) -> str:
    value = str(name).strip()
    if value.count("-") >= 2:
        value = re.sub(r"-(\d+)$", "", value)
    return value


def normalize_electrode_token(token: str) -> str:
    value = str(token).upper().strip()
    value = re.sub(r"^EEG\s*", "", value)
    value = re.sub(r"\s+", "", value)
    value = re.sub(r"[^A-Z0-9]", "", value)
    return ELECTRODE_ALIASES.get(value, value)


def parse_bipolar_label(name: str) -> tuple[str, str] | None:
    value = clean_duplicate_suffix(name).upper().strip()
    value = re.sub(r"^EEG\s+", "", value)
    value = re.sub(r"\s+", "", value)
    value = re.sub(r"-(REF|LE|AVG|AR)$", "", value)
    parts = value.split("-")
    if len(parts) != 2:
        return None
    a = normalize_electrode_token(parts[0])
    b = normalize_electrode_token(parts[1])
    if a in GRAPH_ELECTRODES and b in GRAPH_ELECTRODES and a != b:
        return a, b
    return None


def normalize_direct_channel(name: str) -> str:
    value = str(name).upper().strip()
    value = re.sub(r"^EEG[\s:_-]*", "", value)
    value = re.sub(r"-(REF|LE|AVG|AR|A1|A2|M1|M2)$", "", value)
    value = re.sub(r"[^A-Z0-9]", "", value)
    return ELECTRODE_ALIASES.get(value, value)


# Backwards-compatible name used by some older tests/helpers.
def normalize_label(label: str) -> str:
    return normalize_direct_channel(label)


def inspect_montage_style(channel_names: list[str]) -> str:
    bipolar = sum(parse_bipolar_label(ch) is not None for ch in channel_names)
    direct = sum(
        normalize_direct_channel(ch) in CANONICAL_CHANNELS
        for ch in channel_names
    )
    if bipolar >= 10:
        return "bipolar_graph"
    if direct >= 17:
        return "direct_referential"
    return "unsupported_or_ambiguous"


def _direct_index_map(channel_names: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for idx, raw_name in enumerate(channel_names):
        canonical = normalize_direct_channel(raw_name)
        if canonical in CANONICAL_CHANNELS and canonical not in mapping:
            mapping[canonical] = idx
    return mapping


def harmonize_direct(
    data: np.ndarray,
    channel_names: list[str],
) -> HarmonizedSignal:
    arr = np.asarray(data, dtype=np.float64)
    if arr.ndim != 2 or arr.shape[0] != len(channel_names):
        raise ValueError("EEG data/channel-label dimensions do not match")

    mapping = _direct_index_map(channel_names)
    missing = [c for c in CANONICAL_CHANNELS if c not in mapping]
    unsupported_missing = [c for c in missing if c not in DIRECT_IMPUTE]
    if unsupported_missing:
        raise ValueError(
            "Direct-referential recording is missing required canonical "
            f"electrodes: {unsupported_missing}"
        )

    signal_by_channel: dict[str, np.ndarray] = {
        channel: arr[idx]
        for channel, idx in mapping.items()
    }
    warnings: list[str] = []

    for channel in missing:
        left, right = DIRECT_IMPUTE[channel]
        if left not in signal_by_channel or right not in signal_by_channel:
            raise ValueError(
                f"Cannot impute {channel}; required neighbors "
                f"{left}/{right} are unavailable"
            )
        signal_by_channel[channel] = (
            signal_by_channel[left] + signal_by_channel[right]
        ) / 2.0
        warnings.append(
            f"Frozen direct-montage imputation applied: "
            f"{channel}=({left}+{right})/2"
        )

    ordered = np.stack(
        [signal_by_channel[c] for c in CANONICAL_CHANNELS],
        axis=0,
    )
    if ordered.shape[0] != 19 or not np.isfinite(ordered).all():
        raise ValueError("Direct canonicalization produced invalid EEG values")

    return HarmonizedSignal(
        data=ordered.astype(np.float64, copy=False),
        montage_style="direct_referential",
        warnings=warnings,
    )


def _connected_components(
    nodes: list[str],
    edges: list[tuple[str, str]],
) -> list[list[str]]:
    adjacency = {node: set() for node in nodes}
    for a, b in edges:
        if a in adjacency and b in adjacency:
            adjacency[a].add(b)
            adjacency[b].add(a)

    seen: set[str] = set()
    components: list[list[str]] = []
    for node in nodes:
        if node in seen:
            continue
        stack = [node]
        seen.add(node)
        component: list[str] = []
        while stack:
            current = stack.pop()
            component.append(current)
            for neighbor in adjacency[current]:
                if neighbor not in seen:
                    seen.add(neighbor)
                    stack.append(neighbor)
        components.append(sorted(component))
    return components


def _graph_node_sort_key(node: str):
    if node in CANONICAL_CHANNELS:
        return (0, CANONICAL_CHANNELS.index(node))
    if node in LATENT_GRAPH_ELECTRODES:
        return (1, LATENT_GRAPH_ELECTRODES.index(node))
    return (2, str(node))


def _montage_plan(channel_names: list[str]) -> dict:
    edge_groups: dict[tuple[str, str], list[tuple[int, float, str]]] = defaultdict(list)

    for idx, label in enumerate(channel_names):
        pair = parse_bipolar_label(label)
        if pair is None:
            continue
        a, b = pair
        key = tuple(sorted((a, b)))
        sign = 1.0 if (a, b) == key else -1.0
        edge_groups[key].append((idx, sign, label))

    unique_edges = sorted(edge_groups)
    covered = sorted(
        {node for edge in unique_edges for node in edge},
        key=_graph_node_sort_key,
    )
    missing = [c for c in CANONICAL_CHANNELS if c not in covered]
    node_to_col = {node: idx for idx, node in enumerate(covered)}

    A = np.zeros((len(unique_edges), len(covered)), dtype=np.float64)
    for row, (a, b) in enumerate(unique_edges):
        A[row, node_to_col[a]] = 1.0
        A[row, node_to_col[b]] = -1.0

    components = _connected_components(covered, unique_edges) if covered else []
    rank = int(np.linalg.matrix_rank(A)) if A.size else 0
    expected_rank = len(covered) - len(components) if covered else 0

    return {
        "edge_groups": edge_groups,
        "unique_edges": unique_edges,
        "active_nodes": covered,
        "node_to_col": node_to_col,
        "target_indices": {
            c: node_to_col[c]
            for c in CANONICAL_CHANNELS
            if c in node_to_col
        },
        "missing_electrodes": missing,
        "A": A,
        "components": components,
        "rank": rank,
        "expected_rank": expected_rank,
        "structurally_usable": bool(
            not missing and unique_edges and rank == expected_rank
        ),
    }


def reconstruct_bipolar(
    data: np.ndarray,
    channel_names: list[str],
) -> HarmonizedSignal:
    arr = np.asarray(data, dtype=np.float64)
    if arr.ndim != 2 or arr.shape[0] != len(channel_names):
        raise ValueError("EEG data/channel-label dimensions do not match")

    plan = _montage_plan(channel_names)
    if plan["missing_electrodes"]:
        raise ValueError(
            "Bipolar graph cannot reconstruct required electrodes: "
            + ", ".join(plan["missing_electrodes"])
        )
    if not plan["structurally_usable"]:
        raise ValueError(
            "Bipolar montage graph is not structurally usable for the "
            "frozen reconstruction contract"
        )

    A = plan["A"]
    constraints = []
    for component in plan["components"]:
        row = np.zeros(len(plan["active_nodes"]), dtype=np.float64)
        for electrode in component:
            row[plan["node_to_col"][electrode]] = 1.0
        constraints.append(row)

    C = (
        np.stack(constraints)
        if constraints
        else np.empty((0, len(plan["active_nodes"])), dtype=np.float64)
    )
    pinv = np.linalg.pinv(np.vstack([A, C]))

    edge_observations = []
    for key in plan["unique_edges"]:
        aligned = [
            sign * arr[idx]
            for idx, sign, _label in plan["edge_groups"][key]
        ]
        edge_observations.append(
            np.mean(np.stack(aligned, axis=0), axis=0)
        )
    B = np.stack(edge_observations, axis=0)
    rhs = np.vstack(
        [B, np.zeros((C.shape[0], B.shape[1]), dtype=np.float64)]
    )
    potentials = pinv @ rhs

    target = np.stack(
        [
            potentials[plan["target_indices"][channel]]
            for channel in CANONICAL_CHANNELS
        ],
        axis=0,
    )
    if target.shape[0] != 19 or not np.isfinite(target).all():
        raise ValueError("Invalid pseudo-referential bipolar reconstruction")

    return HarmonizedSignal(
        data=target.astype(np.float64, copy=False),
        montage_style="bipolar_graph",
        warnings=[
            "Bipolar EEG reconstructed to frozen 19-channel "
            "pseudo-referential representation"
        ],
    )


def harmonize_signal(
    data: np.ndarray,
    channel_names: list[str],
) -> HarmonizedSignal:
    style = inspect_montage_style(channel_names)
    if style == "direct_referential":
        return harmonize_direct(data, channel_names)
    if style == "bipolar_graph":
        return reconstruct_bipolar(data, channel_names)
    raise ValueError(
        "EEG montage is unsupported or ambiguous for the frozen detector. "
        "Provide a compatible direct-referential or structurally complete "
        "bipolar recording."
    )


def map_channels(
    found_channels: list[str],
    max_missing: int = 0,
) -> tuple[list[int], list[str]]:
    """
    Legacy compatibility helper.

    Phase22 inference no longer uses this function because synthetic FZ/PZ and
    bipolar reconstruction cannot be represented by a simple index list.
    """
    del max_missing
    mapping = _direct_index_map(found_channels)
    missing = [c for c in CANONICAL_CHANNELS if c not in mapping]
    unsupported = [c for c in missing if c not in DIRECT_IMPUTE]
    if unsupported:
        raise ValueError(
            f"Missing required canonical channels: {unsupported}"
        )
    indices = [
        mapping[c]
        for c in CANONICAL_CHANNELS
        if c in mapping
    ]
    warnings = (
        [f"Frozen imputation required for: {missing}"]
        if missing
        else []
    )
    return indices, warnings
