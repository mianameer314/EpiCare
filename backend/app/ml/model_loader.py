"""
Model loader — ONNX Runtime session with explicit thread tuning and warm-up.

SessionOptions are configured explicitly (intra/inter op threads) to prevent
CPU thrashing when concurrent inference requests arrive. The server must be
able to start even when the model is missing: loader.status reflects
readiness and EEG inference returns 503 when unavailable.
"""
import logging
from typing import Any

import numpy as np

from app.core.config import settings
from app.ml.contracts import ModelConfig
from app.ml.model_registry import ModelPackage, ModelRegistry, RegistryStatus, get_model_registry

logger = logging.getLogger(__name__)


class ModelLoadError(Exception):
    """Raised when the active model cannot be loaded or fails warm-up."""


def _build_session_options() -> Any:
    """Build explicitly-tuned ONNX Runtime SessionOptions."""
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.intra_op_num_threads = settings.ONNX_INTRA_OP_THREADS
    options.inter_op_num_threads = settings.ONNX_INTER_OP_THREADS
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.enable_cpu_mem_arena = True
    options.enable_mem_pattern = True
    options.log_severity_level = 3  # suppress ORT noise; app logger owns observability
    return options


class ModelLoader:
    """Loads the active ONNX model once and runs a warm-up inference."""

    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry
        self.session: Any | None = None
        self.config: ModelConfig | None = None
        self.version: str | None = None
        self.last_error: str | None = None

    @property
    def is_ready(self) -> bool:
        """True when the session is loaded and warm-up passed."""
        return self.session is not None and self.registry.status == RegistryStatus.LOADED

    def load(self) -> None:
        """Load the active model package into a tuned ONNX Runtime session."""
        package = self.registry.load_active()
        if package is None:
            self.registry.status = RegistryStatus.UNAVAILABLE
            self.last_error = "no active model available"
            logger.warning("Model loader: %s", self.last_error)
            return

        try:
            import onnxruntime as ort  # lazy import keeps app bootable without ML deps
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
            self._validate_inputs(session, package)
            self._warm_up(session, package)

            self.session = session
            self.version = package.version
            self.config = ModelConfig(
                name=str(package.config.get("name", settings.MODEL_NAME)),
                version=package.version,
                input_names=[inp.name for inp in session.get_inputs()],
                output_names=[out.name for out in session.get_outputs()],
                threshold=float(package.config.get("threshold", 0.5)),
            )
            self.registry.status = RegistryStatus.LOADED
            self.last_error = None
            logger.info(
                "Model loaded",
                extra={
                    "model": settings.MODEL_NAME,
                    "version": self.version,
                    "intra_op_threads": settings.ONNX_INTRA_OP_THREADS,
                    "inter_op_threads": settings.ONNX_INTER_OP_THREADS,
                },
            )
        except Exception as exc:
            self.registry.status = RegistryStatus.UNAVAILABLE
            self.session = None
            self.last_error = str(exc)
            logger.error("Model loader: failed to load active model: %s", exc)

    def _validate_inputs(self, session: Any, package: ModelPackage) -> None:
        """Ensure the expected input names exist in the ONNX graph."""
        expected = package.config.get("input_names")
        if not expected:
            logger.warning("Model loader: no input_names declared; skipping graph check")
            return
        actual = {inp.name for inp in session.get_inputs()}
        missing = [name for name in expected if name not in actual]
        if missing:
            raise ModelLoadError(f"ONNX graph missing inputs: {missing}")

    def _warm_up(self, session: Any, package: ModelPackage) -> None:
        """Run a dummy inference and verify finite probability output in [0, 1]."""
        input_meta = session.get_inputs()[0]
        dummy = np.zeros(input_meta.shape, dtype=np.float32)
        outputs = session.run(None, {input_meta.name: dummy})
        if not outputs or not np.all(np.isfinite(outputs[0])):
            raise ModelLoadError("Warm-up produced non-finite output")
        if float(outputs[0].max()) > 1.0 or float(outputs[0].min()) < 0.0:
            raise ModelLoadError("Warm-up output outside [0, 1] probability range")


_loader: ModelLoader | None = None


def get_model_loader() -> ModelLoader:
    """Get the singleton model loader with hot-reload auto detection."""
    global _loader
    if _loader is None:
        _loader = ModelLoader(get_model_registry())
        _loader.load()
    elif not _loader.is_ready:
        # Dynamically auto-detect if model weights were recently placed in the directory
        _loader.load()
    return _loader
