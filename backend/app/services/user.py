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
# Registration
# ---------------------------------------------------------

async def register_user(db: AsyncSession, data: UserRegister) -> User:
    """Public user registration. Raises 409 on duplicate email."""
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise conflict_error("EMAIL_ALREADY_REGISTERED", "Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


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
