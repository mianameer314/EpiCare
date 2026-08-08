"""
Rate limit dependencies — FastAPI dependency factories applied to routers.

Usage:
    @router.post("/login", dependencies=[Depends(LOGIN_LIMIT)])
"""
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, status

from app.rate_limit.core import get_rate_limiter


@dataclass(frozen=True)
class RateLimit:
    """A named rate limit: `limit` requests per `window_seconds`."""

    prefix: str
    limit: int
    window_seconds: int

    async def __call__(self, request: Request) -> None:
        """Enforce the limit for the current request."""
        client_ip = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()

        user_id = getattr(request.state, "user_id", None)
        identity = f"{client_ip}" + (f":{user_id}" if user_id else "")

        limiter = get_rate_limiter()
        result = await limiter.check(
            key=f"{self.prefix}:{identity}",
            limit=self.limit,
            window_seconds=self.window_seconds,
        )

        if not result.allowed:
            retry_after = result.retry_after or self.window_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests, please try again later",
                headers={"Retry-After": str(retry_after)},
            )
