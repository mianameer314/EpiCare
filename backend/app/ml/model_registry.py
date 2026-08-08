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

        Returns None (status=unavailable) when anything is missing or invalid;
        the server keeps running and inference returns 503.
        """
        version = self._read_current_json()
        if version is None:
            self.status = RegistryStatus.UNAVAILABLE
            self._package = None
            return None

        version_dir = self.root / "versions" / version
        required = {
            "model.onnx": version_dir / "model.onnx",
            "model_config.json": version_dir / "model_config.json",
            "preprocessing.json": version_dir / "preprocessing.json",
        }
        missing = [name for name, path in required.items() if not path.exists()]
        if missing:
            logger.error("Model registry: %s missing files in %s", missing, version_dir)
            self.status = RegistryStatus.UNAVAILABLE
            self._package = None
            return None

        try:
            config = json.loads((version_dir / "model_config.json").read_text(encoding="utf-8"))
            preprocessing = json.loads(
                (version_dir / "preprocessing.json").read_text(encoding="utf-8")
            )
        except (json.JSONDecodeError, OSError) as exc:
            logger.error("Model registry: invalid JSON in %s: %s", version_dir, exc)
            self.status = RegistryStatus.UNAVAILABLE
            self._package = None
            return None

        metrics: dict = {}
        metrics_file = version_dir / "metrics.json"
        if metrics_file.exists():
            try:
                metrics = json.loads(metrics_file.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                logger.warning("Model registry: unreadable metrics.json in %s", version_dir)

        checksum: str | None = None
        checksum_file = version_dir / "checksum.txt"
        if checksum_file.exists():
            checksum = checksum_file.read_text(encoding="utf-8").strip()

        package = ModelPackage(
            version=version,
            root=version_dir,
            onnx_path=version_dir / "model.onnx",
            config=config,
            preprocessing=preprocessing,
            metrics=metrics,
            checksum=checksum,
        )
        self.active_version = version
        self._package = package
        self.status = RegistryStatus.LOADING
        logger.info("Model registry: active version %s resolved", version)
        return package


_registry: ModelRegistry | None = None


def get_model_registry() -> ModelRegistry:
    """Get the singleton registry instance."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
        _registry.load_active()
    return _registry
