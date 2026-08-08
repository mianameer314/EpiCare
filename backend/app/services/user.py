"""
User service — registration, login lookup, and profile queries.
Mirrors BRANDING-SYSTEM app/services/user.py layering.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import conflict_error
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserRegister, UserProfileUpdate


# ---------------------------------------------------------
# Queries
# ---------------------------------------------------------

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


# ---------------------------------------------------------
# Registration
# ---------------------------------------------------------

def register_user(db: Session, data: UserRegister) -> User:
    """Public user registration. Raises 409 on duplicate email."""
    existing = get_user_by_email(db, data.email)
    if existing:
        raise conflict_error("EMAIL_ALREADY_REGISTERED", "Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------
# Profile Update
# ---------------------------------------------------------

def update_profile(db: Session, user: User, data: UserProfileUpdate) -> User:
    """Update the current user's own profile fields."""
    update_data = data.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """Verify and replace the user's password."""
    from app.core.security import verify_password

    if not verify_password(current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    user.password_hash = hash_password(new_password)
    db.commit()
