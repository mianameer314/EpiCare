"""
User service — registration, login lookup, and profile queries (async).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import conflict_error
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserRegister, UserProfileUpdate


# ---------------------------------------------------------
# Queries
# ---------------------------------------------------------

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


# ---------------------------------------------------------
# Registration & Verification
# ---------------------------------------------------------

import secrets
from datetime import datetime, timedelta, timezone
from app.services.email import send_verification_email
from fastapi import BackgroundTasks

def _generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(6))

async def register_user(db: AsyncSession, data: UserRegister, background_tasks: BackgroundTasks) -> User:
    """Public user registration. Raises 409 on duplicate email."""
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise conflict_error("EMAIL_ALREADY_REGISTERED", "Email already registered")

    otp_plain = _generate_otp()
    
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        is_active=True,
        is_verified=False,
        otp_secret_hash=hash_password(otp_plain),
        otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Dispatch email
    background_tasks.add_task(send_verification_email, user.email, otp_plain, user.full_name)
    
    return user


async def generate_and_send_otp(db: AsyncSession, user: User, background_tasks: BackgroundTasks) -> None:
    """Generate a new OTP, update user, and send email."""
    otp_plain = _generate_otp()
    user.otp_secret_hash = hash_password(otp_plain)
    user.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.commit()
    
    background_tasks.add_task(send_verification_email, user.email, otp_plain, user.full_name)


async def verify_user_otp(db: AsyncSession, user: User, otp: str) -> bool:
    """Verify the OTP. If valid, mark as verified and clear OTP fields."""
    from app.core.security import verify_password
    
    if not user.otp_secret_hash or not user.otp_expires_at:
        return False
        
    if datetime.now(timezone.utc) > user.otp_expires_at:
        return False
        
    if not verify_password(otp, user.otp_secret_hash):
        return False
        
    user.is_verified = True
    user.otp_secret_hash = None
    user.otp_expires_at = None
    await db.commit()
    return True


# ---------------------------------------------------------
# Profile Update
# ---------------------------------------------------------

async def update_profile(db: AsyncSession, user: User, data: UserProfileUpdate) -> User:
    """Update the current user's own profile fields."""
    update_data = data.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> None:
    """Verify and replace the user's password."""
    from app.core.security import verify_password

    if not verify_password(current_password, user.password_hash):
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    user.password_hash = hash_password(new_password)
    await db.commit()
