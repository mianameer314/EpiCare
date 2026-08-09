"""
User schemas — authentication, registration, and profile management.
"""
from datetime import datetime

from pydantic import EmailStr, Field

from app.schemas.base import StrictDatetime, StrictModel
from app.models.enums import UserRole


# ------------------------------------------------------------------
# Registration
# ------------------------------------------------------------------

class UserRegister(StrictModel):
    """Request body for public user registration."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    phone_number: str = Field(..., min_length=10, max_length=15)
    full_name: str = Field(..., min_length=1, max_length=150)
    role: UserRole = Field(default=UserRole.PATIENT)
    
    # Optional field for doctor registration
    pmdc_number: str | None = Field(None, description="Required if role is DOCTOR")


# ------------------------------------------------------------------
# Login
# ------------------------------------------------------------------

class LoginRequest(StrictModel):
    """Request body for login."""

    email: EmailStr
    password: str


# ------------------------------------------------------------------
# Profile Update
# ------------------------------------------------------------------

class UserProfileUpdate(StrictModel):
    """User updating their own account fields."""

    full_name: str | None = Field(None, min_length=1, max_length=150)
    phone_number: str | None = Field(None, min_length=10, max_length=15)


# ------------------------------------------------------------------
# Change Password
# ------------------------------------------------------------------

class ChangePasswordRequest(StrictModel):
    """Request to change password."""

    current_password: str
    new_password: str = Field(..., min_length=8)


# ------------------------------------------------------------------
# Email Verification (OTP)
# ------------------------------------------------------------------

class VerifyOTPRequest(StrictModel):
    """Request body to verify OTP."""

    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class ResendOTPRequest(StrictModel):
    """Request body to resend OTP."""

    email: EmailStr


# ------------------------------------------------------------------
# User Response
# ------------------------------------------------------------------

class UserOut(StrictModel):
    """Response model (never exposes password)."""

    id: int
    email: EmailStr
    phone_number: str | None
    full_name: str
    role: UserRole
    is_active: bool
    is_email_verified: bool
    is_phone_verified: bool
    created_at: StrictDatetime
    updated_at: StrictDatetime

    model_config = {"from_attributes": True, "strict": True}


# ------------------------------------------------------------------
# Authentication
# ------------------------------------------------------------------

class Token(StrictModel):
    """JWT response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(StrictModel):
    """Decoded JWT payload."""

    sub: str  # email
    type: str  # access | refresh
    exp: int
