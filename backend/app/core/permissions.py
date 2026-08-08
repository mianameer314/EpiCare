"""
Role-Based Access Control (RBAC) — roles, permission matrix, and dependency guards.
Mirrors BRANDING-SYSTEM app/core/permissions.py.
"""
from enum import Enum

from fastapi import Depends, HTTPException, status


class UserRole(str, Enum):
    """System roles. Patients are 'user'; 'admin' reserved for future staff/ops."""

    user = "user"
    admin = "admin"


ROLE_PERMISSIONS: dict[str, set[str]] = {
    "user": {
        "read_own",
        "update_own",
        "upload_eeg",
        "read_predictions",
        "read_reports",
        "chat",
        "manage_medications",
        "manage_lifestyle",
        "read_recommendations",
        "manage_emergency",
        "trigger_sos",
    },
    "admin": {
        "read_own",
        "update_own",
        "upload_eeg",
        "read_predictions",
        "read_reports",
        "chat",
        "manage_medications",
        "manage_lifestyle",
        "read_recommendations",
        "manage_emergency",
        "trigger_sos",
        "manage_users",
        "read_audit_logs",
        "manage_rag",
    },
}

PERMISSION_DESCRIPTIONS: dict[str, str] = {
    "read_own": "Read own profile",
    "update_own": "Update own profile",
    "upload_eeg": "Upload EEG recordings",
    "read_predictions": "Read own predictions/history",
    "read_reports": "Read AI reports",
    "chat": "Use the RAG chatbot",
    "manage_medications": "Manage medications, schedules, logs",
    "manage_lifestyle": "Log sleep, triggers, and stress",
    "read_recommendations": "Read recommendations",
    "manage_emergency": "Manage emergency contacts",
    "trigger_sos": "Trigger SOS alerts",
    "manage_users": "Manage users (admin)",
    "read_audit_logs": "Read audit logs (admin)",
    "manage_rag": "Manage RAG ingestion (admin)",
}


def require_permission(permission: str):
    """
    FastAPI dependency factory that checks the current user's permissions.

    Usage:
        AdminDep = Annotated[User, Depends(require_permission("manage_users"))]
    """
    from app.api.deps import get_current_user  # local import avoids circular deps
    from app.models.user import User

    def checker(user: User = Depends(get_current_user)) -> User:
        permissions = ROLE_PERMISSIONS.get(user.role, set())
        if permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required",
            )
        return user

    return checker


def has_permission(user_role: str, permission: str) -> bool:
    """Non-dependency helper: does a role include a permission?"""
    return permission in ROLE_PERMISSIONS.get(user_role, set())
