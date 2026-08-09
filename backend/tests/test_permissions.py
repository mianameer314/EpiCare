import pytest
from app.core.permissions import has_permission, ROLE_PERMISSIONS
from app.models.enums import UserRole

def test_has_permission():
    # Admin has all permissions
    assert has_permission(UserRole.ADMIN, "sys:metrics:view")
    assert has_permission(UserRole.ADMIN, "patient:profile:view")
    
    # Patient has their own permissions but not doctor permissions
    assert has_permission(UserRole.PATIENT, "patient:profile:view")
    assert not has_permission(UserRole.PATIENT, "doctor:availability:edit")
    
    # Doctor has their own permissions
    assert has_permission(UserRole.DOCTOR, "doctor:profile:view")
    assert not has_permission(UserRole.DOCTOR, "sys:metrics:view")
