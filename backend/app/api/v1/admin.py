"""
Admin routes — System metrics, user management, and doctor verification.
"""
from typing import List
from fastapi import APIRouter, Depends, Query, status, Header, HTTPException

from app.api.deps import DbDep, CurrentUser, RoleChecker
from app.models.enums import UserRole
from app.schemas.user import UserOut
from app.schemas.profiles import DoctorProfileOut
from app.schemas.admin import AdminDashboardMetricsOut, UserStatusUpdate, DoctorVerificationUpdate
from app.services import admin as admin_service
from app.core.config import settings

# Enforce Admin Role for all routes in this router
RequireAdmin = Depends(RoleChecker([UserRole.ADMIN]))

router = APIRouter(
    prefix="/admin", 
    tags=["Admin"],
    dependencies=[RequireAdmin]
)

@router.get(
    "/dashboard/metrics",
    response_model=AdminDashboardMetricsOut,
    summary="Get platform metrics",
    description="Retrieve comprehensive platform metrics including user counts, and engagement stats.",
)
async def get_metrics(db: DbDep):
    """Live system metrics."""
    return await admin_service.get_platform_metrics(db)


@router.get(
    "/users",
    response_model=List[UserOut],
    summary="List all users",
    description="Retrieve all users with optional pagination and role filtering.",
)
async def list_users(
    db: DbDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    role: UserRole | None = None,
):
    """List users for admin management."""
    return await admin_service.get_all_users(db, skip=skip, limit=limit, role=role)


@router.get(
    "/users/{user_id}",
    response_model=UserOut,
    summary="Get user details",
    description="Fetch a specific user's base information by their ID.",
)
async def get_user(user_id: int, db: DbDep):
    """Get single user."""
    return await admin_service.get_user_details(db, user_id)


@router.patch(
    "/users/{user_id}/status",
    response_model=UserOut,
    summary="Activate or Deactivate User",
    description="Suspend or restore a user account.",
)
async def update_user_status(user_id: int, data: UserStatusUpdate, db: DbDep):
    """Suspend or activate user."""
    return await admin_service.update_user_status(db, user_id, data)


@router.get(
    "/doctors/pending",
    response_model=List[DoctorProfileOut],
    summary="List pending doctors",
    description="Fetch all doctors whose PMDC numbers are awaiting verification.",
)
async def get_pending_doctors(db: DbDep):
    """List unverified doctors."""
    return await admin_service.get_pending_doctors(db)


@router.patch(
    "/doctors/{user_id}/verify",
    response_model=DoctorProfileOut,
    summary="Verify Doctor PMDC",
    description="Approve or reject a doctor's PMDC verification request.",
)
async def verify_doctor(user_id: int, data: DoctorVerificationUpdate, db: DbDep):
    """Verify doctor."""
    return await admin_service.verify_doctor(db, user_id, data)


# --- Diagnostics Router (Protected by X-Admin-Key instead of JWT) ---
def verify_admin_key(x_admin_key: str | None = Header(default=None)):
    if not x_admin_key or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin key")

diagnostics_router = APIRouter(
    prefix="/admin/health", 
    tags=["Admin Diagnostics"],
    dependencies=[Depends(verify_admin_key)]
)

@diagnostics_router.get(
    "/diagnostics",
    summary="System Diagnostics",
    description="Fetch live DB, OS, and ML runtime diagnostics.",
)
async def get_diagnostics(db: DbDep):
    from app.services.diagnostics import build_diagnostics
    return await build_diagnostics(db)

