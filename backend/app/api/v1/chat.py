from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbDep
from app.models.chat import ChatMessage, ChatSession
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageOut,
    ChatSessionCreate,
    ChatSessionOut,
)
from app.services.chat import process_chat_message

router = APIRouter(prefix="/chat")


# ------------------------------------------------------------------
# Chat Sessions
# ------------------------------------------------------------------

@router.get(
    "/sessions",
    tags=['🤖 AI Chatbot'],
    response_model=List[ChatSessionOut],
    summary="List Chat Sessions",
    description="Retrieve all chat sessions for the authenticated user with message counts and previews in a single high-speed indexed query.",
)
async def list_chat_sessions(
    current_user: CurrentUser,
    db: DbDep,
):
    # High-performance single-query execution with correlated subqueries
    count_sub = (
        select(func.count(ChatMessage.id))
        .where(ChatMessage.session_id == ChatSession.id)
        .correlate(ChatSession)
        .scalar_subquery()
    )

    last_msg_sub = (
        select(ChatMessage.content)
        .where(ChatMessage.session_id == ChatSession.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
        .correlate(ChatSession)
        .scalar_subquery()
    )

    stmt = (
        select(
            ChatSession.id,
            ChatSession.user_id,
            ChatSession.title,
            ChatSession.created_at,
            ChatSession.updated_at,
            count_sub.label("message_count"),
            last_msg_sub.label("last_message"),
        )
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        ChatSessionOut(
            id=row.id,
            user_id=row.user_id,
            title=row.title,
            message_count=row.message_count or 0,
            last_message=row.last_message,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        for row in rows
    ]


@router.post(
    "/sessions",
    tags=['🤖 AI Chatbot'],
    response_model=ChatSessionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create New Chat Session",
    description="Initializes a new chat session for the user.",
)
async def create_chat_session(
    payload: ChatSessionCreate,
    current_user: CurrentUser,
    db: DbDep,
):
    new_session = ChatSession(
        user_id=current_user.id,
        title=payload.title or "New Clinical Discussion",
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    return ChatSessionOut(
        id=new_session.id,
        user_id=new_session.user_id,
        title=new_session.title,
        message_count=0,
        last_message=None,
        created_at=new_session.created_at,
        updated_at=new_session.updated_at,
    )


@router.get(
    "/sessions/{session_id}/messages",
    tags=['🤖 AI Chatbot'],
    response_model=List[ChatMessageOut],
    summary="Get Session Messages",
    description="Retrieves all chat messages for a specific session.",
)
async def get_session_messages(
    session_id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    # Verify session ownership
    session_res = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = session_res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found.",
        )

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return result.scalars().all()


@router.delete(
    "/sessions/{session_id}",
    tags=['🤖 AI Chatbot'],
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Chat Session",
    description="Deletes a chat session and all associated messages.",
)
async def delete_chat_session(
    session_id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found.",
        )

    await db.delete(session)
    await db.commit()
    return None


# ------------------------------------------------------------------
# Chat Messaging & History
# ------------------------------------------------------------------

@router.get(
    "/history",
    tags=['🤖 AI Chatbot'],
    response_model=List[ChatMessageOut],
    summary="Get Chat History",
    description="Retrieves the authenticated user's recent chat messages and AI answers across all sessions.",
)
async def get_chat_history(
    current_user: CurrentUser,
    db: DbDep,
    limit: int = Query(30, ge=1, le=100),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    messages = result.scalars().all()
    return messages


def make_session_title(content: str, max_chars: int = 45) -> str:
    """Generate a clean, Unicode-safe title without truncated words or broken characters (Finding 20)."""
    clean = " ".join(content.strip().split())
    if not clean:
        return "Educational Inquiry"
    if len(clean) <= max_chars:
        return clean
    truncated = clean[:max_chars]
    if " " in truncated:
        truncated = truncated.rsplit(" ", 1)[0]
    return truncated.rstrip() + "..."


@router.post(
    "/message",
    tags=['🤖 AI Chatbot'],
    response_model=ChatMessageOut,
    summary="Send a message to the RAG Chatbot",
    description="Send a message and get an AI response. Saves both user query and clinical AI answer in database.",
)
async def send_chat_message(
    payload: ChatMessageCreate,
    current_user: CurrentUser,
    db: DbDep,
):
    chat_session = None

    # 1. If session_id is explicitly passed, verify ownership and use it
    if payload.session_id and payload.session_id > 0:
        res = await db.execute(
            select(ChatSession)
            .where(ChatSession.id == payload.session_id, ChatSession.user_id == current_user.id)
        )
        chat_session = res.scalar_one_or_none()

    # 2. If no session requested (new conversation mode) or session not found, create a BRAND NEW session!
    if not chat_session:
        title = make_session_title(payload.content)
        chat_session = ChatSession(
            user_id=current_user.id,
            title=title,
        )
        db.add(chat_session)
        await db.commit()
        await db.refresh(chat_session)
    elif chat_session.title in ["New chat", "New Clinical Discussion", "Medical Inquiry", "Clinical Inquiry", "Educational Inquiry"]:
        # Auto-update title if it was a default placeholder
        chat_session.title = make_session_title(payload.content)
        await db.commit()

    # Save user message
    user_msg = ChatMessage(
        session_id=chat_session.id,
        user_id=current_user.id,
        role="user",
        content=payload.content,
    )
    db.add(user_msg)
    
    # Touch session timestamp so it orders to the top of recent discussions
    chat_session.updated_at = func.now()
    await db.commit()

    # Generate AI response from Clinical Knowledge Engine
    ai_text = await process_chat_message(db, current_user.id, payload.content)

    ai_msg = ChatMessage(
        session_id=chat_session.id,
        user_id=current_user.id,
        role="assistant",
        content=ai_text,
    )
    db.add(ai_msg)
    await db.commit()
    await db.refresh(ai_msg)

    return ai_msg


