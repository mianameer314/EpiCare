"""
Storage constants — allowed extensions, MIME types, size limits.
"""
from app.core.config import settings

ALLOWED_EEG_EXTENSIONS: set[str] = {
    ext.strip().lower() for ext in settings.ALLOWED_EEG_EXTENSIONS.split(",") if ext.strip()
}

ALLOWED_EEG_MIMES: set[str] = {
    "application/octet-stream",
    "application/x-edf",
    "text/csv",
    "text/plain",
}

MAX_EEG_SIZE_BYTES: int = settings.EEG_MAX_SIZE_MB * 1024 * 1024

ALLOWED_DOCTOR_DOCUMENT_EXTENSIONS: set[str] = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_DOCTOR_DOCUMENT_MIMES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_DOCTOR_DOCUMENT_SIZE_BYTES: int = 10 * 1024 * 1024
MAX_DOCTOR_PHOTO_SIZE_BYTES: int = 5 * 1024 * 1024

BLOCKED_EXTENSIONS: set[str] = {
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".dll", ".so", ".dylib", ".jar", ".py", ".js",
}
