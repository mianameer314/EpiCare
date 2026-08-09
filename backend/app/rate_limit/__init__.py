"""
Rate limit package — presets, dependencies, and the global limiter lifecycle.
"""
from app.rate_limit.core import (
    RateLimiter,
    close_rate_limiter,
    get_rate_limiter,
    init_rate_limiter,
)
from app.rate_limit.dependencies import RateLimit

LOGIN_LIMIT = RateLimit(prefix="login", limit=5, window_seconds=60)
REGISTER_LIMIT = RateLimit(prefix="register", limit=3, window_seconds=60)
REFRESH_LIMIT = RateLimit(prefix="refresh", limit=20, window_seconds=60)
PUBLIC_GET_LIMIT = RateLimit(prefix="public_get", limit=120, window_seconds=60)
AUTH_GET_LIMIT = RateLimit(prefix="auth_get", limit=300, window_seconds=60)
CREATE_LIMIT = RateLimit(prefix="create", limit=20, window_seconds=60)
UPDATE_LIMIT = RateLimit(prefix="update", limit=30, window_seconds=60)
DELETE_LIMIT = RateLimit(prefix="delete", limit=10, window_seconds=60)
UPLOAD_LIMIT = RateLimit(prefix="upload", limit=10, window_seconds=60)
CHAT_LIMIT = RateLimit(prefix="chat", limit=30, window_seconds=60)
SOS_LIMIT = RateLimit(prefix="sos", limit=5, window_seconds=60)
AI_GENERATE_LIMIT = RateLimit(prefix="ai_generate", limit=20, window_seconds=3600)
USER_MANAGEMENT_LIMIT = RateLimit(prefix="user_management", limit=10, window_seconds=60)

__all__ = [
    "RateLimiter",
    "RateLimit",
    "close_rate_limiter",
    "get_rate_limiter",
    "init_rate_limiter",
    "LOGIN_LIMIT",
    "REGISTER_LIMIT",
    "REFRESH_LIMIT",
    "PUBLIC_GET_LIMIT",
    "AUTH_GET_LIMIT",
    "CREATE_LIMIT",
    "UPDATE_LIMIT",
    "DELETE_LIMIT",
    "UPLOAD_LIMIT",
    "CHAT_LIMIT",
    "SOS_LIMIT",
    "AI_GENERATE_LIMIT",
    "USER_MANAGEMENT_LIMIT",
]
