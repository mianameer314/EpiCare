import logging
import os
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.chat import ChatSession, ChatMessage
from app.models.user import User

logger = logging.getLogger(__name__)

# The AI team is expected to put their RAG / LangChain scripts in this directory
RAG_SCRIPT_DIR = Path("E:/BS_INTERN/EpiCare/rag/scripts")


async def process_chat_message(db: AsyncSession, user_id: int, message: str) -> str:
    """
    Process a user's chatbot message.
    Checks if the RAG system is ready; if not, returns a graceful fallback message.
    """
    
    # 1. Dynamic Check: Does the RAG script exist?
    is_rag_ready = RAG_SCRIPT_DIR.exists() and any(RAG_SCRIPT_DIR.iterdir())
    
    if not is_rag_ready:
        logger.info(f"RAG scripts not found in {RAG_SCRIPT_DIR}. Graceful fallback triggered.")
        # We can either raise an error for the frontend, or return a standard text reply
        return "Hi! My AI brain is currently being trained by the medical team. I'll be able to answer your questions about epilepsy soon!"
    
    # 2. If the scripts exist, the AI team will replace the code below with their actual
    # LangChain / Pinecone inference code.
    logger.info(f"RAG scripts found. Generating answer for user {user_id}...")
    
    # --- AI TEAM: PASTE YOUR LANGCHAIN/RAG INFERENCE CODE HERE ---
    # 
    # Example:
    # from rag.scripts.query import answer_question
    # response_text = answer_question(message, user_id)
    
    response_text = "AI Team: Please populate this with real LangChain output."
    
    # ---------------------------------------------------
    
    return response_text
