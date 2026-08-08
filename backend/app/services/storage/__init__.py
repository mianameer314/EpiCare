"""
Storage package — provider abstraction, validation, and the high-level service.
"""
from app.services.storage.service import StorageService, get_storage_service

__all__ = ["StorageService", "get_storage_service"]
