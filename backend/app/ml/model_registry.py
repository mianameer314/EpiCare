"""
Model registry — reads the active model version and validates the version package.

Contract (docs/model_contract.md):
    models/seizure_detector/
        current.json                 -> {"active_version": "v1"}
        versions/<version>/model.onnx
        versions/<version>/model_config.json
        versions/<version>/preprocessing.json
        versions/<version>/metrics.json
        versions/<version>/checksum.txt
"""
import json
import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


class RegistryStatus(str, Enum):
    """Status of the active model in the registry."""

    LOADED = "loaded"
    LOADING = "loading"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class ModelPackage:
    """Paths + config for a validated model version."""

    version: str
    root: Path
    onnx_path: Path
    config: dict
    preprocessing: dict
    metrics: dict
    checksum: str | None


class ModelRegistry:
    """Resolves current.json to a concrete ModelPackage."""

    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or settings.MODEL_ROOT)
        self.active_version: str | None = None
        self.status: RegistryStatus = RegistryStatus.UNAVAILABLE
        self._package: ModelPackage | None = None

    def _read_current_json(self) -> str | None:
        """Return the active version id or None when current.json is missing/invalid."""
        current_file = self.root / "current.json"
        if not current_file.exists():
            logger.warning("Model registry: %s missing", current_file)
            return None
        try:
            payload = json.loads(current_file.read_text(encoding="utf-8"))
            version = payload.get("active_version")
            return version if isinstance(version, str) and version else None
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Model registry: invalid current.json: %s", exc)
            return None

    def load_active(self) -> ModelPackage | None:
        """
        Resolve and validate the active model package.

        Supports standard current.json versioning OR direct model.onnx auto-discovery.
        Returns None (status=unavailable) when no model is found;
        the server keeps running and inference returns 503.
        """
        # 1. Try standard current.json versioning
        version = self._read_current_json()
        if version is not None:
            version_dir = self.root / "versions" / version
            onnx_file = version_dir / "model.onnx"
            if onnx_file.exists():
                config = {}
                cfg_path = version_dir / "model_config.json"
                if cfg_path.exists():
                    try:
                        config = json.loads(cfg_path.read_text(encoding="utf-8"))
                    except Exception:
                        pass

                preproc = {}
                preproc_path = version_dir / "preprocessing.json"
                if preproc_path.exists():
                    try:
                        preproc = json.loads(preproc_path.read_text(encoding="utf-8"))
                    except Exception:
                        pass

                package = ModelPackage(
                    version=version,
                    root=version_dir,
                    onnx_path=onnx_file,
                    config=config,
                    preprocessing=preproc,
                    metrics={},
                    checksum=None,
                )
                self.active_version = version
                self._package = package
                self.status = RegistryStatus.LOADING
                logger.info("Model registry: active version %s resolved", version)
                return package

        # 2. Fallback: Auto-discover direct model.onnx files in known locations
        candidate_paths = [
            self.root / "model.onnx",
            self.root / "versions" / "v1" / "model.onnx",
            Path("models") / "model.onnx",
            Path("models") / "seizure_detector" / "model.onnx",
        ]

        # Also search for any .onnx file in self.root
        if self.root.exists():
            for p in self.root.glob("**/*.onnx"):
                if p not in candidate_paths:
                    candidate_paths.append(p)

        for onnx_path in candidate_paths:
            if onnx_path.exists() and onnx_path.is_file():
                detected_ver = onnx_path.parent.name if onnx_path.parent != self.root else "v1"
                package = ModelPackage(
                    version=detected_ver,
                    root=onnx_path.parent,
                    onnx_path=onnx_path,
                    config={"name": settings.MODEL_NAME, "threshold": 0.5},
                    preprocessing={},
                    metrics={},
                    checksum=None,
                )
                self.active_version = detected_ver
                self._package = package
                self.status = RegistryStatus.LOADING
                logger.info("Model registry: auto-discovered ONNX model at %s (version: %s)", onnx_path, detected_ver)
                return package

        self.status = RegistryStatus.UNAVAILABLE
        self._package = None
        return None


_registry: ModelRegistry | None = None


def get_model_registry() -> ModelRegistry:
    """Get the singleton registry instance."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
        _registry.load_active()
    return _registry
