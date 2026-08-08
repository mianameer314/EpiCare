"""
ML contracts — frozen input/output schema shared by every model version.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelConfig:
    """Runtime configuration parsed from model_config.json."""

    name: str
    version: str
    input_names: list[str] = field(default_factory=list)
    output_names: list[str] = field(default_factory=list)
    threshold: float = 0.5
    aggregation: str = "consecutive_min_2"
    sampling_rate: int = 256
    window_seconds: int = 10


@dataclass(frozen=True)
class InferenceResult:
    """A single inference result."""

    predicted_class: str  # seizure | no_seizure
    confidence: float
    probability: float
    positive_windows: int
    total_windows: int
    max_probability: float
    mean_probability: float
    window_probabilities: list[float]
    model_version: str
