"""
Rate limiting — Redis-backed sliding window with an in-memory fallback.

The limiter degrades gracefully: if Redis is unavailable the service keeps
serving traffic using a per-process in-memory limiter (documented behavior),
so an infrastructure hiccup never takes the whole API down.

Mirrors BRANDING-SYSTEM app/rate_limit/ layout.
"""
import asyncio
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RateLimitResult:
    """Outcome of a rate-limit check."""

    allowed: bool
    remaining: int
    retry_after: int | None = None


class MemoryRateLimiter:
    """Simple per-key sliding window using monotonic timestamps."""

    def __init__(self) -> None:
        self._windows: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        now = time.monotonic()
        window = self._windows[key]
        cutoff = now - window_seconds
        while window and window[0] < cutoff:
            window.popleft()

        if len(window) >= limit:
            oldest = window[0] if window else now
            retry_after = max(1, int(window_seconds - (now - oldest)))
            return RateLimitResult(allowed=False, remaining=0, retry_after=retry_after)

        window.append(now)
        return RateLimitResult(allowed=True, remaining=limit - len(window))


class RateLimiter:
    """Redis sliding-window limiter that falls back to MemoryRateLimiter."""

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._redis = None
        self._memory = MemoryRateLimiter()
        self._using_redis = False
        self._redis_unavailable = False

    @property
    def using_redis(self) -> bool:
        return self._using_redis and self._redis is not None

    @property
    def redis_unavailable(self) -> bool:
        return self._redis_unavailable

    async def init(self) -> None:
        """Try to connect to Redis. On failure, record unavailability."""
        try:
            import redis.asyncio as aioredis

            client = aioredis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=1.5,
                socket_timeout=2,
            )
            await client.ping()
            self._redis = client
            self._using_redis = True
            self._redis_unavailable = False
            logger.info("Rate limiter: using Redis (%s)", self._redis_url)
        except Exception as exc:
            self._redis = None
            self._using_redis = False
            self._redis_unavailable = True
            logger.warning(
                "Rate limiter: Redis unavailable (%s) — using in-memory fallback", exc
            )

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception as exc:
                logger.warning("Rate limiter: error closing Redis: %s", exc)
            self._redis = None
            self._using_redis = False

    async def check(
        self, key: str, limit: int, window_seconds: int, fail_closed: bool = False
    ) -> RateLimitResult:
        if fail_closed and (self._redis_unavailable or self._redis is None or not self._using_redis):
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication rate limiter temporarily unavailable",
            )

        if self._using_redis and self._redis is not None:
            try:
                return await self._check_redis(key, limit, window_seconds)
            except Exception as exc:
                logger.error("Rate limiter: Redis check failed (%s)", exc)
                self._redis_unavailable = True
                if fail_closed:
                    from fastapi import HTTPException, status
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Authentication rate limiter temporarily unavailable",
                    )
        return self._memory.check(key, limit, window_seconds)

    async def _check_redis(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        now_ms = int(time.time() * 1000)
        window_ms = window_seconds * 1000
        bucket = f"ratelimit:{key}"

        async with self._redis.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(bucket, 0, now_ms - window_ms)
            pipe.zadd(bucket, {str(now_ms): now_ms})
            pipe.zcard(bucket)
            pipe.expire(bucket, window_seconds)
            results = await pipe.execute()

        count = int(results[2])
        remaining = max(0, limit - count)
        if count > limit:
            return RateLimitResult(allowed=False, remaining=0, retry_after=window_seconds)
        return RateLimitResult(allowed=True, remaining=remaining)

    @property
    def using_redis(self) -> bool:
        return self._using_redis


_rate_limiter: RateLimiter | None = None


async def init_rate_limiter(redis_url: str) -> RateLimiter:
    """Initialise the global rate limiter."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter(redis_url)
        await _rate_limiter.init()
    return _rate_limiter


async def close_rate_limiter() -> None:
    """Gracefully close the global rate limiter."""
    global _rate_limiter
    if _rate_limiter is not None:
        await _rate_limiter.close()
        _rate_limiter = None


def get_rate_limiter() -> RateLimiter:
    """Return the global limiter (created at startup)."""
    if _rate_limiter is None:
        raise RuntimeError("Rate limiter not initialised — call init_rate_limiter() first")
    return _rate_limiter
