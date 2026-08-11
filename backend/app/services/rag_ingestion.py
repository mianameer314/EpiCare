import logging
import os
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rag import RagDocument

logger = logging.getLogger(__name__)

# The AI team is expected to put their RAG / LangChain scripts in this directory
RAG_SCRIPT_DIR = Path("E:/BS_INTERN/EpiCare/rag/scripts")


async def ingest_document(db: AsyncSession, file: UploadFile) -> RagDocument:
    """
    Ingest a PDF document for RAG processing.
    If the AI pipeline is not ready, it simply stores the file in the database
    with a 'PENDING_AI_TEAM' status.
    """
    
    # In a real scenario we might save the file to local storage or S3 here first
    # For now, we will simulate storing it.
    fake_source_path = f"storage/rag/{file.filename}"
    
    doc = RagDocument(
        title=file.filename or "Unknown Document",
        source_path=fake_source_path,
        checksum="fake_checksum",
        status="PENDING_AI_TEAM"
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    
    # 1. Dynamic Check: Does the RAG script exist?
    is_rag_ready = RAG_SCRIPT_DIR.exists() and any(RAG_SCRIPT_DIR.iterdir())
    
    if not is_rag_ready:
        logger.info(f"RAG scripts not found. Document {doc.id} marked as PENDING_AI_TEAM.")
        # We don't raise an error; we just return the document gracefully.
        return doc
        
    logger.info(f"RAG scripts found. Triggering chunking and embedding for {doc.id}...")
    
    # --- AI TEAM: PASTE YOUR LANGCHAIN/PINECONE PDF PROCESSING CODE HERE ---
    # 
    # Example:
    # from rag.scripts.ingest import process_pdf
    # process_pdf(fake_source_path)
    # doc.status = "INGESTED"
    # await db.commit()
    # ---------------------------------------------------
    
    return doc
