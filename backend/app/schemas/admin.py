from pydantic import Field
from app.schemas.base import StrictModel

# ------------------------------------------------------------------
# Admin Dashboard Schemas
# ------------------------------------------------------------------

class AdminDashboardMetricsOut(StrictModel):
    """Aggregated system metrics for the admin dashboard."""
    total_users: int
    total_patients: int
    total_doctors: int
    total_caretakers: int
    total_admins: int
    pending_doctors: int
    total_seizures_logged: int
    total_medications_logged: int
    total_lifestyle_logs: int
    total_eegs_processed: int


class DoctorVerificationUpdate(StrictModel):
    """Schema to verify or reject a doctor's PMDC number."""
    is_verified: bool = Field(..., description="Set to true to verify the doctor, false to reject.")


class UserStatusUpdate(StrictModel):
    """Schema to activate or deactivate a user account."""
    is_active: bool = Field(..., description="Set to false to suspend the user account.")
