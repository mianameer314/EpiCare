"""
File validation — extension checks, MIME checks, size limits, path safety.
Validates uploads server-side. Never trusts UploadFile.content_type alone.
"""
import hashlib
import logging
import uuid
from pathlib import PurePosixPath

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

from app.services.storage.constants import (
    ALLOWED_EEG_EXTENSIONS,
    ALLOWED_EEG_MIMES,
    BLOCKED_EXTENSIONS,
    MAX_EEG_SIZE_BYTES,
    ALLOWED_DOCTOR_DOCUMENT_EXTENSIONS,
    ALLOWED_DOCTOR_DOCUMENT_MIMES,
    MAX_DOCTOR_DOCUMENT_SIZE_BYTES,
    MAX_DOCTOR_PHOTO_SIZE_BYTES,
)

logger = logging.getLogger(__name__)


def sanitize_filename(name: str) -> str:
    """Strip path traversal characters and dangerous patterns from a filename."""
    name = PurePosixPath(name).name
    name = name.replace("\x00", "").replace("\r", "").replace("\n", "")
    name = name.replace(" ", "_").lstrip(".")
    return name or "upload"


def get_extension(filename: str) -> str:
    """Extract lowercase file extension including the dot."""
    sanitized = sanitize_filename(filename)
    return "." + sanitized.rsplit(".", 1)[-1].lower() if "." in sanitized else ""


def generate_storage_key(subfolder: str, original_filename: str, extension: str | None = None) -> str:
    """
    Generate a collision-proof storage key.

    Format: {subfolder}/{uuid4}{extension}
    The user-supplied filename is never used as a path component.
    """
    ext = (extension or get_extension(original_filename)).lower()
    return f"{subfolder}/{uuid.uuid4().hex}{ext}"


def sha256_bytes(data: bytes) -> str:
    """Return the hex SHA-256 digest of raw bytes (duplicate detection)."""
    return hashlib.sha256(data).hexdigest()


async def validate_doctor_upload(file: UploadFile, *, photo: bool = False) -> tuple[bytes, str, str]:
    """Validate a PMDC certificate or profile photo and return bytes, name, and MIME type."""
    filename = sanitize_filename(file.filename or "")
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    ext = get_extension(filename)
    if ext in BLOCKED_EXTENSIONS or ext not in ALLOWED_DOCTOR_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.",
        )

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_DOCTOR_DOCUMENT_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file has an unsupported MIME type.",
        )
    if photo and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile photo must be an image file.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file rejected")

    max_size = MAX_DOCTOR_PHOTO_SIZE_BYTES if photo else MAX_DOCTOR_DOCUMENT_SIZE_BYTES
    if len(data) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the {limit_mb} MB limit.",
        )

    return data, filename, content_type


async def validate_eeg_upload(file: UploadFile) -> bytes:
    """
    Validate an EEG upload and return its raw bytes.

    Raises:
        HTTPException(400): blocked extension, wrong extension, wrong MIME, empty file, oversize.
    """
    filename = sanitize_filename(file.filename or "")
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    ext = get_extension(filename)
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' is not allowed.",
        )
    if ext not in ALLOWED_EEG_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' is not allowed. Allowed: {sorted(ALLOWED_EEG_EXTENSIONS)}",
        )

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_EEG_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unexpected MIME type '{content_type}'.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file rejected")

    if len(data) > MAX_EEG_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds the {settings.EEG_MAX_SIZE_MB} MB limit.",
        )

    logger.info("eeg_upload_validated", extra={"file_name": filename, "size_bytes": len(data)})
    return data



