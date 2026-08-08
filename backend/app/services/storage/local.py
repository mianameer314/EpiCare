"""
Local filesystem storage provider.
"""
import logging
from pathlib import Path

from app.core.config import settings
from app.services.storage.base import StorageProvider

logger = logging.getLogger(__name__)


class LocalStorageProvider(StorageProvider):
    """Stores files under settings.LOCAL_STORAGE_PATH."""

    def __init__(self) -> None:
        self.root = Path(settings.LOCAL_STORAGE_PATH).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        """Resolve a storage key to an absolute path, blocking traversal."""
        clean = key.lstrip("/").replace("\\", "/")
        path = (self.root / clean).resolve()
        if not str(path).startswith(str(self.root)):
            raise ValueError(f"Storage key escapes root: {key}")
        return path

    def save(self, file_bytes: bytes, key: str) -> str:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(file_bytes)
        logger.info("stored_file", extra={"key": key, "bytes": len(file_bytes)})
        return key

    def delete(self, key: str) -> bool:
        path = self._resolve(key)
        if path.exists():
            path.unlink()
            logger.info("deleted_file", extra={"key": key})
            return True
        return False

    def exists(self, key: str) -> bool:
        return self._resolve(key).exists()

    def read(self, key: str) -> bytes:
        return self._resolve(key).read_bytes()
