"""
System routes — health checks and model registry status.
"""
from fastapi import APIRouter

from app.core.config import settings
from app.ml.model_registry import get_model_registry
from app.schemas.system import HealthOut, ModelStatusOut

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/health", response_model=HealthOut)
async def health():
    """Simple liveness probe."""
    return HealthOut(status="healthy")


@router.get("/model", response_model=ModelStatusOut)
async def model_status():
    """Report which model version is active and whether it is loaded."""
    registry = get_model_registry()
    return ModelStatusOut(
        model=settings.MODEL_NAME,
        version=registry.active_version,
        status=registry.status.value,
    )
