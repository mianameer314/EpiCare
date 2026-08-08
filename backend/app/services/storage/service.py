"""
Storage service — high-level API used by route handlers.

Wraps the provider abstraction with UUID key generation, hashing, and
transaction-safe rollback tracking (pending uploads are deleted if the
database transaction fails).
"""
import logging
from typing import Any

from fastapi import UploadFile

from app.core.config import settings
from app.services.storage.base import StorageProvider
from app.services.storage.local import LocalStorageProvider
from app.services.storage.validator import (
    generate_storage_key,
    sanitize_filename,
    sha256_bytes,
)

logger = logging.getLogger(__name__)


class StorageService:
    """High-level storage facade with pending-upload rollback."""

    def __init__(self, provider: StorageProvider) -> None:
        self.provider = provider
        self._pending: list[str] = []

    def save_eeg(self, file: UploadFile, data: bytes) -> tuple[str, str]:
        """Save an EEG upload; returns (storage_key, sha256_hash)."""
        filename = sanitize_filename(file.filename or "eeg")
        key = generate_storage_key("eeg", filename)
        self.provider.save(data, key)
        self._pending.append(key)
        return key, sha256_bytes(data)

    def save_spectrogram(self, data: bytes, session_id: int) -> str:
        """Save a generated spectrogram image."""
        key = f"spectrograms/session_{session_id}.png"
        self.provider.save(data, key)
        self._pending.append(key)
        return key

    def save_report(self, data: bytes, prediction_id: int) -> str:
        """Save an exported report artifact."""
        key = f"reports/prediction_{prediction_id}.pdf"
        self.provider.save(data, key)
        self._pending.append(key)
        return key

    def read(self, key: str) -> bytes:
        return self.provider.read(key)

    def delete(self, key: str) -> bool:
        return self.provider.delete(key)

    def exists(self, key: str) -> bool:
        return self.provider.exists(key)

    def clear_pending(self) -> None:
        """Clear pending list after a successful DB commit."""
        self._pending.clear()

    def rollback_uploads(self) -> None:
        """Delete every pending upload (DB transaction failed)."""
        for key in list(self._pending):
            try:
                self.provider.delete(key)
            except Exception as exc:
                logger.error("Rollback failed for key %s: %s", key, exc)
        self._pending.clear()


_service: StorageService | None = None


def get_storage_service() -> StorageService:
    """Get the singleton StorageService (provider chosen from settings)."""
    global _service
    if _service is not None:
        return _service

    provider_name = settings.STORAGE_PROVIDER.lower()
    if provider_name == "local":
        provider: StorageProvider = LocalStorageProvider()
    elif provider_name == "s3":
        from app.services.storage.s3 import S3StorageProvider

        provider = S3StorageProvider()
    else:
        raise ValueError(f"Unknown STORAGE_PROVIDER: '{provider_name}'")

    _service = StorageService(provider)
    logger.info("storage_service_ready", extra={"provider": provider_name})
    return _service
