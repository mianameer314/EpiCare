"""
CPU-bound task executor — isolates heavy NumPy/SciPy/MNE work in a
ProcessPoolExecutor so blocking signal processing never stalls the
asyncio event loop.

Each task is timed and logged with the originating trace_id (passed
explicitly because contextvars do not cross process boundaries).
"""
import logging
import time
from concurrent.futures import ProcessPoolExecutor
from typing import Any, Callable, TypeVar

from app.core.config import settings
from app.middleware.request_context import get_request_id

logger = logging.getLogger(__name__)

T = TypeVar("T")

_pool: ProcessPoolExecutor | None = None
_pool_workers: int = max(2, min(8, (settings.ONNX_INTRA_OP_THREADS + 1) // 2))


def get_executor() -> ProcessPoolExecutor:
    """Return the shared ProcessPoolExecutor, creating it on first use."""
    global _pool
    if _pool is None:
        logger.info(
            "ProcessPoolExecutor initialised",
            extra={"workers": _pool_workers},
        )
        _pool = ProcessPoolExecutor(max_workers=_pool_workers)
    return _pool


async def shutdown_executor() -> None:
    """Gracefully shut down the process pool (called on app shutdown)."""
    global _pool
    if _pool is not None:
        _pool.shutdown(wait=False, cancel_futures=True)
        _pool = None
        logger.info("ProcessPoolExecutor shut down")


async def run_cpu_bound(fn: Callable[..., T], *args: Any, task_name: str | None = None) -> T:
    """
    Run a picklable top-level function in the process pool.

    Args:
        fn: Top-level callable (must be importable by name).
        *args: Positional arguments (must be picklable).
        task_name: Label for logs/metrics; defaults to fn.__name__.

    Returns:
        The function result.

    Raises:
        RuntimeError: wrapped when the worker raised (original preserved as cause).
    """
    name = task_name or fn.__name__
    trace_id = get_request_id()
    start = time.perf_counter()

    logger.info(
        "cpu_task_start",
        extra={"task": name, "trace_id": trace_id},
    )
    try:
        import asyncio

        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(get_executor(), fn, *args)
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.error(
            "cpu_task_failed",
            extra={
                "task": name,
                "trace_id": trace_id,
                "duration_ms": duration_ms,
                "error": str(exc),
            },
        )
        raise RuntimeError(f"CPU-bound task '{name}' failed") from exc

    duration_ms = int((time.perf_counter() - start) * 1000)
    logger.info(
        "cpu_task_complete",
        extra={"task": name, "trace_id": trace_id, "duration_ms": duration_ms},
    )
    return result



