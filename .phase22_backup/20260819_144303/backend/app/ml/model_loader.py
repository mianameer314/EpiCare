"""
ONNX Runtime loader for the frozen Phase21.5 seizure detector package.

The loader validates:
- package integrity through ModelRegistry,
- one input named `spectrogram` with tail shape [1, 70, 19],
- one probability output named `seizure_probability`,
- the frozen temporal threshold from temporal_policy.json,
- finite [0,1] warm-up output.

Dynamic ONNX batch dimensions are replaced with batch=1 during warm-up.
"""
from __future__ import annotations

import logging
from typing import Any

import numpy as np

from app.core.config import settings
from app.ml.contracts import ModelConfig
from app.ml.model_registry import (
    ModelPackage,
    ModelRegistry,
    RegistryStatus,
    get_model_registry,
)

logger = logging.getLogger(__name__)


class ModelLoadError(Exception):
    """Raised when the active frozen model cannot be loaded safely."""


def _build_session_options() -> Any:
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.intra_op_num_threads = settings.ONNX_INTRA_OP_THREADS
    options.inter_op_num_threads = settings.ONNX_INTER_OP_THREADS
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_cpu_mem_arena = True
    options.enable_mem_pattern = True
    options.log_severity_level = 3
    return options


def _frozen_temporal_config(package: ModelPackage) -> dict[str, object]:
    cfg = package.temporal_policy.get("configuration")
    if not isinstance(cfg, dict):
        raise ModelLoadError("temporal_policy.json lacks configuration object")

    required = {
        "smoothing_method",
        "smoothing_window",
        "threshold",
        "minimum_positive_run",
        "maximum_negative_gap",
    }
    missing = required - set(cfg)
    if missing:
        raise ModelLoadError(
            "Frozen temporal configuration missing: "
            + ", ".join(sorted(missing))
        )
    return dict(cfg)


class ModelLoader:
    """Loads the frozen ONNX model once and exposes its validated package."""

    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry
        self.session: Any | None = None
        self.config: ModelConfig | None = None
        self.package: ModelPackage | None = None
        self.version: str | None = None
        self.last_error: str | None = None

    @property
    def is_ready(self) -> bool:
        return (
            self.session is not None
            and self.config is not None
            and self.package is not None
            and self.registry.status == RegistryStatus.LOADED
        )

    def load(self) -> None:
        package = self.registry.load_active()
        if package is None:
            self.registry.status = RegistryStatus.UNAVAILABLE
            self.last_error = self.registry.last_error or "no active model available"
            logger.warning("Model loader: %s", self.last_error)
            return

        try:
            import onnxruntime as ort
        except ImportError as exc:
            self.registry.status = RegistryStatus.UNAVAILABLE
            self.last_error = f"onnxruntime not installed: {exc}"
            logger.error("Model loader: %s", self.last_error)
            return

        try:
            session = ort.InferenceSession(
                str(package.onnx_path),
                sess_options=_build_session_options(),
                providers=["CPUExecutionProvider"],
            )
            self._validate_graph(session, package)
            self._warm_up(session, package)

            temporal = _frozen_temporal_config(package)
            threshold = float(temporal["threshold"])
            declared_threshold = float(package.config.get("threshold", threshold))
            if not np.isclose(threshold, declared_threshold):
                raise ModelLoadError(
                    "model_config threshold disagrees with frozen temporal policy "
                    f"({declared_threshold} vs {threshold})"
                )

            self.session = session
            self.version = package.version
            self.package = package
            self.config = ModelConfig(
                name=str(
                    package.config.get(
                        "name",
                        "EpiCarePhase12SpectrogramCNN",
                    )
                ),
                version=package.version,
                input_names=[inp.name for inp in session.get_inputs()],
                output_names=[out.name for out in session.get_outputs()],
                threshold=threshold,
                aggregation=str(
                    package.config.get(
                        "aggregation",
                        "causal_temporal_policy",
                    )
                ),
                sampling_rate=int(package.config.get("sampling_rate", 256)),
                window_seconds=int(package.config.get("window_seconds", 10)),
                model_type=str(
                    package.config.get(
                        "model_type",
                        "single_input_2d_spectrogram_binary_classifier",
                    )
                ),
                temporal_policy=temporal,
            )
            self.registry.status = RegistryStatus.LOADED
            self.last_error = None
            logger.info(
                "Frozen seizure model loaded",
                extra={
                    "model": self.config.name,
                    "version": self.version,
                    "model_root": str(package.root),
                    "threshold": threshold,
                    "intra_op_threads": settings.ONNX_INTRA_OP_THREADS,
                    "inter_op_threads": settings.ONNX_INTER_OP_THREADS,
                },
            )
        except Exception as exc:
            self.registry.status = RegistryStatus.UNAVAILABLE
            self.session = None
            self.config = None
            self.package = None
            self.version = None
            self.last_error = str(exc)
            logger.error("Model loader: failed to load frozen model: %s", exc)

    def _validate_graph(self, session: Any, package: ModelPackage) -> None:
        inputs = session.get_inputs()
        outputs = session.get_outputs()

        if len(inputs) != 1:
            raise ModelLoadError(
                f"Frozen detector must have one ONNX input; got {len(inputs)}"
            )
        if len(outputs) != 1:
            raise ModelLoadError(
                f"Frozen detector must have one ONNX output; got {len(outputs)}"
            )

        input_meta = inputs[0]
        output_meta = outputs[0]

        if input_meta.name != "spectrogram":
            raise ModelLoadError(
                f"Unexpected ONNX input {input_meta.name!r}; expected 'spectrogram'"
            )
        if output_meta.name != "seizure_probability":
            raise ModelLoadError(
                "Unexpected ONNX output "
                f"{output_meta.name!r}; expected 'seizure_probability'"
            )

        shape = list(input_meta.shape)
        if len(shape) != 4 or shape[1:] != [1, 70, 19]:
            raise ModelLoadError(
                f"Unexpected ONNX spectrogram shape {shape}; "
                "expected [batch,1,70,19]"
            )

        expected_names = package.config.get("input_names", [])
        if list(expected_names) != ["spectrogram"]:
            raise ModelLoadError(
                "model_config.json does not declare the frozen single-input contract"
            )

    def _warm_up(self, session: Any, package: ModelPackage) -> None:
        input_meta = session.get_inputs()[0]

        # ONNX dynamic batch is represented as a string/symbol. Never pass that
        # symbolic shape to np.zeros.
        graph_shape = list(input_meta.shape)
        dummy_shape = [
            1 if not isinstance(dim, (int, np.integer)) or int(dim) <= 0 else int(dim)
            for dim in graph_shape
        ]
        if dummy_shape != [1, 1, 70, 19]:
            raise ModelLoadError(
                f"Cannot construct frozen-model warm-up input from {graph_shape}"
            )

        dummy = np.zeros(dummy_shape, dtype=np.float32)
        outputs = session.run(None, {input_meta.name: dummy})
        if not outputs:
            raise ModelLoadError("Warm-up produced no ONNX output")

        probability = np.asarray(outputs[0], dtype=np.float32)
        if probability.shape != (1, 1):
            raise ModelLoadError(
                f"Warm-up output shape {probability.shape}; expected (1,1)"
            )
        if not np.all(np.isfinite(probability)):
            raise ModelLoadError("Warm-up produced non-finite output")
        if float(probability.max()) > 1.0 or float(probability.min()) < 0.0:
            raise ModelLoadError("Warm-up output outside [0,1] probability range")


_loader: ModelLoader | None = None


def get_model_loader() -> ModelLoader:
    """Get the singleton loader and retry strict frozen-package loading when unavailable.

    This preserves the live backend's useful hot-load behavior (for example, when
    the serving package is copied after process startup) without restoring the old
    unsafe ONNX auto-discovery path. Every retry still passes through ModelRegistry's
    full Phase21.5 package/hash validation.
    """
    global _loader
    if _loader is None:
        _loader = ModelLoader(get_model_registry())
        _loader.load()
    elif not _loader.is_ready:
        _loader.load()
    return _loader
