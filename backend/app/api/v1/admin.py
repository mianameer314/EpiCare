"""
Admin routes — hidden diagnostics endpoint.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import DbDep
from app.core.config import settings
from app.services.diagnostics import DiagnosticsOut, build_diagnostics

router = APIRouter(prefix="/admin", tags=["Admin"])


async def require_admin_key(request: Request) -> None:
    """Reject requests whose X-Admin-Key does not match the configured key."""
    provided = request.headers.get("x-admin-key", "")
    if not provided or provided != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin key",
        )


@router.get(
    "/health/diagnostics",
    response_model=DiagnosticsOut,
    dependencies=[Depends(require_admin_key)],
    summary="Detailed system diagnostics",
    description="Live system diagnostics containing DB pool status, ONNX runtime stats, scheduler jobs, and host resource usage. Requires the X-Admin-Key header.",
    responses={
        401: {"description": "Unauthorized - Missing or invalid X-Admin-Key header"},
    },
)
async def health_diagnostics(db: DbDep):
    """Live system diagnostics: DB pool, ONNX runtime, scheduler, host."""
    return await build_diagnostics(db)
