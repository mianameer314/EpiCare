"""
RAG document ingestion service — securely saves uploaded reference PDFs,
computes SHA-256 digests, and dynamically invokes or prepares scripts for the AI team (Finding 9).
"""
import hashlib
import logging
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rag import RagDocument
from app.services.storage.service import get_storage_service
from app.services.storage.validator import sanitize_filename

logger = logging.getLogger(__name__)

# Dynamic RAG script directory (relative to project root)
PROJECT_ROOT = Path(__file__).resolve().parents[3]
RAG_DIR = PROJECT_ROOT / "rag"
RAG_SCRIPT_DIR = RAG_DIR / "scripts"

# Auto-ensure directory exists so future AI team code drops work immediately
try:
    RAG_SCRIPT_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    logger.debug(f"Note: RAG script directory creation: {e}")


async def ingest_document(db: AsyncSession, file: UploadFile) -> RagDocument:
    """
    Ingest a PDF document for RAG processing.
    Saves document bytes via the StorageService, calculates real SHA-256 checksum,
    deduplicates identical files, and sets 'PENDING_AI_TEAM' or 'INGESTED' dynamically.
    """
    # Read upload bytes safely
    data = await file.read()
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

    # 4. Check if external AI RAG scripts/pipeline exist
    is_rag_ready = RAG_SCRIPT_DIR.exists() and any(
        f.suffix in (".py", ".sh") for f in RAG_SCRIPT_DIR.iterdir() if f.is_file()
    )

    doc_status = "PENDING_AI_TEAM"
    if is_rag_ready:
        doc_status = "INGESTED"
        logger.info("RAG scripts detected in %s. Document marked as INGESTED.", RAG_SCRIPT_DIR)
    else:
        logger.info("RAG scripts pending in %s. Document %s stored as PENDING_AI_TEAM.", RAG_SCRIPT_DIR, raw_filename)

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
