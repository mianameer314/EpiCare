import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------- Password Hashing ----------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_token(token: str) -> str:
    """Compute SHA-256 hash of a token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ---------- JWT Tokens ----------

def create_access_token(
    data: dict, 
    session_id: str | None = None, 
    expires_delta: timedelta | None = None
) -> str:
    """Create a signed JWT access token with standard claims."""
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MINUTES)
    )
    to_encode = data.copy()
    to_encode.update({
        "exp": expire,
        "iat": now,
        "type": "access",
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "jti": uuid.uuid4().hex,
    })
    if session_id:
        to_encode["sid"] = session_id
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    subject: str, 
    session_id: str | None = None, 
    jti: str | None = None, 
    expires_delta: timedelta | None = None
) -> str:
    """Create a signed JWT refresh token with session identification."""
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta or timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS)
    )
    token_jti = jti or uuid.uuid4().hex
    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": now,
        "type": "refresh",
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "jti": token_jti,
    }
    if session_id:
        to_encode["sid"] = session_id
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises jwt.PyJWTError on failure."""
    return jwt.decode(
        token, 
        settings.JWT_SECRET, 
        algorithms=[settings.JWT_ALGORITHM],
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER,
        options={"require": ["exp", "type"]},
    )
