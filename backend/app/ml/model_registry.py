"""
Frozen seizure-detector model registry.

The active version is resolved through:
    models/seizure_detector/current.json -> versions/<version>/

Phase22 intentionally validates the complete Phase21.5 serving package rather
than only checking that an ONNX file exists.
"""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)


class RegistryStatus(str, Enum):
    LOADED = "loaded"
    LOADING = "loading"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class ModelPackage:
    """Resolved, integrity-checked frozen model package."""

    version: str
    root: Path
    onnx_path: Path
    config: dict[str, Any]
    preprocessing: dict[str, Any]
    metrics: dict[str, Any]
    serving_contract: dict[str, Any]
    temporal_policy: dict[str, Any]
    package_manifest: dict[str, Any]
    checksum: str | None
    router_json_path: Path
    router_parameters_path: Path
    router_prototypes_path: Path
    frequency_transforms_path: Path
    model_fixture_path: Path
    temporal_fixture_path: Path


def _sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            block = handle.read(chunk_size)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def _sha256_text_normalized(path: Path) -> str:
    try:
        content = path.read_bytes().replace(b"\r\n", b"\n")
        return hashlib.sha256(content).hexdigest()
    except Exception:
        return _sha256_file(path)


def _read_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path.name} must contain a JSON object")
    return payload


def _resolve_registry_root(value: str | None) -> Path:
    """
    Resolve MODEL_ROOT robustly for both common local launch locations:

    - from EpiCare root:    models/seizure_detector
    - from backend/:        ../models/seizure_detector

    Absolute paths are respected unchanged.
    """
    raw = Path(value or settings.MODEL_ROOT).expanduser()
    if raw.is_absolute():
        return raw.resolve()

    candidates: list[Path] = [
        (Path.cwd() / raw).resolve(),
        (Path.cwd() / "models" / "seizure_detector").resolve(),
    ]

    # backend/app/ml/model_registry.py -> parents[2] is backend root (/app in Docker/Railway)
    backend_root = Path(__file__).resolve().parents[2]
    candidates.append((backend_root / "models" / "seizure_detector").resolve())
    candidates.append((backend_root / raw).resolve())

    # parents[3] is EpiCare repository root when running from local subfolder
    repo_root = Path(__file__).resolve().parents[3]
    candidates.append((repo_root / raw).resolve())
    candidates.append((repo_root / "models" / "seizure_detector").resolve())
    candidates.append((repo_root / "backend" / "models" / "seizure_detector").resolve())

    for candidate in candidates:
        if (candidate / "current.json").exists():
            return candidate

    # Preserve the first candidate with current.json or first interpretation for readable diagnostics.
    return candidates[0]


class ModelRegistry:
    """Resolves current.json to a complete frozen ModelPackage."""

    REQUIRED_FILES = (
        "model.onnx",
        "model_config.json",
        "preprocessing.json",
        "metrics.json",
        "checksum.txt",
        "temporal_policy.json",
        "universal_router.json",
        "universal_router_parameters.npz",
        "universal_router_prototypes.npz",
        "universal_frequency_transforms.npz",
        "serving_contract.json",
        "package_manifest.json",
        "phase22_model_input_fixture.npz",
        "phase22_temporal_fixture.json",
    )

    def __init__(self, root: str | None = None) -> None:
        self.root = _resolve_registry_root(root)
        self.active_version: str | None = None
        self.status: RegistryStatus = RegistryStatus.UNAVAILABLE
        self._package: ModelPackage | None = None
        self.last_error: str | None = None

    @property
    def package(self) -> ModelPackage | None:
        return self._package

    def _read_current_json(self) -> str | None:
        current_file = self.root / "current.json"
        if not current_file.exists():
            self.last_error = f"{current_file} missing"
            logger.warning("Model registry: %s", self.last_error)
            return None
        try:
            payload = _read_json(current_file)
            version = payload.get("active_version")
            return version if isinstance(version, str) and version else None
        except (json.JSONDecodeError, OSError, ValueError) as exc:
            self.last_error = f"invalid current.json: {exc}"
            logger.error("Model registry: %s", self.last_error)
            return None

    def _validate_integrity(
        self,
        version_dir: Path,
        *,
        serving_contract: dict[str, Any],
        package_manifest: dict[str, Any],
    ) -> str:
        onnx_path = version_dir / "model.onnx"
        actual_onnx_sha = _sha256_file(onnx_path)

        checksum_file = version_dir / "checksum.txt"
        checksum_text = checksum_file.read_text(encoding="utf-8").strip()
        checksum_token = checksum_text.split()[0] if checksum_text else ""
        if len(checksum_token) != 64 or checksum_token.lower() != actual_onnx_sha:
            raise ValueError(
                "model.onnx SHA256 does not match checksum.txt "
                f"(expected {checksum_token!r}, actual {actual_onnx_sha})"
            )

        serving_sha = (
            serving_contract.get("onnx", {}).get("sha256")
            if isinstance(serving_contract.get("onnx"), dict)
            else None
        )
        if serving_sha and str(serving_sha).lower() != actual_onnx_sha:
            raise ValueError("model.onnx SHA256 does not match serving_contract.json")

        manifest_sha = package_manifest.get("onnx_sha256")
        if manifest_sha and str(manifest_sha).lower() != actual_onnx_sha:
            raise ValueError("model.onnx SHA256 does not match package_manifest.json")

        revision = package_manifest.get("package_revision")
        if revision != "v1-phase21.5-serving-complete":
            raise ValueError(
                "Package is not the Phase21.5 serving-complete revision "
                f"(got {revision!r})"
            )

        # Validate manifest-listed files: required files must exist; log warnings for auxiliary hashes
        for item in package_manifest.get("files", []):
            if not isinstance(item, dict):
                continue
            name = item.get("filename")
            expected = str(item.get("sha256") or "").lower()
            if not name or not expected:
                continue
            if name in {"checksum.txt", "README.md", "model.onnx"}:
                continue
            path = version_dir / str(name)
            if not path.exists():
                logger.warning("Manifest-listed auxiliary file missing: %s", name)
                continue
            
            actual_sha = _sha256_file(path).lower()
            if actual_sha != expected:
                if path.suffix.lower() in {".txt", ".json", ".md"}:
                    norm_sha = _sha256_text_normalized(path).lower()
                    if norm_sha == expected:
                        continue
                logger.warning("Package auxiliary file SHA256 differs (ignoring non-blocking mismatch): %s", name)

        return actual_onnx_sha

    def load_active(self) -> ModelPackage | None:
        """
        Resolve and validate the active model package.

        Any failure keeps the server bootable with registry status unavailable;
        EEG inference then returns 503 rather than silently using a wrong model.
        """
        version = self._read_current_json()
        if version is None:
            self.status = RegistryStatus.UNAVAILABLE
            self._package = None
            return None

        version_dir = self.root / "versions" / version
        missing = [
            name
            for name in self.REQUIRED_FILES
            if not (version_dir / name).exists()
        ]
        if missing:
            self.last_error = (
                f"missing files in {version_dir}: {', '.join(sorted(missing))}"
            )
            logger.error("Model registry: %s", self.last_error)
            self.status = RegistryStatus.UNAVAILABLE
            self._package = None
            return None

        try:
            config = _read_json(version_dir / "model_config.json")
            preprocessing = _read_json(version_dir / "preprocessing.json")
            metrics = _read_json(version_dir / "metrics.json")
            serving_contract = _read_json(version_dir / "serving_contract.json")
            temporal_policy = _read_json(version_dir / "temporal_policy.json")
            package_manifest = _read_json(version_dir / "package_manifest.json")

            self._validate_integrity(
                version_dir,
                serving_contract=serving_contract,
                package_manifest=package_manifest,
            )

            package = ModelPackage(
                version=version,
                root=version_dir,
                onnx_path=version_dir / "model.onnx",
                config=config,
                preprocessing=preprocessing,
                metrics=metrics,
                serving_contract=serving_contract,
                temporal_policy=temporal_policy,
                package_manifest=package_manifest,
                checksum=(version_dir / "checksum.txt").read_text(
                    encoding="utf-8"
                ).strip(),
                router_json_path=version_dir / "universal_router.json",
                router_parameters_path=version_dir
                / "universal_router_parameters.npz",
                router_prototypes_path=version_dir
                / "universal_router_prototypes.npz",
                frequency_transforms_path=version_dir
                / "universal_frequency_transforms.npz",
                model_fixture_path=version_dir / "phase22_model_input_fixture.npz",
                temporal_fixture_path=version_dir / "phase22_temporal_fixture.json",
            )
        except Exception as exc:
            self.last_error = str(exc)
            logger.error(
                "Model registry: invalid frozen package %s: %s",
                version_dir,
                exc,
            )
            self.status = RegistryStatus.UNAVAILABLE
            self._package = None
            return None

        self.active_version = version
        self._package = package
        self.status = RegistryStatus.LOADING
        self.last_error = None
        logger.info(
            "Model registry: active frozen version %s resolved at %s",
            version,
            version_dir,
        )
        return package


_registry: ModelRegistry | None = None


def get_model_registry() -> ModelRegistry:
    """Get the singleton model registry."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry()
        _registry.load_active()
    return _registry
