from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone

from app.api.deps import DbDep, TargetPatientIdForRead
from app.models.enums import UserRole
from app.models.prediction import Prediction
from app.models.lifestyle import SleepLog
from app.models.medication import MedicationLog
from app.schemas.base import StrictModel
from app.services.recommender import get_daily_recommendations

router = APIRouter(prefix="/dashboard", tags=["🤒 Patient - Dashboard"])


class DashboardStatsOut(StrictModel):
    seizures_past_30_days: int
    avg_sleep_hours: float
    medication_adherence_percent: float
    recommendations: list[str]


@router.get(
    "",
    response_model=DashboardStatsOut,
    summary="Get Patient Dashboard Analytics",
    description=(
        "Retrieves the aggregated health analytics for the authenticated patient "
        "over the **past 30 days**. This includes total seizures detected, average "
        "daily sleep hours, and medication adherence percentages. It also calculates "
        "and returns real-time, personalized recommendations based on the patient's "
        "recent lifestyle logs."
    ),
    response_description="A JSON object containing the dashboard statistics and recommendations."
)
async def get_dashboard_stats(db: DbDep, target_user_id: TargetPatientIdForRead):
    """
    Get aggregated dashboard stats for the past 30 days.
    - Total seizures detected
    - Average sleep hours per night
    - Rough medication adherence %
    """
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    # 1. Seizures detected
    from app.models.eeg_session import EegSession
    seizure_count_query = await db.execute(
        select(func.count(Prediction.id))
        .join(EegSession, Prediction.session_id == EegSession.id)
        .where(Prediction.predicted_class == "seizure")
        .where(EegSession.user_id == target_user_id)
        .where(EegSession.created_at >= thirty_days_ago)
    )
    seizures = seizure_count_query.scalar() or 0

    # 2. Average sleep
    sleep_query = await db.execute(
        select(func.avg(SleepLog.duration_minutes))
        .where(SleepLog.user_id == target_user_id)
        .where(SleepLog.woke_at >= thirty_days_ago)
    )
    avg_sleep_mins = sleep_query.scalar() or 0
    avg_sleep_hours = round(avg_sleep_mins / 60.0, 1)

    # 3. Medication adherence (TAKEN vs total logs)
    med_query = await db.execute(
        select(
            func.count(MedicationLog.id).filter(MedicationLog.status == "TAKEN"),
            func.count(MedicationLog.id)
        )
        .where(MedicationLog.user_id == target_user_id)
        .where(MedicationLog.taken_at >= thirty_days_ago)
    )
    taken, total = med_query.first() or (0, 0)
    adherence = round((taken / total * 100), 1) if total > 0 else 0.0

    # 4. Generate daily recommendations
    recommendations = await get_daily_recommendations(target_user_id, db)

    return DashboardStatsOut(
        seizures_past_30_days=seizures,
        avg_sleep_hours=avg_sleep_hours,
        medication_adherence_percent=adherence,
        recommendations=recommendations,
    )
