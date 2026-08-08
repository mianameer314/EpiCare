"""
Abstract base class for storage providers.

Business logic and route handlers interact ONLY through this contract so the
Local implementation can be swapped for S3 without application changes.
"""
from abc import ABC, abstractmethod


class StorageProvider(ABC):
    """Abstract interface for file storage backends."""

    @abstractmethod
    def save(self, file_bytes: bytes, key: str) -> str:
        """Persist raw bytes at key. Returns the storage key."""

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Remove a stored object. Returns True when deleted, False if absent."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Return True when the object exists."""

    @abstractmethod
    def read(self, key: str) -> bytes:
        """Return raw bytes for an object. Raises FileNotFoundError when absent."""
