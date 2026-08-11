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

async def get_user_by_phone(db: AsyncSession, phone_number: str) -> User | None:
    result = await db.execute(select(User).where(User.phone_number == phone_number))
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
    """Public user registration. Raises 409 on duplicate email or phone."""
    from sqlalchemy.exc import IntegrityError
    
    existing_email = await get_user_by_email(db, data.email)
    if existing_email:
        raise conflict_error("EMAIL_ALREADY_REGISTERED", "Email already registered")

    existing_phone = await get_user_by_phone(db, data.phone_number)
    if existing_phone:
        raise conflict_error("PHONE_ALREADY_REGISTERED", "Phone number already registered")

    from app.models.enums import UserRole
    
    if data.role == UserRole.DOCTOR and not data.pmdc_number:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="PMDC number is required for doctors")

    otp_plain = _generate_otp()
    
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        phone_number=data.phone_number,
        full_name=data.full_name,
        role=data.role,
        is_active=True,
        is_email_verified=False,
        is_phone_verified=False,
        otp_secret_hash=hash_password(otp_plain),
        otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
    )
    db.add(user)
    
    try:
        await db.flush()  # Gets user.id without committing the transaction
        
        # Create Role-Specific Profile
        if user.role == UserRole.PATIENT:
            from app.models.patient_profile import PatientProfile
            profile = PatientProfile(
                user_id=user.id,
                date_of_birth=datetime.now(timezone.utc).date() # Placeholder, they should update later or pass in registration
            )
            db.add(profile)
        elif user.role == UserRole.DOCTOR:
            from app.models.doctor_profile import DoctorProfile
            profile = DoctorProfile(
                user_id=user.id,
                pmdc_number=data.pmdc_number,
                specialty="Neurologist"
            )
            db.add(profile)
        elif user.role == UserRole.CARETAKER:
            from app.models.caretaker_profile import CaretakerProfile
            profile = CaretakerProfile(
                user_id=user.id
            )
            db.add(profile)
            
        await db.commit()  # Single atomic commit for both user and profile
    except IntegrityError:
        await db.rollback()
        raise conflict_error("ALREADY_REGISTERED", "User with this email, phone number, or PMDC number already exists.")
        
    await db.refresh(user)
    
    # Dispatch email
    background_tasks.add_task(send_verification_email, user.email, otp_plain, user.full_name)
    
    # Placeholder for SMS
    print(f"DEBUG (SMS Gateway Skipped): Sending OTP {otp_plain} to {user.phone_number}")
    
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
        
    user.is_email_verified = True
    user.otp_secret_hash = None
    user.otp_expires_at = None
    await db.commit()
    return True


async def reset_user_password(db: AsyncSession, user: User, otp: str, new_password: str) -> bool:
    """Verify OTP and update the user's password."""
    from app.core.security import verify_password
    
    if not user.otp_secret_hash or not user.otp_expires_at:
        return False
        
    if datetime.now(timezone.utc) > user.otp_expires_at:
        return False
        
    if not verify_password(otp, user.otp_secret_hash):
        return False
        
    user.password_hash = hash_password(new_password)
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
