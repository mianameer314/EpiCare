from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DbDep
from app.services.rag_ingestion import ingest_document

router = APIRouter(prefix="/rag")

@router.post(
    "/upload-document",
    tags=['🤖 AI Chatbot'],
    summary="Upload a medical document for the RAG Chatbot",
    description="Admin endpoint to upload PDFs. Gracefully handles states where AI team hasn't provided the LangChain embedding pipeline yet."
)
async def upload_rag_document(
    current_user: CurrentUser,
    db: DbDep,
    file: UploadFile = File(...)
):
    # Depending on requirements, we might want an admin check here
    
    # Process document gracefully
    doc = await ingest_document(db, file)
    
    return {
        "id": doc.id,
        "title": doc.title,
        "status": doc.status,
        "message": "Document uploaded successfully." + 
                   (" Awaiting AI team for embedding." if doc.status == "PENDING_AI_TEAM" else "")
    }
