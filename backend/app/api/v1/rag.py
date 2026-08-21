from fastapi import APIRouter, Depends, UploadFile, File

from app.api.deps import CurrentUser, DbDep, RoleChecker
from app.models.enums import UserRole
from app.services.rag_ingestion import ingest_document

router = APIRouter(prefix="/rag")

RequireAdmin = Depends(RoleChecker([UserRole.ADMIN]))

@router.post(
    "/upload-document",
    tags=['🤖 AI Chatbot'],
    dependencies=[RequireAdmin],
    summary="Upload a medical document for the RAG Chatbot",
    description="Admin endpoint to upload PDFs. Gracefully handles states where AI team hasn't provided the LangChain embedding pipeline yet."
)
async def upload_rag_document(
    current_user: CurrentUser,
    db: DbDep,
    file: UploadFile = File(...)
):
    doc = await ingest_document(db, file)
    
    return {
        "id": doc.id,
        "title": doc.title,
        "status": doc.status,
        "message": "Document uploaded successfully." + 
                   (" Awaiting AI team for embedding." if doc.status == "PENDING_AI_TEAM" else "")
    }
