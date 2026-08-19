"""
System routes — health checks and model registry status.
"""
from datetime import datetime, timezone
from sqlalchemy import text
from fastapi import APIRouter, Depends

from app.api.deps import DbDep
from app.rate_limit.core import get_rate_limiter
from app.core.config import settings
from app.ml.model_loader import get_model_loader
from app.schemas.system import HealthOut, ModelStatusOut

router = APIRouter(prefix="/system", tags=["System Health & Status"])


@router.get(
    "/health",
    response_model=HealthOut,
    summary="General system health check",
    description="Detailed health check probe returning DB status, Redis status, and application version. Used by load balancers and deployment probes to check system liveness.",
    responses={
        200: {"description": "Successful Response - System is healthy or degraded"},
    },
)
async def health(db: DbDep):
    """Detailed health check probe."""
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    try:
        limiter = get_rate_limiter()
        redis_status = "connected" if limiter.using_redis else "unavailable (in-memory)"
    except Exception:
        redis_status = "unknown"

    # In production, environment might come from settings, defaulting to development
    env = getattr(settings, "ENVIRONMENT", "development")

    return HealthOut(
        status="healthy" if db_status == "connected" else "degraded",
        version="1.0.0",
        environment=env,
        database_status=db_status,
        redis_status=redis_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.get(
    "/model",
    response_model=ModelStatusOut,
    summary="AI Model readiness check",
    description="Report which AI model version is active and whether it is loaded into memory.",
    responses={
        200: {"description": "Successful Response - Returns model status"},
    },
)
async def model_status():
    """Report which model version is active and whether it is loaded."""
    loader = get_model_loader()
    return ModelStatusOut(
        model=(
            loader.config.name
            if loader.config is not None
            else "EpiCarePhase12SpectrogramCNN"
        ),
        version=loader.version,
        status=loader.registry.status.value,
    )
