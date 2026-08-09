"""
Auth routes — register, login, refresh, logout, and profile (async).
"""
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks

from app.api.deps import CurrentUser, DbDep, RefreshUser
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.rate_limit import LOGIN_LIMIT, REFRESH_LIMIT, REGISTER_LIMIT
from app.schemas.user import (
    ChangePasswordRequest,
    LoginRequest,
    Token,
    UserOut,
    UserProfileUpdate,
    UserRegister,
    VerifyOTPRequest,
    ResendOTPRequest,
)
from app.services import user as user_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(REGISTER_LIMIT)],
)
async def register(data: UserRegister, db: DbDep, background_tasks: BackgroundTasks):
    """Public user registration. Generates and sends OTP via email."""
    return await user_service.register_user(db, data, background_tasks)


@router.post("/login", response_model=Token, dependencies=[Depends(LOGIN_LIMIT)])
async def login(data: LoginRequest, db: DbDep):
    """Authenticate and get access + refresh tokens."""
    user = await user_service.get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified. Please verify your email first.",
        )

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(subject=user.email)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(data: VerifyOTPRequest, db: DbDep):
    """Verify the 6-digit OTP sent to user's email."""
    user = await user_service.get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if user.is_verified:
        return {"message": "Email is already verified"}
        
    is_valid = await user_service.verify_user_otp(db, user, data.otp)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
        
    return {"message": "Email verified successfully"}


@router.post("/resend-otp", status_code=status.HTTP_200_OK, dependencies=[Depends(REGISTER_LIMIT)])
async def resend_otp(data: ResendOTPRequest, db: DbDep, background_tasks: BackgroundTasks):
    """Resend a new OTP to the user's email."""
    user = await user_service.get_user_by_email(db, data.email)
    if not user:
        # Don't reveal user existence
        return {"message": "If an account exists, a new OTP has been sent."}
        
    if user.is_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already verified")
        
    await user_service.generate_and_send_otp(db, user, background_tasks)
    return {"message": "If an account exists, a new OTP has been sent."}


@router.post("/refresh", response_model=Token, dependencies=[Depends(REFRESH_LIMIT)])
async def refresh_token(current_user: RefreshUser):
    """Get new tokens using a refresh token."""
    access_token = create_access_token(data={"sub": current_user.email})
    refresh_token = create_refresh_token(subject=current_user.email)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(current_user: CurrentUser):
    """Invalidate the client session (client discards tokens)."""
    return None


@router.get("/me", response_model=UserOut)
async def get_current_user_profile(current_user: CurrentUser):
    """Get current user profile."""
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_profile(data: UserProfileUpdate, current_user: CurrentUser, db: DbDep):
    """Update current user's own profile fields."""
    return await user_service.update_profile(db, current_user, data)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(data: ChangePasswordRequest, current_user: CurrentUser, db: DbDep):
    """Change own password."""
    await user_service.change_password(
        db, current_user, data.current_password, data.new_password
    )
    return None

