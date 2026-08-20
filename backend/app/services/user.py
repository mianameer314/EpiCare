"""
User service — registration, login lookup, and profile queries (async).
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models.enums import UserRole
from app.models.pending_registration import PendingRegistration

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

async def register_user(db: AsyncSession, data: UserRegister, background_tasks: BackgroundTasks) -> dict:
    """Public user registration. Creates a PendingRegistration and sends OTP."""
  
    
    # 1. Check if verified user already exists
    existing_email = await get_user_by_email(db, data.email)
    if existing_email:
        if existing_email.is_email_verified:
            raise conflict_error("EMAIL_ALREADY_REGISTERED", "A user with this email address already exists.")
        else:
            # If an unverified user somehow exists in the main table (legacy), delete it to start fresh
            await db.delete(existing_email)
            await db.commit()

    existing_phone = await get_user_by_phone(db, data.phone_number)
    if existing_phone:
        if existing_phone.is_phone_verified:
            raise conflict_error("PHONE_ALREADY_REGISTERED", "A user with this phone number already exists.")
        else:
            await db.delete(existing_phone)
            await db.commit()

    if data.role == UserRole.DOCTOR and not data.pmdc_number:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="PMDC number is required for doctors")

    # 2. Check Doctor PMDC in main profiles
    if data.role == UserRole.DOCTOR:
        from app.models.doctor_profile import DoctorProfile
        res = await db.execute(select(DoctorProfile).where(DoctorProfile.pmdc_number == data.pmdc_number))
        if res.scalar_one_or_none():
            raise conflict_error("PMDC_ALREADY_REGISTERED", "A doctor with this PMDC number already exists.")

    otp_plain = _generate_otp()
    
    # 3. Create or update PendingRegistration
    res = await db.execute(select(PendingRegistration).where(PendingRegistration.email == data.email))
    pending = res.scalar_one_or_none()
    
    if pending:
        pending.password_hash = hash_password(data.password)
        pending.phone_number = data.phone_number
        pending.full_name = data.full_name
        pending.role = data.role
        pending.pmdc_number = data.pmdc_number
        pending.otp_secret_hash = hash_password(otp_plain)
        pending.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    else:
        pending = PendingRegistration(
            email=data.email,
            password_hash=hash_password(data.password),
            phone_number=data.phone_number,
            full_name=data.full_name,
            role=data.role,
            pmdc_number=data.pmdc_number,
            otp_secret_hash=hash_password(otp_plain),
            otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10)
        )
        db.add(pending)
    
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise conflict_error("ALREADY_REGISTERED", "Registration data conflict.")
        
    # 4. Dispatch email
    background_tasks.add_task(send_verification_email, pending.email, otp_plain, pending.full_name)
    
    return {
        "message": "Verification code sent to your email.",
        "email": pending.email,
        "full_name": pending.full_name,
        "role": pending.role,
        "is_active": True,
        "is_email_verified": False,
        "is_phone_verified": False,
    }


async def verify_registration_otp(db: AsyncSession, email: str, otp: str) -> bool:
    """Verify OTP for a pending registration and promote to User."""
    from app.core.security import verify_password
    from app.models.pending_registration import PendingRegistration
    from app.models.enums import UserRole
    
    res = await db.execute(select(PendingRegistration).where(PendingRegistration.email == email))
    pending = res.scalar_one_or_none()
    
    if not pending:
        return False
        
    if datetime.now(timezone.utc) > pending.otp_expires_at:
        return False
        
    if not verify_password(otp, pending.otp_secret_hash):
        return False
        
    # OTP is valid -> Promote to actual User
    user = User(
        email=pending.email,
        password_hash=pending.password_hash,
        phone_number=pending.phone_number,
        full_name=pending.full_name,
        role=pending.role,
        is_active=True,
        is_email_verified=True,  # They just verified it
        is_phone_verified=False,
    )
    db.add(user)
    await db.flush()  # Get user.id
    
    # Create Role-Specific Profile
    if user.role == UserRole.PATIENT:
        from app.models.patient_profile import PatientProfile
        profile = PatientProfile(
            user_id=user.id,
            date_of_birth=datetime.now(timezone.utc).date()
        )
        db.add(profile)
    elif user.role == UserRole.DOCTOR:
        from app.models.doctor_profile import DoctorProfile
        profile = DoctorProfile(
            user_id=user.id,
            pmdc_number=pending.pmdc_number,
            specialty="Neurologist"
        )
        db.add(profile)
    elif user.role == UserRole.CARETAKER:
        from app.models.caretaker_profile import CaretakerProfile
        profile = CaretakerProfile(
            user_id=user.id
        )
        db.add(profile)
        
    # Delete pending record
    await db.delete(pending)
    await db.commit()
    
    return True


async def resend_registration_otp(db: AsyncSession, email: str, background_tasks: BackgroundTasks) -> bool:
    """Generate and send a new OTP for a pending registration."""
    from app.models.pending_registration import PendingRegistration
    res = await db.execute(select(PendingRegistration).where(PendingRegistration.email == email))
    pending = res.scalar_one_or_none()
    
    if not pending:
        return False
        
    otp_plain = _generate_otp()
    pending.otp_secret_hash = hash_password(otp_plain)
    pending.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.commit()
    
    background_tasks.add_task(send_verification_email, pending.email, otp_plain, pending.full_name)
    return True


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


async def check_reset_otp(db: AsyncSession, user: User, otp: str) -> bool:
    """Verify the OTP is valid without consuming it."""
    from app.core.security import verify_password
    
    if not user.otp_secret_hash or not user.otp_expires_at:
        return False
        
    if datetime.now(timezone.utc) > user.otp_expires_at:
        return False
        
    if not verify_password(otp, user.otp_secret_hash):
        return False
        
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
    update_data = data.model_dump(exclude_unset=True)
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
