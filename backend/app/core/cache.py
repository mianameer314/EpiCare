"""
Caching layer — Redis-backed TTL cache with an in-memory fallback.

Used for: model registry status, frequently-read aggregates, RAG retrieval
hits. Invalidation helpers (delete / delete_pattern) keep reads consistent
after writes.

Design mirrors the rate limiter: Redis first, graceful in-memory fallback.
"""
import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)


class MemoryCache:
    """Thread-safe-ish TTL store (single process, best effort)."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[float, str]] = {}

    def get(self, key: str) -> Any | None:
        item = self._store.get(key)
        if item is None:
            return None
        expires_at, raw = item
        if time.monotonic() > expires_at:
            self._store.pop(key, None)
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        self._store[key] = (time.monotonic() + ttl_seconds, json.dumps(value))

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def delete_pattern(self, pattern: str) -> None:
        prefix = pattern.rstrip("*")
        for key in list(self._store.keys()):
            if key.startswith(prefix):
                self._store.pop(key, None)


class Cache:
    """Redis-backed TTL cache with in-memory fallback."""

    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._redis = None
        self._memory = MemoryCache()
        self._using_redis = False

    async def init(self) -> None:
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
            logger.info("Cache: using Redis (%s)", self._redis_url)
        except Exception as exc:
            self._redis = None
            self._using_redis = False
            logger.warning("Cache: Redis unavailable (%s) — using in-memory fallback", exc)

    async def close(self) -> None:
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception as exc:
                logger.warning("Cache: error closing Redis: %s", exc)
            self._redis = None

    async def get(self, key: str) -> Any | None:
        if self._using_redis and self._redis is not None:
            try:
                raw = await self._redis.get(key)
                if raw is None:
                    return None
                return json.loads(raw)
            except Exception as exc:
                logger.error("Cache: Redis get failed (%s) — falling back", exc)
        return self._memory.get(key)

    async def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        payload = json.dumps(value)
        if self._using_redis and self._redis is not None:
            try:
                await self._redis.set(key, payload, ex=ttl_seconds)
                return
            except Exception as exc:
                logger.error("Cache: Redis set failed (%s) — falling back", exc)
        self._memory.set(key, value, ttl_seconds)

    async def delete(self, key: str) -> None:
        if self._using_redis and self._redis is not None:
            try:
                await self._redis.delete(key)
                return
            except Exception as exc:
                logger.error("Cache: Redis delete failed (%s) — falling back", exc)
        self._memory.delete(key)

    async def delete_pattern(self, pattern: str) -> None:
        """Delete every key matching `prefix*` (used for list invalidations)."""
        if self._using_redis and self._redis is not None:
            try:
                keys = list(await self._redis.scan_iter(match=pattern))
                if keys:
                    await self._redis.delete(*keys)
                return
            except Exception as exc:
                logger.error("Cache: Redis delete_pattern failed (%s) — falling back", exc)
        self._memory.delete_pattern(pattern)

    @property
    def using_redis(self) -> bool:
        return self._using_redis


_cache: Cache | None = None


async def init_cache(redis_url: str) -> Cache:
    """Initialise the global cache."""
    global _cache
    if _cache is None:
        _cache = Cache(redis_url)
        await _cache.init()
    return _cache


async def close_cache() -> None:
    """Gracefully close the global cache."""
    global _cache
    if _cache is not None:
        await _cache.close()
        _cache = None


def get_cache() -> Cache:
    """Return the global cache (created at startup)."""
    if _cache is None:
        raise RuntimeError("Cache not initialised — call init_cache() first")
    return _cache
