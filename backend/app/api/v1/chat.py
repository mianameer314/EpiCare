from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import CurrentUser, DbDep
from app.schemas.chat import ChatMessageCreate, ChatMessageOut
from app.models.chat import ChatSession, ChatMessage
from app.services.chat import process_chat_message

router = APIRouter(prefix="/chat")

@router.post(
    "/message",
    tags=['🤖 AI Chatbot'],
    response_model=ChatMessageOut,
    summary="Send a message to the RAG Chatbot",
    description="Send a message and get an AI response. If the RAG model is not trained yet, returns a graceful fallback message."
)
async def send_chat_message(
    payload: ChatMessageCreate,
    current_user: CurrentUser,
    db: DbDep
):
    # Get or create active session
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .limit(1)
    )
    chat_session = result.scalar_one_or_none()
    if not chat_session:
        chat_session = ChatSession(user_id=current_user.id, title="Medical Inquiry")
        db.add(chat_session)
        await db.commit()
        await db.refresh(chat_session)
        
    # Save user message
    user_msg = ChatMessage(
        session_id=chat_session.id,
        user_id=current_user.id,
        role="user",
        content=payload.content
    )
    db.add(user_msg)
    await db.commit()
    
    # Generate AI response gracefully
    ai_text = await process_chat_message(db, current_user.id, payload.content)
    
    ai_msg = ChatMessage(
        session_id=chat_session.id,
        user_id=current_user.id,
        role="assistant",
        content=ai_text
    )
    db.add(ai_msg)
    await db.commit()
    await db.refresh(ai_msg)
    
    # We return the AI message as the response
    return ai_msg
