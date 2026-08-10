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
    tags=["🛡️ Admin - Platform Management"],
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


from app.api.pagination import PaginationParams, get_pagination_params, get_total_count, apply_pagination, create_paginated_response
from app.schemas.common import PaginatedResponse
from sqlalchemy import select
from app.models.user import User
from app.models.doctor_profile import DoctorProfile

@router.get(
    "/users",
    response_model=PaginatedResponse[UserOut],
    summary="List all users",
    description="Retrieve all users with optional pagination and role filtering.",
)
async def list_users(
    db: DbDep,
    params: PaginationParams = Depends(get_pagination_params),
    role: UserRole | None = None,
):
    """List users for admin management."""
    query = select(User)
    if role:
        query = query.where(User.role == role)
        
    if params.sort_by and hasattr(User, params.sort_by):
        column = getattr(User, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(User.id.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


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
    response_model=PaginatedResponse[DoctorProfileOut],
    summary="List pending doctors",
    description="Fetch all doctors whose PMDC numbers are awaiting verification.",
)
async def get_pending_doctors(
    db: DbDep,
    params: PaginationParams = Depends(get_pagination_params)
):
    """List unverified doctors."""
    query = select(DoctorProfile).where(DoctorProfile.is_pmdc_verified == False)
    
    if params.sort_by and hasattr(DoctorProfile, params.sort_by):
        column = getattr(DoctorProfile, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


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
    tags=["🛡️ Admin - Diagnostics"],
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

