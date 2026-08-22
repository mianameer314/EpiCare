"""
Session service — manages server-side UserSession lifecycle, token rotation,
instant revocation, and token reuse/replay attack detection (Finding 4).
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_token,
)
from app.models.user import User
from app.models.user_session import UserSession

logger = logging.getLogger(__name__)


async def create_session(
    db: AsyncSession,
    user: User,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Tuple[str, str, UserSession]:
    """Create a new server-side session, returning (access_token, refresh_token, session)."""
    session_id = uuid.uuid4().hex
    refresh_jti = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS)

    refresh_token = create_refresh_token(
        subject=user.email,
        session_id=session_id,
        jti=refresh_jti,
    )
    access_token = create_access_token(
        data={"sub": user.email},
        session_id=session_id,
    )

    session = UserSession(
        user_id=user.id,
        session_id=session_id,
        refresh_token_jti=refresh_jti,
        refresh_token_hash=hash_token(refresh_token),
        user_agent=user_agent[:500] if user_agent else None,
        ip_address=ip_address[:45] if ip_address else None,
        is_revoked=False,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return access_token, refresh_token, session


async def rotate_session_token(
    db: AsyncSession,
    refresh_token_str: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Tuple[str, str, User]:
    """
    Rotate an existing refresh token for a session.
    Detects token reuse / replay attacks and revokes all user sessions on violation.
    """
    try:
        payload = decode_token(refresh_token_str)
    except Exception as e:
        logger.warning(f"Invalid refresh token decode attempt: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type, expected refresh token",
        )

    user_email: Optional[str] = payload.get("sub")
    session_id: Optional[str] = payload.get("sid")
    token_jti: Optional[str] = payload.get("jti")

    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token payload",
        )

    # 1. Resolve User
    user_res = await db.execute(select(User).where(User.email == user_email))
    user = user_res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # 2. Look up session
    session = None
    if session_id:
        sess_res = await db.execute(select(UserSession).where(UserSession.session_id == session_id))
        session = sess_res.scalar_one_or_none()
    elif token_jti:
        sess_res = await db.execute(select(UserSession).where(UserSession.refresh_token_jti == token_jti))
        session = sess_res.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    # 3. Check for Token Reuse / Theft
    # If session doesn't exist, is revoked, or presented token_jti does not match current active token_jti:
    is_compromised = (
        session is None
        or session.is_revoked
        or (session.expires_at and session.expires_at < now)
        or (token_jti and session.refresh_token_jti != token_jti)
    )

    if is_compromised:
        logger.warning(
            f"SECURITY: Refresh token reuse/theft detected for user {user_email}. "
            f"Revoking all active sessions for user_id={user.id}."
        )
        # Invalidate all user sessions to contain potential breach
        await revoke_all_user_sessions(db, user.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token. Session terminated for security.",
        )

    # 4. Issue new rotated tokens
    new_refresh_jti = uuid.uuid4().hex
    new_refresh_token = create_refresh_token(
        subject=user.email,
        session_id=session.session_id,
        jti=new_refresh_jti,
    )
    new_access_token = create_access_token(
        data={"sub": user.email},
        session_id=session.session_id,
    )

    # Update session with new active token hash and JTI
    session.refresh_token_jti = new_refresh_jti
    session.refresh_token_hash = hash_token(new_refresh_token)
    if user_agent:
        session.user_agent = user_agent[:500]
    if ip_address:
        session.ip_address = ip_address[:45]

    await db.commit()
    return new_access_token, new_refresh_token, user


async def revoke_session(db: AsyncSession, session_id: str) -> bool:
    """Revoke a single active session."""
    res = await db.execute(select(UserSession).where(UserSession.session_id == session_id))
    session = res.scalar_one_or_none()
    if session and not session.is_revoked:
        session.is_revoked = True
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        return True
    return False


async def revoke_all_user_sessions(db: AsyncSession, user_id: int) -> int:
    """Revoke all active sessions for a user (e.g. on password reset or change)."""
    stmt = (
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.is_revoked.is_(False))
        .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount
