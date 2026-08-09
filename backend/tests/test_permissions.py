import pytest
from app.core.permissions import has_permission, ROLE_PERMISSIONS
from app.models.enums import UserRole

def test_has_permission():
    # Admin has all permissions
    assert has_permission(UserRole.ADMIN, "manage_users")
    assert has_permission(UserRole.ADMIN, "upload_eeg")
    
    # Patient has their own permissions but not doctor permissions
    assert has_permission(UserRole.PATIENT, "upload_eeg")
    assert not has_permission(UserRole.PATIENT, "prescribe_medications")
    
    # Doctor has their own permissions
    assert has_permission(UserRole.DOCTOR, "read_patient_eeg")
    assert not has_permission(UserRole.DOCTOR, "manage_users")
