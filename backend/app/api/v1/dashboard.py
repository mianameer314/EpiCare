from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta, timezone

from app.api.deps import DbDep, TargetPatientIdForRead
from app.models.enums import UserRole
from app.models.prediction import Prediction
from app.models.lifestyle import SleepLog, LifestyleLog, TriggerLog
from app.models.medication import MedicationLog
from app.models.seizure import ManualSeizureLog
from app.schemas.base import StrictModel
from app.services.recommender import get_daily_recommendations
from app.models.eeg_session import EegSession

router = APIRouter(prefix="/dashboard", tags=["🤒 Patient - Dashboard"])


class DashboardStatsOut(StrictModel):
    # Summary Metrics
    total_seizures_past_30_days: int
    total_seizures_all_time: int
    days_since_last_seizure: int | None
    
    # Seizure Details
    most_common_seizure_types: list[str]
    recent_auras: list[str]
    
    # Medication Adherence
    medication_adherence_percent: float
    medications_taken: int
    medications_missed: int
    
    # Lifestyle Analytics
    avg_sleep_hours: float
    avg_stress_level: float | None
    most_frequent_triggers: list[str]
    
    recommendations: list[str]


@router.get(
    "",
    response_model=DashboardStatsOut,
    summary="Get Patient Dashboard Analytics",
    description=(
        "Retrieves the aggregated health analytics for the authenticated patient "
        "over the **past 30 days**. This includes robust calculations across manual logs, "
        "EEGs, medications, sleep, stress, and triggers."
    ),
    response_description="A JSON object containing the robust dashboard statistics and recommendations."
)
async def get_dashboard_stats(db: DbDep, target_user_id: TargetPatientIdForRead):
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    # 1. Seizures Analytics (EEG + Manual)
    eeg_seizures_30d_query = await db.execute(
        select(func.count(Prediction.id))
        .join(EegSession, Prediction.session_id == EegSession.id)
        .where(Prediction.predicted_class == "seizure")
        .where(EegSession.user_id == target_user_id)
        .where(EegSession.created_at >= thirty_days_ago)
    )
    eeg_seizures_30d = eeg_seizures_30d_query.scalar() or 0
    
    manual_seizures_30d_query = await db.execute(
        select(func.count(ManualSeizureLog.id))
        .where(ManualSeizureLog.user_id == target_user_id)
        .where(ManualSeizureLog.occurred_at >= thirty_days_ago)
    )
    manual_seizures_30d = manual_seizures_30d_query.scalar() or 0
    total_seizures_past_30_days = eeg_seizures_30d + manual_seizures_30d

    # All-time Seizures
    eeg_seizures_all_query = await db.execute(
        select(func.count(Prediction.id))
        .join(EegSession, Prediction.session_id == EegSession.id)
        .where(Prediction.predicted_class == "seizure")
        .where(EegSession.user_id == target_user_id)
    )
    eeg_seizures_all = eeg_seizures_all_query.scalar() or 0
    
    manual_seizures_all_query = await db.execute(
        select(func.count(ManualSeizureLog.id))
        .where(ManualSeizureLog.user_id == target_user_id)
    )
    manual_seizures_all = manual_seizures_all_query.scalar() or 0
    total_seizures_all_time = eeg_seizures_all + manual_seizures_all

    # Days since last seizure
    latest_manual = await db.execute(
        select(ManualSeizureLog.occurred_at)
        .where(ManualSeizureLog.user_id == target_user_id)
        .order_by(desc(ManualSeizureLog.occurred_at))
        .limit(1)
    )
    latest_manual_date = latest_manual.scalar()

    latest_eeg = await db.execute(
        select(EegSession.created_at)
        .join(Prediction, Prediction.session_id == EegSession.id)
        .where(Prediction.predicted_class == "seizure")
        .where(EegSession.user_id == target_user_id)
        .order_by(desc(EegSession.created_at))
        .limit(1)
    )
    latest_eeg_date = latest_eeg.scalar()

    dates = [d for d in (latest_manual_date, latest_eeg_date) if d is not None]
    days_since_last_seizure = None
    if dates:
        most_recent = max(dates)
        days_since_last_seizure = (datetime.now(timezone.utc) - most_recent).days

    # Most common seizure types (Manual)
    types_query = await db.execute(
        select(ManualSeizureLog.seizure_type, func.count(ManualSeizureLog.id).label("cnt"))
        .where(ManualSeizureLog.user_id == target_user_id)
        .where(ManualSeizureLog.occurred_at >= thirty_days_ago)
        .where(ManualSeizureLog.seizure_type != None)
        .group_by(ManualSeizureLog.seizure_type)
        .order_by(desc("cnt"))
        .limit(3)
    )
    most_common_seizure_types = [row[0] for row in types_query.all()]

    # Recent auras (Manual)
    auras_query = await db.execute(
        select(ManualSeizureLog.auras_felt, func.count(ManualSeizureLog.id).label("cnt"))
        .where(ManualSeizureLog.user_id == target_user_id)
        .where(ManualSeizureLog.occurred_at >= thirty_days_ago)
        .where(ManualSeizureLog.auras_felt != None)
        .group_by(ManualSeizureLog.auras_felt)
        .order_by(desc("cnt"))
        .limit(3)
    )
    recent_auras = [row[0] for row in auras_query.all()]

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
            func.count(MedicationLog.id).filter(MedicationLog.status == "MISSED"),
            func.count(MedicationLog.id)
        )
        .where(MedicationLog.user_id == target_user_id)
        .where(MedicationLog.taken_at >= thirty_days_ago)
    )
    taken, missed, total = med_query.first() or (0, 0, 0)
    adherence = round((taken / total * 100), 1) if total > 0 else 0.0

    # 4. Stress level (from generic LifestyleLog)
    stress_query = await db.execute(
        select(LifestyleLog.metadata_dict)
        .where(LifestyleLog.user_id == target_user_id)
        .where(LifestyleLog.log_type == "STRESS")
        .where(LifestyleLog.occurred_at >= thirty_days_ago)
    )
    stress_logs = stress_query.scalars().all()
    stress_levels = [log.get("severity", 0) for log in stress_logs if isinstance(log, dict) and "severity" in log]
    avg_stress_level = round(sum(stress_levels) / len(stress_levels), 1) if stress_levels else None

    # 5. Most frequent triggers
    triggers_query = await db.execute(
        select(TriggerLog.trigger_name, func.count(TriggerLog.id).label("cnt"))
        .where(TriggerLog.user_id == target_user_id)
        .where(TriggerLog.occurred_at >= thirty_days_ago)
        .group_by(TriggerLog.trigger_name)
        .order_by(desc("cnt"))
        .limit(3)
    )
    most_frequent_triggers = [row[0] for row in triggers_query.all()]

    # 6. Generate daily recommendations
    recommendations = await get_daily_recommendations(target_user_id, db)

    return DashboardStatsOut(
        total_seizures_past_30_days=total_seizures_past_30_days,
        total_seizures_all_time=total_seizures_all_time,
        days_since_last_seizure=days_since_last_seizure,
        most_common_seizure_types=most_common_seizure_types,
        recent_auras=recent_auras,
        medication_adherence_percent=adherence,
        medications_taken=taken,
        medications_missed=missed,
        avg_sleep_hours=avg_sleep_hours,
        avg_stress_level=avg_stress_level,
        most_frequent_triggers=most_frequent_triggers,
        recommendations=recommendations,
    )
