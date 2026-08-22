from fastapi import APIRouter, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta, timezone
import io

from app.api.deps import DbDep, TargetPatientIdForRead
from app.models.enums import UserRole
from app.models.prediction import Prediction
from app.models.lifestyle import SleepLog, LifestyleLog, TriggerLog
from app.models.medication import MedicationLog
from app.models.seizure import ManualSeizureLog
from app.schemas.base import StrictModel
from app.models.eeg_session import EegSession
from app.models.recommendation import Recommendation
from app.schemas.recommendation import RecommendationOut

router = APIRouter(prefix="/dashboard", tags=["🤒 Patient - Dashboard"])


class DashboardStatsOut(StrictModel):
    # Summary Metrics
    total_seizures_past_30_days: int
    total_seizures_all_time: int
    manual_seizures_all_time: int
    detected_seizures_all_time: int
    days_since_last_seizure: int | None
    
    # Seizure Details
    most_common_seizure_types: list[str]
    recent_auras: list[str]
    
    # Medication Adherence
    medication_adherence_percent: float
    medications_taken: int
    medications_missed: int
    medication_streak: int
    
    # Lifestyle Analytics
    avg_sleep_hours: float
    avg_stress_level: float | None
    most_frequent_triggers: list[str]
    
    recommendations: list[RecommendationOut]


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
    avg_sleep_mins = sleep_query.scalar()
    if avg_sleep_mins is None:
        avg_sleep_mins = 0
    avg_sleep_hours = round(float(avg_sleep_mins) / 60.0, 1)

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

    # Calculate streak (consecutive days taken without a MISSED log)
    logs_query = await db.execute(
        select(func.date(MedicationLog.taken_at).label("d"), MedicationLog.status)
        .where(MedicationLog.user_id == target_user_id)
        .where(MedicationLog.status.in_(["TAKEN", "MISSED"]))
        .order_by(desc("d"))
    )
    logs = logs_query.all()
    
    streak = 0
    current_date = datetime.now(timezone.utc).date()
    
    # Group by date to see if any MISSED occurred on that date
    daily_status = {}
    for d, status in logs:
        if d not in daily_status:
            daily_status[d] = []
        daily_status[d].append(status)
        
    for i in range(365): # Check up to a year back
        check_date = current_date - timedelta(days=i)
        statuses = daily_status.get(check_date)
        if statuses:
            if "MISSED" in statuses:
                break
            if "TAKEN" in statuses:
                streak += 1
        elif i > 0: # If there's a day with no logs at all, break streak
            break

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

    # 6. Fetch active recommendations from the database
    rec_stmt = select(Recommendation).where(
        Recommendation.user_id == target_user_id,
        Recommendation.is_active == True
    ).order_by(Recommendation.created_at.desc())
    recommendations = (await db.execute(rec_stmt)).scalars().all()

    return DashboardStatsOut(
        total_seizures_past_30_days=total_seizures_past_30_days,
        total_seizures_all_time=total_seizures_all_time,
        manual_seizures_all_time=manual_seizures_all,
        detected_seizures_all_time=eeg_seizures_all,
        days_since_last_seizure=days_since_last_seizure,
        most_common_seizure_types=most_common_seizure_types,
        recent_auras=recent_auras,
        medication_adherence_percent=adherence,
        medications_taken=taken,
        medications_missed=missed,
        medication_streak=streak,
        avg_sleep_hours=avg_sleep_hours,
        avg_stress_level=avg_stress_level,
        most_frequent_triggers=most_frequent_triggers,
        recommendations=recommendations,
    )


@router.get(
    "/export-pdf",
    tags=["🤒 Patient - Dashboard"],
    summary="Export PDF Summary for Neurologist",
    description="Generates a downloadable PDF report summarizing the patient's seizure history, medication adherence, and lifestyle trends.",
)
async def export_dashboard_pdf(db: DbDep, target_user_id: TargetPatientIdForRead):
    from fpdf import FPDF
    
    # Get the stats first
    stats = await get_dashboard_stats(db, target_user_id)
    
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("helvetica", "B", 16)
    pdf.cell(0, 10, "EpiCare Patient Summary Report", new_x="LMARGIN", new_y="NEXT", align="C")
    
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 10, f"Generated on: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Seizures Section
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 10, "1. Seizure Analytics", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 10, f"- Total Seizures (Past 30 Days): {stats.total_seizures_past_30_days}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, f"- Total Seizures (All Time): {stats.total_seizures_all_time}", new_x="LMARGIN", new_y="NEXT")
    days_since = str(stats.days_since_last_seizure) if stats.days_since_last_seizure is not None else "N/A"
    pdf.cell(0, 10, f"- Days Since Last Seizure: {days_since}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, f"- Common Seizure Types: {', '.join(stats.most_common_seizure_types) if stats.most_common_seizure_types else 'None'}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, f"- Recent Auras: {', '.join(stats.recent_auras) if stats.recent_auras else 'None'}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Medication Section
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 10, "2. Medication Adherence", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 10, f"- Overall Adherence (30 Days): {stats.medication_adherence_percent}%", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, f"- Doses Taken: {stats.medications_taken} | Missed: {stats.medications_missed}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, f"- Current Streak: {stats.medication_streak} consecutive days", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Lifestyle Section
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 10, "3. Lifestyle & Triggers", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 12)
    pdf.cell(0, 10, f"- Average Sleep: {stats.avg_sleep_hours} hours/night", new_x="LMARGIN", new_y="NEXT")
    stress = str(stats.avg_stress_level) if stats.avg_stress_level is not None else "N/A"
    pdf.cell(0, 10, f"- Average Stress Level: {stress}/5", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 10, f"- Most Frequent Triggers: {', '.join(stats.most_frequent_triggers) if stats.most_frequent_triggers else 'None'}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)
    
    # Recommendations
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(0, 10, "4. AI Recommendations", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("helvetica", "", 12)
    if stats.recommendations:
        for rec in stats.recommendations:
            # Simple handling of long text
            pdf.set_font("helvetica", "B", 12)
            pdf.multi_cell(0, 8, f"* {rec.title}", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("helvetica", "", 12)
            pdf.multi_cell(0, 8, f"  {rec.body}", new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.cell(0, 10, "No recommendations generated.", new_x="LMARGIN", new_y="NEXT")
    
    # Output PDF to bytes
    pdf_bytes = pdf.output()
    if isinstance(pdf_bytes, str):
        # fpdf2 might return string depending on python version, fallback to bytes
        pdf_bytes = pdf_bytes.encode('latin1')
        
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=EpiCare_Report_{datetime.now().strftime('%Y%m%d')}.pdf"}
    )
