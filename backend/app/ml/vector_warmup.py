"""
pgvector warm-up — run a representative vector search at startup so index
pages are resident in memory, eliminating cold-start latency on the first
real RAG query.
"""
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import settings

logger = logging.getLogger(__name__)


async def warm_up_vector_index(engine: AsyncEngine) -> dict[str, object]:
    """
    Execute a no-op-adjacent vector query against rag_chunks if present.

    Returns a status dict with measured latency; never raises — failures are
    logged and reported as unavailable so startup is never blocked.
    """
    import time

    start = time.perf_counter()
    try:
        async with engine.connect() as conn:
            table_exists = await conn.execute(
                text(
                    "SELECT to_regclass('public.rag_chunks') IS NOT NULL AS exists_flag"
                )
            )
            exists = bool(table_exists.scalar())
            if not exists:
                logger.info("pgvector warm-up: rag_chunks not found, skipping")
                return {"status": "skipped", "table": "rag_chunks", "duration_ms": 0}

            query = text(
                """
                SELECT id FROM rag_chunks
                ORDER BY embedding <=> :query_vec
                LIMIT 1
                """
            )
            await conn.execute(
                query,
                {"query_vec": [0.0] * settings.VECTOR_DIMENSION},
            )

        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.info(
            "pgvector warm-up complete",
            extra={"duration_ms": duration_ms, "vector_dimension": settings.VECTOR_DIMENSION},
        )
        return {"status": "ok", "table": "rag_chunks", "duration_ms": duration_ms}
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.warning(
            "pgvector warm-up failed",
            extra={"duration_ms": duration_ms, "error": str(exc)},
        )
        return {"status": "unavailable", "table": "rag_chunks", "duration_ms": duration_ms, "error": str(exc)}
