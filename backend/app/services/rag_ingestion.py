"""
RAG document ingestion service — securely saves uploaded reference PDFs,
computes SHA-256 digests, streams bounded uploads, and manages ingestion states (Findings 9, 10).
"""
import hashlib
import logging
from enum import StrEnum
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rag import RagDocument
from app.services.storage.service import get_storage_service
from app.services.storage.validator import read_limited_upload, sanitize_filename

logger = logging.getLogger(__name__)

# Dynamic RAG script directory (relative to project root)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAG_DIR = PROJECT_ROOT / "rag"
RAG_SCRIPT_DIR = RAG_DIR / "scripts"

# Maximum size for uploaded RAG reference documents (10 MB)
MAX_RAG_DOCUMENT_BYTES = 10 * 1024 * 1024


class RagDocumentStatus(StrEnum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"
    PENDING_AI_TEAM = "PENDING_AI_TEAM"


async def ingest_document(db: AsyncSession, file: UploadFile) -> RagDocument:
    """
    Ingest a PDF document for RAG processing.
    Streams upload with strict size limit, computes SHA-256 digest,
    deduplicates identical files, and sets the document state cleanly (Findings 9, 10).
    """
    # Stream upload bytes with strict size limit (Finding 10)
    data = await read_limited_upload(file, MAX_RAG_DOCUMENT_BYTES)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot ingest an empty document.",
        )

    # 1. Compute real SHA-256 digest
    checksum = hashlib.sha256(data).hexdigest()

    # 2. Check for duplicate ingestion
    existing_res = await db.execute(select(RagDocument).where(RagDocument.checksum == checksum))
    existing_doc = existing_res.scalar_one_or_none()
    if existing_doc:
        logger.info("Document already ingested with checksum %s (doc_id=%s)", checksum, existing_doc.id)
        return existing_doc

    # 3. Store raw bytes in configured storage service
    storage = get_storage_service()
    raw_filename = sanitize_filename(file.filename or "rag_document.pdf")
    storage_key = storage.save_rag_document(data, raw_filename)

    # 4. Status reflects upload state without executing unreviewed arbitrary scripts (Findings 1, 9)
    doc_status = RagDocumentStatus.UPLOADED.value

    doc = RagDocument(
        title=file.filename or "Unknown Document",
        source_path=storage_key,
        checksum=checksum,
        status=doc_status,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    storage.clear_pending()

    return doc
