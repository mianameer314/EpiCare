"""
Role-Based Access Control (RBAC) — roles, permission matrix, and dependency guards.
Mirrors BRANDING-SYSTEM app/core/permissions.py.
"""
from enum import Enum

from fastapi import Depends, HTTPException, status


from app.models.enums import UserRole


PERMISSION_DESCRIPTIONS: dict[str, str] = {
    # Common
    "read_own": "Read own profile",
    "update_own": "Update own profile",
    "manage_connections": "Manage incoming and outgoing connection requests",
    
    # Patient-specific
    "upload_eeg": "Upload EEG recordings",
    "read_predictions": "Read own predictions/history",
    "read_reports": "Read AI reports",
    "chat": "Use the RAG chatbot",
    "manage_medications": "Manage medications, schedules, logs",
    "manage_lifestyle": "Log sleep, triggers, and stress",
    "read_recommendations": "Read recommendations",
    "manage_emergency": "Manage emergency contacts",
    "trigger_sos": "Trigger SOS alerts",
    
    # Doctor-specific
    "read_patient_profiles": "View linked patient medical profiles",
    "read_patient_eeg": "View linked patient EEG signals and analysis",
    "write_patient_reports": "Write clinical reports for linked patients",
    "prescribe_medications": "Manage prescriptions for linked patients",
    "chat_clinical": "Use the specialized clinical AI assistant",

    # Caretaker-specific
    "read_patient_status": "View high-level status of linked patients",
    "receive_sos": "Receive and manage SOS alerts for linked patients",
    "read_patient_medications": "View medication adherence for linked patients",

    # Admin-specific
    "manage_users": "Manage all system users (admin)",
    "verify_doctors": "Verify PMDC licenses for doctors (admin)",
    "read_audit_logs": "Read system audit logs (admin)",
    "manage_rag": "Manage AI RAG document ingestion (admin)",
}

ROLE_PERMISSIONS: dict[UserRole, set[str]] = {
    UserRole.PATIENT: {
        "read_own", "update_own", "manage_connections",
        "upload_eeg", "read_predictions", "read_reports", "chat",
        "manage_medications", "manage_lifestyle", "read_recommendations",
        "manage_emergency", "trigger_sos"
    },
    UserRole.DOCTOR: {
        "read_own", "update_own", "manage_connections",
        "read_patient_profiles", "read_patient_eeg", 
        "write_patient_reports", "prescribe_medications", "chat_clinical"
    },
    UserRole.CARETAKER: {
        "read_own", "update_own", "manage_connections",
        "read_patient_status", "receive_sos", "read_patient_medications"
    },
    UserRole.ADMIN: set(PERMISSION_DESCRIPTIONS.keys())
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
