"""
Rate limit dependencies — FastAPI dependency factories applied to routers.
Resolves client IP securely with trusted proxy validation (Finding 7).
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

from app.core.config import settings
from app.rate_limit.core import get_rate_limiter


@dataclass(frozen=True)
class RateLimit:
    """A named rate limit: `limit` requests per `window_seconds`."""

    prefix: str
    limit: int
    window_seconds: int
    fail_closed: bool = False

    async def __call__(self, request: Request) -> None:
        """Enforce the limit for the current request with trusted proxy resolution."""
        raw_ip = request.client.host if request.client else "unknown"
        trusted_ips = [ip.strip() for ip in settings.TRUSTED_PROXY_IPS.split(",") if ip.strip()]

        # Only trust X-Forwarded-For if explicitly configured AND connection is from a trusted proxy
        if settings.TRUST_PROXY_HEADERS and raw_ip in trusted_ips:
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()
            else:
                client_ip = raw_ip
        else:
            client_ip = raw_ip

        user_id = getattr(request.state, "user_id", None)
        identity = f"{client_ip}" + (f":{user_id}" if user_id else "")

        limiter = get_rate_limiter()
        result = await limiter.check(
            key=f"{self.prefix}:{identity}",
            limit=self.limit,
            window_seconds=self.window_seconds,
            fail_closed=self.fail_closed and settings.APP_ENV == "production",
        )

        if not result.allowed:
            retry_after = result.retry_after or self.window_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests, please try again later",
                headers={"Retry-After": str(retry_after)},
            )
