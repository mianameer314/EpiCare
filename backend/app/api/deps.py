"""
API dependencies — async DB session, bearer auth guards, current-user resolution.

Every session is created from the async_sessionmaker, tagged with the current
trace_id (SQLAlchemy query comments for end-to-end correlation), and closed
in a finally block.
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.middleware.request_context import request_id_var
from app.models.user import User
from app.models.enums import UserRole

# ---------- Security Scheme ----------

bearer_scheme = HTTPBearer()

# ---------- Dependency Aliases ----------

DbDep = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]


# ---------- Auth Guards ----------

async def get_current_user(credentials: TokenDep, db: DbDep) -> User:
    """Decode JWT and return the authenticated User, or raise 401."""
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type, expected access token",
            )
        user_email: str | None = payload.get("sub")
        if user_email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return user


async def get_refresh_user(credentials: TokenDep, db: DbDep) -> User:
    """Decode refresh JWT and return the user."""
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type, expected refresh token",
            )
        user_email: str | None = payload.get("sub")
        if user_email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    result = await db.execute(select(User).where(User.email == user_email))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
RefreshUser = Annotated[User, Depends(get_refresh_user)]


# ---------- Role Checking ----------

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: CurrentUser) -> User:
        print(f"DEBUG: user.role='{user.role}' ({type(user.role)}), allowed_roles='{self.allowed_roles}' ([{type(self.allowed_roles[0])}])")
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted",
            )
        return user


async def get_verified_doctor(user: Annotated[User, Depends(RoleChecker([UserRole.DOCTOR]))], db: DbDep) -> User:
    """Ensure the doctor has been PMDC verified by admin."""
    from app.models.doctor_profile import DoctorProfile
    
    result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    
    if not profile or not profile.is_pmdc_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Doctor profile pending PMDC verification",
        )
    return user

VerifiedDoctor = Annotated[User, Depends(get_verified_doctor)]
