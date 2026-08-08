"""
Admin diagnostics — hidden, authenticated endpoint reporting live system health.

Protected by X-Admin-Key (settings.ADMIN_API_KEY). Reports:
    - database connection pool stats
    - ONNX inference runtime CPU/memory utilization
    - APScheduler job queue status
"""
import logging
import os
from typing import Any

import psutil

from app.api.deps import DbDep
from app.core.config import settings
from app.db.session import engine
from app.ml.model_loader import get_model_loader
from app.scheduler.core import get_scheduler
from app.schemas.base import StrictModel

logger = logging.getLogger(__name__)


class PoolStats(StrictModel):
    """Database pool statistics."""

    size: int
    checkedout_connections: int
    overflow: int
    checkedin_connections: int
    percent_used: float


class OnnxRuntimeStats(StrictModel):
    """ONNX runtime CPU/memory statistics."""

    loaded: bool
    model_version: str | None
    intra_op_threads: int
    inter_op_threads: int
    process_cpu_percent: float
    process_memory_mb: float


class SchedulerStats(StrictModel):
    """APScheduler job queue status."""

    running: bool
    job_count: int
    jobs: list[dict[str, Any]]
    jobstore: str


class SystemStats(StrictModel):
    """Host-level statistics."""

    cpu_percent: float
    memory_percent: float
    load_avg: list[float]


class DiagnosticsOut(StrictModel):
    """Full diagnostics response."""

    app: str
    environment: str
    database: PoolStats
    onnx_runtime: OnnxRuntimeStats
    scheduler: SchedulerStats
    system: SystemStats


def _pool_stats() -> PoolStats:
    """Read live stats from the async engine pool."""
    pool = engine.pool
    checkedout = pool.checkedout()
    overflow = getattr(pool, "overflow", -1)
    size = pool.size()
    total = size + max(overflow, 0)
    percent = (checkedout / total * 100.0) if total else 0.0
    return PoolStats(
        size=size,
        checkedout_connections=checkedout,
        overflow=overflow,
        checkedin_connections=pool.checkedin(),
        percent_used=round(percent, 2),
    )


def _onnx_stats() -> OnnxRuntimeStats:
    """Report ONNX runtime + process resource usage."""
    loader = get_model_loader()
    process = psutil.Process(os.getpid())
    mem_mb = process.memory_info().rss / (1024 * 1024)
    return OnnxRuntimeStats(
        loaded=loader.is_ready,
        model_version=loader.version,
        intra_op_threads=settings.ONNX_INTRA_OP_THREADS,
        inter_op_threads=settings.ONNX_INTER_OP_THREADS,
        process_cpu_percent=process.cpu_percent(interval=None),
        process_memory_mb=round(mem_mb, 2),
    )


async def _scheduler_stats() -> SchedulerStats:
    """Refresh and return scheduler state."""
    state = await get_scheduler().refresh_state()
    return SchedulerStats(
        running=state.running,
        job_count=state.job_count,
        jobs=state.jobs,
        jobstore=state.jobstore,
    )


def _system_stats() -> SystemStats:
    """Host CPU/memory/load snapshot."""
    load = list(os.getloadavg()) if hasattr(os, "getloadavg") else []
    return SystemStats(
        cpu_percent=psutil.cpu_percent(interval=None),
        memory_percent=psutil.virtual_memory().percent,
        load_avg=[round(v, 2) for v in load],
    )


async def build_diagnostics(db: DbDep) -> DiagnosticsOut:
    """
    Assemble the full diagnostics payload. Performs a live DB round-trip
    so connection stats are truthful.
    """
    from sqlalchemy import text

    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))

    return DiagnosticsOut(
        app=settings.APP_NAME,
        environment=settings.APP_ENV,
        database=_pool_stats(),
        onnx_runtime=_onnx_stats(),
        scheduler=await _scheduler_stats(),
        system=_system_stats(),
    )
