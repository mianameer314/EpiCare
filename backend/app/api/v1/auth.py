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
    ForgotPasswordRequest,
    VerifyResetOTPRequest,
    ResetPasswordRequest,
)
from app.services import user as user_service
from app.models.doctor_profile import DoctorProfile
from sqlalchemy import select
from app.models.enums import UserRole

router = APIRouter(prefix="/auth", tags=["🔐 Authentication"])


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(REGISTER_LIMIT)],
    summary="Register a new user",
    description="Registers a new user (Patient, Doctor, or Caretaker). A 6-digit OTP will be sent to the user's email address.",
    responses={
        400: {"description": "Bad Request - Validation error or email already registered"},
        429: {"description": "Too Many Requests - Rate limit exceeded"},
    },
)
async def register(data: UserRegister, db: DbDep, background_tasks: BackgroundTasks):
    """Public user registration. Generates and sends OTP via email."""
    return await user_service.register_user(db, data, background_tasks)


@router.post(
    "/login",
    response_model=Token,
    dependencies=[Depends(LOGIN_LIMIT)],
    summary="Login user",
    description="Authenticate with email and password to receive access and refresh tokens. Ensures account is active, email is verified, and (if Doctor) PMDC is verified.",
    responses={
        400: {"description": "Bad Request"},
        401: {"description": "Unauthorized - Invalid email or password"},
        403: {"description": "Forbidden - Account deactivated, unverified email, or unverified PMDC"},
        429: {"description": "Too Many Requests - Login rate limit exceeded"},
    },
)
async def login(data: LoginRequest, db: DbDep):
    """Authenticate and get access + refresh tokens."""
    user = await user_service.get_user_by_email(db, data.email)
    if not user:
        from app.models.pending_registration import PendingRegistration
        res = await db.execute(select(PendingRegistration).where(PendingRegistration.email == data.email))
        pending = res.scalar_one_or_none()
        if pending and verify_password(data.password, pending.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email is not verified. Please verify your email first.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not verified. Please verify your email first.",
        )
        
    from app.models.enums import UserRole
    if user.role == UserRole.DOCTOR:
        
        
        result = await db.execute(select(DoctorProfile).where(DoctorProfile.user_id == user.id))
        doctor_profile = result.scalar_one_or_none()
        
        if doctor_profile and not doctor_profile.is_pmdc_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your doctor profile is pending PMDC verification by an admin.",
            )

    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(subject=user.email)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/verify-email",
    status_code=status.HTTP_200_OK,
    summary="Verify user email",
    description="Verify the 6-digit OTP sent to the user's email.",
    responses={
        400: {"description": "Bad Request - Invalid or expired OTP"},
        404: {"description": "Not Found - User not found"},
    },
)
async def verify_email(data: VerifyOTPRequest, db: DbDep):
    """Verify the 6-digit OTP sent to user's email."""
    # 1. Check if user is fully registered already
    user = await user_service.get_user_by_email(db, data.email)
    if user and user.is_email_verified:
        return {"message": "Email is already verified"}
        
    # 2. Try to verify via pending registrations
    is_valid_pending = await user_service.verify_registration_otp(db, data.email, data.otp)
    if is_valid_pending:
        return {"message": "Email verified successfully"}
        
    # 3. Fallback to legacy unverified users if they somehow still exist in the DB
    if user and not user.is_email_verified:
        is_valid_legacy = await user_service.verify_user_otp(db, user, data.otp)
        if is_valid_legacy:
            return {"message": "Email verified successfully"}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")


@router.post(
    "/resend-otp",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(REGISTER_LIMIT)],
    summary="Resend OTP",
    description="Resend a new 6-digit OTP to the provided email if the account is unverified. Defends against enumeration by returning success regardless of user existence.",
    responses={
        400: {"description": "Bad Request - Email is already verified"},
        429: {"description": "Too Many Requests - Rate limit exceeded"},
    },
)
async def resend_otp(data: ResendOTPRequest, db: DbDep, background_tasks: BackgroundTasks):
    """Resend a new OTP to the user's email."""
    user = await user_service.get_user_by_email(db, data.email)
    if user and user.is_email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already verified")
        
    if user and not user.is_email_verified:
        # Legacy unverified user
        await user_service.generate_and_send_otp(db, user, background_tasks)
        return {"message": "If an account exists, a new OTP has been sent."}
        
    # Try pending registration
    resend_success = await user_service.resend_registration_otp(db, data.email, background_tasks)
    
    # We return success either way to prevent email enumeration
    return {"message": "If an account exists, a new OTP has been sent."}


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(REGISTER_LIMIT)],
    summary="Request password reset",
    description="Sends an OTP to the user's email if the account exists. Protects against enumeration by always returning success.",
    responses={
        429: {"description": "Too Many Requests - Rate limit exceeded"},
    },
)
async def forgot_password(data: ForgotPasswordRequest, db: DbDep, background_tasks: BackgroundTasks):
    """Initiate password reset by sending an OTP."""
    user = await user_service.get_user_by_email(db, data.email)
    if user:
        await user_service.generate_and_send_otp(db, user, background_tasks)
        
    return {"message": "OTP sent successfully to your email address."}


@router.post(
    "/verify-reset-otp",
    status_code=status.HTTP_200_OK,
    summary="Verify reset OTP",
    description="Check if the OTP is valid without resetting the password.",
    responses={
        400: {"description": "Bad Request - Invalid or expired OTP"},
        404: {"description": "Not Found - User not found"},
    },
)
async def verify_reset_otp(data: VerifyResetOTPRequest, db: DbDep):
    """Verify OTP before moving to password reset screen."""
    user = await user_service.get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    is_valid = await user_service.check_reset_otp(db, user, data.otp)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
        
    return {"message": "OTP is valid"}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Reset password",
    description="Verify OTP and reset password for the user.",
    responses={
        400: {"description": "Bad Request - Invalid or expired OTP"},
        404: {"description": "Not Found - User not found"},
    },
)
async def reset_password(data: ResetPasswordRequest, db: DbDep):
    """Verify OTP and set new password."""
    user = await user_service.get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    is_valid = await user_service.reset_user_password(db, user, data.otp, data.new_password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
        
    return {"message": "Password reset successfully"}


@router.post(
    "/refresh",
    response_model=Token,
    dependencies=[Depends(REFRESH_LIMIT)],
    summary="Refresh auth tokens",
    description="Generate a new set of access and refresh tokens using a valid existing refresh token.",
    responses={
        401: {"description": "Unauthorized - Invalid or expired refresh token"},
        429: {"description": "Too Many Requests"},
    },
)
async def refresh_token(current_user: RefreshUser):
    """Get new tokens using a refresh token."""
    access_token = create_access_token(data={"sub": current_user.email})
    refresh_token = create_refresh_token(subject=current_user.email)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout user",
    description="Acknowledge logout intention (client-side clears the tokens).",
    responses={
        401: {"description": "Unauthorized"},
    },
)
async def logout(current_user: CurrentUser):
    """Invalidate the client session (client discards tokens)."""
    return None


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current user details",
    description="Retrieve the base User model information (email, role, verification status) for the authenticated user.",
    responses={
        401: {"description": "Unauthorized"},
    },
)
async def get_current_user_profile(current_user: CurrentUser):
    """Get current user profile."""
    return current_user


@router.patch(
    "/me",
    response_model=UserOut,
    summary="Update user details",
    description="Update base user account information (like name or phone number).",
    responses={
        400: {"description": "Bad Request - Validation error"},
        401: {"description": "Unauthorized"},
    },
)
async def update_profile(data: UserProfileUpdate, current_user: CurrentUser, db: DbDep):
    """Update current user's own profile fields."""
    return await user_service.update_profile(db, current_user, data)


@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change account password",
    description="Change the authenticated user's password securely by verifying their current password.",
    responses={
        400: {"description": "Bad Request - Validation error"},
        401: {"description": "Unauthorized - Incorrect current password"},
    },
)
async def change_password(data: ChangePasswordRequest, current_user: CurrentUser, db: DbDep):
    """Change own password."""
    await user_service.change_password(
        db, current_user, data.current_password, data.new_password
    )
    return None


from app.core.config import settings

@router.get(
    "/firebase-config",
    summary="Get Firebase Web Client Config",
    description="Returns public Firebase configuration for client push notifications (PWA and Web).",
)
async def get_firebase_web_config():
    """Returns the non-sensitive public Firebase Web configuration."""
    return {
        "apiKey": settings.FIREBASE_WEB_API_KEY,
        "authDomain": settings.FIREBASE_WEB_AUTH_DOMAIN or (f"{settings.FIREBASE_PROJECT_ID}.firebaseapp.com" if settings.FIREBASE_PROJECT_ID else ""),
        "projectId": settings.FIREBASE_PROJECT_ID or "epicare-2fc46",
        "storageBucket": settings.FIREBASE_STORAGE_BUCKET or (f"{settings.FIREBASE_PROJECT_ID}.appspot.com" if settings.FIREBASE_PROJECT_ID else ""),
        "messagingSenderId": settings.FIREBASE_MESSAGING_SENDER_ID,
        "appId": settings.FIREBASE_WEB_APP_ID,
        "vapidKey": settings.FIREBASE_WEB_VAPID_KEY,
    }
