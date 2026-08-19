"""
ML contracts for the frozen EpiCare Phase12 seizure detector serving pipeline.

The deployed model has one ONNX input:
    spectrogram: float32 [batch, 1, 70, 19]
and one output:
    seizure_probability: float32 [batch, 1]

The temporal policy is part of the immutable model package, not an application
tuning parameter.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelConfig:
    """Runtime configuration parsed from the active frozen model package."""

    name: str
    version: str
    input_names: list[str] = field(default_factory=list)
    output_names: list[str] = field(default_factory=list)
    threshold: float = 0.30
    aggregation: str = "causal_temporal_policy"
    sampling_rate: int = 256
    window_seconds: int = 10
    model_type: str = "single_input_2d_spectrogram_binary_classifier"
    temporal_policy: dict[str, object] = field(default_factory=dict)


@dataclass(frozen=True)
class InferenceResult:
    """Frozen-model inference result for one uploaded EEG recording."""

    predicted_class: str  # seizure | no_seizure
    confidence: float
    probability: float
    threshold: float
    positive_windows: int
    total_windows: int
    event_count: int
    max_probability: float
    mean_probability: float
    window_probabilities: list[float]
    smoothed_window_probabilities: list[float]
    positive_event_ranges: list[dict[str, int]]
    model_version: str
