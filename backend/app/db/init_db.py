import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.user import User
from app.models.enums import UserRole
from app.core.security import hash_password
from app.core.config import settings

logger = logging.getLogger(__name__)

async def init_superuser() -> None:
    """Initialize the super admin user if they don't already exist."""
    async with SessionLocal() as db:
        try:
            # Check if admin already exists
            result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
            user = result.scalar_one_or_none()
            
            if user:
                logger.info(f"Admin user already existing ({settings.ADMIN_EMAIL})")
                return
                
            logger.info(f"Creating super admin user: {settings.ADMIN_EMAIL}")
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                phone_number=settings.ADMIN_PHONE_NUMBER,
                full_name=settings.ADMIN_FULL_NAME,
                role=UserRole.ADMIN,
                is_active=True,
                is_email_verified=True,
                is_phone_verified=True,
            )
            db.add(admin_user)
            await db.commit()
            logger.info("Super admin user created successfully.")
            
        except Exception as e:
            logger.error(f"Failed to initialize super admin: {e}")
            await db.rollback()
