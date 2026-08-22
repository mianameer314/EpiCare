"""
File validation — extension checks, magic-byte inspection, size limits, and image re-encoding.
Validates uploads server-side to prevent disguised or malicious file uploads (Finding 11).
"""
import hashlib
import io
import logging
import uuid
from pathlib import PurePosixPath

import filetype
from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps

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

ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_DOC_MIMES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


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
    """
    ext = (extension or get_extension(original_filename)).lower()
    return f"{subfolder}/{uuid.uuid4().hex}{ext}"


def sha256_bytes(data: bytes) -> str:
    """Return the hex SHA-256 digest of raw bytes (duplicate detection)."""
    return hashlib.sha256(data).hexdigest()


def sanitize_and_reencode_image(data: bytes, output_format: str = "JPEG", max_dimension: int = 2048) -> tuple[bytes, str]:
    """
    Safely parse and re-encode image bytes to strip EXIF, comments, and polyglots.
    Ensures safe, clean image buffers for storage.
    """
    try:
        with Image.open(io.BytesIO(data)) as img:
            if img.format not in ("JPEG", "PNG", "WEBP"):
                raise ValueError(f"Unsupported image format: {img.format}")
            
            # Normalize orientation and strip EXIF
            img = ImageOps.exif_transpose(img)
            
            # Resize if overly large
            if img.width > max_dimension or img.height > max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                
            out_format = output_format.upper()
            if out_format in ("JPEG", "JPG"):
                save_fmt = "JPEG"
                mime = "image/jpeg"
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
            elif out_format == "PNG":
                save_fmt = "PNG"
                mime = "image/png"
            else:
                save_fmt = "WEBP"
                mime = "image/webp"

            out_buf = io.BytesIO()
            img.save(out_buf, format=save_fmt, quality=85, optimize=True)
            return out_buf.getvalue(), mime
    except Exception as exc:
        logger.warning(f"Image sanitization failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, corrupted, or unsupported image file.",
        )


async def read_limited_upload(file: UploadFile, max_bytes: int) -> bytes:
    """Stream upload in 1MB chunks and abort immediately if size exceeds limit (Finding 10)."""
    chunks: list[bytes] = []
    total = 0
    chunk_size = 1024 * 1024  # 1 MB chunk
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            limit_mb = max_bytes // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size exceeds the {limit_mb} MB limit.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def validate_doctor_upload(file: UploadFile, *, photo: bool = False) -> tuple[bytes, str, str]:
    """
    Validate a PMDC certificate or profile photo with extension, streaming size limits,
    magic-byte inspection, and image re-encoding (Findings 10, 11).
    """
    filename = sanitize_filename(file.filename or "")
    if not filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    ext = get_extension(filename)
    if ext in BLOCKED_EXTENSIONS or ext not in ALLOWED_DOCTOR_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.",
        )

    # Enforce streaming size limits (Finding 10)
    max_size = MAX_DOCTOR_PHOTO_SIZE_BYTES if photo else MAX_DOCTOR_DOCUMENT_SIZE_BYTES
    data = await read_limited_upload(file, max_size)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file rejected")

    # Magic-byte inspection
    kind = filetype.guess(data)
    detected_mime = kind.mime if kind else None

    # Handle PDF signature explicitly if filetype library doesn't catch it
    if not detected_mime and data.startswith(b"%PDF-"):
        detected_mime = "application/pdf"

    if photo:
        if not detected_mime or detected_mime not in ALLOWED_IMAGE_MIMES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid image signature. The file content does not match an allowed image format.",
            )
        # Re-encode image to eliminate polyglots/malicious metadata
        img_fmt = "PNG" if ext == ".png" else ("WEBP" if ext == ".webp" else "JPEG")
        clean_bytes, clean_mime = sanitize_and_reencode_image(data, output_format=img_fmt)
        logger.info("doctor_photo_validated_and_reencoded", extra={"file_name": filename, "size_bytes": len(clean_bytes)})
        return clean_bytes, filename, clean_mime
    else:
        if not detected_mime or detected_mime not in ALLOWED_DOC_MIMES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid document signature. Only valid PDF and image documents are permitted.",
            )
        
        # If document is an image, re-encode it safely as well
        if detected_mime.startswith("image/"):
            img_fmt = "PNG" if ext == ".png" else ("WEBP" if ext == ".webp" else "JPEG")
            clean_bytes, clean_mime = sanitize_and_reencode_image(data, output_format=img_fmt)
            return clean_bytes, filename, clean_mime
            
        logger.info("doctor_document_validated", extra={"file_name": filename, "size_bytes": len(data)})
        return data, filename, detected_mime


async def validate_eeg_upload(file: UploadFile) -> bytes:
    """
    Validate an EEG upload (.edf/.csv) with streaming size limit and EDF header inspection (Findings 10, 11).
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

    # Enforce streaming size limit (Finding 10)
    data = await read_limited_upload(file, MAX_EEG_SIZE_BYTES)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file rejected")

    # Magic byte check for EDF files
    if ext == ".edf":
        # Standard EDF header starts with 8 ASCII characters representing version '0       '
        if not (data.startswith(b"0       ") or data.startswith(b"0")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid EDF file header signature.",
            )

    logger.info("eeg_upload_validated", extra={"file_name": filename, "size_bytes": len(data)})
    return data
