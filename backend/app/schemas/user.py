"""
User schemas — authentication, registration, and profile management.
Mirrors BRANDING-SYSTEM app/schemas/user.py.
"""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ------------------------------------------------------------------
# Registration
# ------------------------------------------------------------------

class UserRegister(BaseModel):
    """Request body for public user registration."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=150)


# ------------------------------------------------------------------
# Login
# ------------------------------------------------------------------

class LoginRequest(BaseModel):
    """Request body for login."""

    email: EmailStr
    password: str


# ------------------------------------------------------------------
# Profile Update
# ------------------------------------------------------------------

class UserProfileUpdate(BaseModel):
    """User updating their own account fields."""

    full_name: str | None = Field(None, min_length=1, max_length=150)


# ------------------------------------------------------------------
# Change Password
# ------------------------------------------------------------------

class ChangePasswordRequest(BaseModel):
    """Request to change password."""

    current_password: str
    new_password: str = Field(..., min_length=8)


# ------------------------------------------------------------------
# User Response
# ------------------------------------------------------------------

class UserOut(BaseModel):
    """Response model (never exposes password)."""

    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ------------------------------------------------------------------
# Authentication
# ------------------------------------------------------------------

class Token(BaseModel):
    """JWT response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    """Decoded JWT payload."""

    sub: str  # email
    type: str  # access | refresh
    exp: int
