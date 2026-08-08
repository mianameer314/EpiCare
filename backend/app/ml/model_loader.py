"""
Model loader — lazy ONNX Runtime session management with warm-up validation.

The server must be able to start even when the model is missing or broken:
    - loader.status reflects readiness
    - EEG inference endpoints return 503 when the model is unavailable
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


class ModelLoader:
    """Loads the active ONNX model once and runs a warm-up inference."""

    def __init__(self, registry: ModelRegistry) -> None:
        self.registry = registry
        self.session: Any | None = None
        self.config: ModelConfig | None = None
        self.version: str | None = None

    @property
    def is_ready(self) -> bool:
        """True when the session is loaded and warm-up passed."""
        return self.session is not None and self.registry.status == RegistryStatus.LOADED

    def load(self) -> None:
        """Load the active model package into an ONNX Runtime session."""
        package = self.registry.load_active()
        if package is None:
            self.registry.status = RegistryStatus.UNAVAILABLE
            logger.warning("Model loader: no active model available")
            return

        try:
            import onnxruntime as ort  # lazy import keeps app bootable without ML deps
        except ImportError as exc:
            logger.error("Model loader: onnxruntime not installed: %s", exc)
            self.registry.status = RegistryStatus.UNAVAILABLE
            return

        try:
            session = ort.InferenceSession(
                str(package.onnx_path),
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
                output_names=list(session.get_outputs()[0].name),
                threshold=float(package.config.get("threshold", 0.5)),
            )
            self.registry.status = RegistryStatus.LOADED
            logger.info("Model loader: %s v%s loaded", settings.MODEL_NAME, self.version)
        except Exception as exc:
            logger.error("Model loader: failed to load active model: %s", exc)
            self.registry.status = RegistryStatus.UNAVAILABLE
            self.session = None

    def _validate_inputs(self, session: Any, package: ModelPackage) -> None:
        """Ensure the expected input name exists in the ONNX graph."""
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
        if outputs[0].max() > 1.0 or outputs[0].min() < 0.0:
            raise ModelLoadError("Warm-up output outside [0, 1] probability range")


_loader: ModelLoader | None = None


def get_model_loader() -> ModelLoader:
    """Get the singleton model loader."""
    global _loader
    if _loader is None:
        _loader = ModelLoader(get_model_registry())
        _loader.load()
    return _loader

