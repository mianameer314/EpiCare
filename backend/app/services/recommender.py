"""
Recommender Service — generates personalized, non-medical advice based on recent patient logs.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.lifestyle import SleepLog, TriggerLog
from app.models.medication import MedicationLog
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# The AI team is expected to put their KNN/RF models here
RECOMMENDER_MODEL_DIR = Path("E:/BS_INTERN/EpiCare/training/recommender")


async def get_daily_recommendations(user_id: int, db: AsyncSession) -> list[str]:
    """
    Analyzes the patient's data over the past 7 days to generate actionable recommendations.
    Dynamically checks if the AI team has pushed ML models; if not, falls back to SQL rules.
    """
    recommendations = []
    
    # 1. Dynamic Check: Do we have ML models from the AI team?
    is_ml_ready = RECOMMENDER_MODEL_DIR.exists() and any(
        f.name != ".gitkeep" for f in RECOMMENDER_MODEL_DIR.iterdir()
    )
    
    if is_ml_ready:
        logger.info(f"ML Recommender model found in {RECOMMENDER_MODEL_DIR}. Using ML inference...")
        # --- AI TEAM: PASTE YOUR KNN/RF INFERENCE CODE HERE ---
        # recommendations = my_knn_model.predict(user_data)
        recommendations.append("[ML Output] AI Recommender is running...")
        return recommendations
    
    logger.info("ML Recommender models not found. Falling back to SQL rule-based recommender.")
    
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # 1. Sleep Analysis
    sleep_query = await db.execute(
        select(func.avg(SleepLog.duration_minutes))
        .where(SleepLog.user_id == user_id)
        .where(SleepLog.woke_at >= seven_days_ago)
    )
    avg_sleep_mins = sleep_query.scalar()
    
    if avg_sleep_mins is not None:
        avg_sleep_hours = avg_sleep_mins / 60.0
        if avg_sleep_hours < 7.0:
            recommendations.append(
                f"Your average sleep this week is only {avg_sleep_hours:.1f} hours. "
                "Aim for at least 7-8 hours to reduce the risk of sleep-deprivation induced seizures."
            )
        elif avg_sleep_hours > 10.0:
            recommendations.append(
                "You are sleeping significantly more than average. Ensure you maintain a consistent wake cycle."
            )

    # 2. Medication Adherence Analysis
    med_query = await db.execute(
        select(
            func.count(MedicationLog.id).filter(MedicationLog.status == "TAKEN"),
            func.count(MedicationLog.id)
        )
        .where(MedicationLog.user_id == user_id)
        .where(MedicationLog.taken_at >= seven_days_ago)
    )
    taken, total = med_query.first() or (0, 0)
    
    if total > 0:
        adherence = (taken / total) * 100.0
        if adherence < 80.0:
            recommendations.append(
                f"Your medication adherence this week has dropped to {adherence:.0f}%. "
                "Strict adherence is critical for preventing breakthrough seizures. Please use the daily reminders."
            )
        elif adherence == 100.0:
            recommendations.append(
                "Perfect medication adherence this week! Keep up the excellent routine."
            )

    # 3. Trigger Analysis
    trigger_query = await db.execute(
        select(TriggerLog.trigger_name, func.count(TriggerLog.id))
        .where(TriggerLog.user_id == user_id)
        .where(TriggerLog.occurred_at >= seven_days_ago)
        .group_by(TriggerLog.trigger_name)
        .order_by(func.count(TriggerLog.id).desc())
    )
    triggers = trigger_query.all()
    
    for trigger_type, count in triggers:
        if count >= 2:
            recommendations.append(
                f"You have logged '{trigger_type}' as a trigger {count} times this week. "
                "Consider proactively managing or avoiding this environmental factor."
            )

    # Cold start fallback
    if not recommendations:
        recommendations.append(
            "Log your daily sleep, triggers, and medication doses consistently to receive personalized insights here."
        )

    return recommendations
