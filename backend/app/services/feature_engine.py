"""
Feature Engine Service
Computes a comprehensive PatientFeatureSnapshot safely.
"""
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medication import Medication, MedicationLog
from app.models.lifestyle import SleepLog, TriggerLog, LifestyleLog
from app.models.seizure import ManualSeizureLog
from app.models.emergency import SosEvent, EmergencyContact
from app.models.patient_feature_snapshot import PatientFeatureSnapshot

# Attempt to import unfinished systems
try:
    from app.models.eeg_session import EegSession
    from app.models.prediction import Prediction
    from app.models.ai_report import AiReport
    AI_MODELS_AVAILABLE = True
except ImportError:
    AI_MODELS_AVAILABLE = False


class FeatureEngine:
    SCHEMA_VERSION = "1.0"
    
    @staticmethod
    async def compute_snapshot(db: AsyncSession, user_id: int, force_recompute: bool = False) -> PatientFeatureSnapshot:
        now = datetime.now(timezone.utc)
        
        # 1. Idempotency Check: if computed within last 1 hour, return cached
        if not force_recompute:
            cache_cutoff = now - timedelta(hours=1)
            stmt = (
                select(PatientFeatureSnapshot)
                .where(PatientFeatureSnapshot.user_id == user_id)
                .where(PatientFeatureSnapshot.calculated_at >= cache_cutoff)
                .order_by(PatientFeatureSnapshot.calculated_at.desc())
                .limit(1)
            )
            cached = (await db.execute(stmt)).scalar_one_or_none()
            if cached:
                return cached

        # Window dates
        d7 = now - timedelta(days=7)
        d30 = now - timedelta(days=30)
        
        features: dict[str, Any] = {}
        missing_data_fields: list[str] = []
        data_source_timestamps: dict[str, str | None] = {}
        
        # Helper to fetch max timestamp safely
        async def get_max_ts(model, time_col) -> str | None:
            try:
                res = (await db.execute(select(func.max(getattr(model, time_col))).where(model.user_id == user_id))).scalar_one_or_none()
                return res.isoformat() if res else None
            except Exception:
                return None

        # Gather max timestamps
        data_source_timestamps["sleep_logs"] = await get_max_ts(SleepLog, "created_at")
        data_source_timestamps["medication_logs"] = await get_max_ts(MedicationLog, "taken_at")
        data_source_timestamps["lifestyle_logs"] = await get_max_ts(LifestyleLog, "created_at")
        data_source_timestamps["trigger_logs"] = await get_max_ts(TriggerLog, "created_at")
        data_source_timestamps["manual_seizure_logs"] = await get_max_ts(ManualSeizureLog, "created_at")
        data_source_timestamps["sos_events"] = await get_max_ts(SosEvent, "created_at")

        # --- SLEEP FEATURES ---
        sleep_7d = (await db.execute(select(SleepLog).where(SleepLog.user_id == user_id, SleepLog.created_at >= d7))).scalars().all()
        sleep_30d = (await db.execute(select(SleepLog).where(SleepLog.user_id == user_id, SleepLog.created_at >= d30))).scalars().all()
        
        last_sleep = (await db.execute(
            select(SleepLog).where(SleepLog.user_id == user_id).order_by(SleepLog.created_at.desc()).limit(1)
        )).scalar_one_or_none()
        features["last_sleep_hours"] = round(last_sleep.duration_minutes / 60.0, 1) if last_sleep else None

        features["sleep_log_count_7d"] = len(sleep_7d)
        if len(sleep_7d) > 0:
            features["avg_sleep_hours_7d"] = round(sum(s.duration_minutes for s in sleep_7d) / 60.0 / len(sleep_7d), 1)
            features["avg_sleep_quality_7d"] = round(sum(s.quality for s in sleep_7d) / len(sleep_7d), 1)
            if len(sleep_7d) >= 2:
                durations = [s.duration_minutes / 60.0 for s in sleep_7d]
                features["sleep_consistency_7d"] = round(statistics.stdev(durations), 2)
            else:
                features["sleep_consistency_7d"] = 0.0
        else:
            features["avg_sleep_hours_7d"] = 0.0
            features["avg_sleep_quality_7d"] = 0.0
            features["sleep_consistency_7d"] = 0.0
            missing_data_fields.extend(["avg_sleep_hours_7d", "avg_sleep_quality_7d", "sleep_consistency_7d"])

        if len(sleep_30d) > 0:
            features["avg_sleep_hours_30d"] = round(sum(s.duration_minutes for s in sleep_30d) / 60.0 / len(sleep_30d), 1)
        else:
            features["avg_sleep_hours_30d"] = 0.0
            missing_data_fields.append("avg_sleep_hours_30d")

        # --- MEDICATION FEATURES ---
        active_meds = (await db.execute(select(func.count(Medication.id)).where(Medication.user_id == user_id, Medication.is_active == True))).scalar_one_or_none() or 0
        features["active_medication_count"] = active_meds

        if active_meds > 0:
            # Naive adherence rate for MVP: taken / (taken + missed) in window. 
            med_logs_7d = (await db.execute(select(MedicationLog).where(MedicationLog.user_id == user_id, MedicationLog.taken_at >= d7))).scalars().all()
            med_logs_30d = (await db.execute(select(MedicationLog).where(MedicationLog.user_id == user_id, MedicationLog.taken_at >= d30))).scalars().all()
            
            def calc_adherence(logs):
                if not logs: return 0.0
                taken = sum(1 for l in logs if l.status == "TAKEN")
                return (taken / len(logs)) * 100.0

            features["med_adherence_rate_7d"] = calc_adherence(med_logs_7d)
            features["med_adherence_rate_30d"] = calc_adherence(med_logs_30d)
            
            # Consecutive missed
            all_recent_logs = (await db.execute(select(MedicationLog).where(MedicationLog.user_id == user_id).order_by(MedicationLog.taken_at.desc()).limit(10))).scalars().all()
            missed_streak = 0
            for log in all_recent_logs:
                if log.status == "MISSED":
                    missed_streak += 1
                else:
                    break
            features["consecutive_missed_med_logs"] = missed_streak
        else:
            features["med_adherence_rate_7d"] = 100.0
            features["med_adherence_rate_30d"] = 100.0
            features["consecutive_missed_med_logs"] = 0
            missing_data_fields.extend(["med_adherence_rate_7d", "med_adherence_rate_30d"])

        # --- LIFESTYLE & STRESS FEATURES ---
        lifestyle_7d = (await db.execute(select(LifestyleLog).where(LifestyleLog.user_id == user_id, LifestyleLog.created_at >= d7))).scalars().all()
        features["lifestyle_log_count_7d"] = len(lifestyle_7d)
        
        stress_logs = [l for l in lifestyle_7d if l.log_type == "STRESS"]
        if stress_logs and all(l.metadata_dict and "intensity" in l.metadata_dict for l in stress_logs):
            features["avg_stress_level_7d"] = sum(int(l.metadata_dict["intensity"]) for l in stress_logs) / len(stress_logs)
        else:
            features["avg_stress_level_7d"] = 0.0
            missing_data_fields.append("avg_stress_level_7d")

        # --- TRIGGER FEATURES ---
        triggers_7d = (await db.execute(select(TriggerLog).where(TriggerLog.user_id == user_id, TriggerLog.created_at >= d7))).scalars().all()
        features["trigger_log_count_7d"] = len(triggers_7d)
        features["trigger_count_7d"] = len(triggers_7d) # redundant but keeps schema compat
        
        if triggers_7d:
            trigger_names = [t.trigger_name for t in triggers_7d]
            most_common = max(set(trigger_names), key=trigger_names.count)
            features["most_common_trigger_7d"] = most_common
            features["most_common_trigger_count_7d"] = trigger_names.count(most_common)
        else:
            features["most_common_trigger_7d"] = None
            features["most_common_trigger_count_7d"] = 0
            missing_data_fields.append("most_common_trigger_7d")

        # --- SEIZURE FEATURES ---
        sz_7d = (await db.execute(select(func.count(ManualSeizureLog.id)).where(ManualSeizureLog.user_id == user_id, ManualSeizureLog.occurred_at >= d7))).scalar_one_or_none() or 0
        sz_30d = (await db.execute(select(func.count(ManualSeizureLog.id)).where(ManualSeizureLog.user_id == user_id, ManualSeizureLog.occurred_at >= d30))).scalar_one_or_none() or 0
        
        features["manual_seizure_count_7d"] = sz_7d
        features["manual_seizure_count_30d"] = sz_30d
        
        last_sz = (await db.execute(select(ManualSeizureLog.occurred_at).where(ManualSeizureLog.user_id == user_id).order_by(ManualSeizureLog.occurred_at.desc()).limit(1))).scalar_one_or_none()
        if last_sz:
            features["days_since_last_manual_seizure"] = (now - last_sz).days
        else:
            features["days_since_last_manual_seizure"] = 9999
            missing_data_fields.append("days_since_last_manual_seizure")

        # --- EMERGENCY FEATURES ---
        sos_30d = (await db.execute(select(func.count(SosEvent.id)).where(SosEvent.user_id == user_id, SosEvent.created_at >= d30))).scalar_one_or_none() or 0
        features["sos_event_count_30d"] = sos_30d
        
        has_contacts = (await db.execute(select(func.count(EmergencyContact.id)).where(EmergencyContact.user_id == user_id))).scalar_one_or_none() or 0
        features["has_emergency_contacts"] = has_contacts > 0

        # --- AI / EEG / RAG FEATURES (Graceful Degradation) ---
        features["eeg_upload_count_30d"] = 0
        features["ai_reports_generated_30d"] = 0
        features["eeg_seizure_detections_30d"] = 0
        
        if AI_MODELS_AVAILABLE:
            try:
                eeg_uploads = (await db.execute(select(func.count(EegSession.id)).where(EegSession.user_id == user_id, EegSession.created_at >= d30))).scalar_one_or_none() or 0
                features["eeg_upload_count_30d"] = eeg_uploads
                
                reports = (await db.execute(
                    select(func.count(AiReport.id))
                    .join(Prediction, AiReport.prediction_id == Prediction.id)
                    .where(Prediction.user_id == user_id, AiReport.created_at >= d30)
                )).scalar_one_or_none() or 0
                features["ai_reports_generated_30d"] = reports
                
                detections = (await db.execute(
                    select(func.count(Prediction.id))
                    .where(Prediction.user_id == user_id, Prediction.predicted_class == 'seizure', Prediction.created_at >= d30)
                )).scalar_one_or_none() or 0
                features["eeg_seizure_detections_30d"] = detections
            except Exception:
                # Silently fallback to 0 if tables are missing/schema changed
                pass

        # Calculate completeness score
        total_possible = 22
        score = (total_possible - len(set(missing_data_fields))) / total_possible
        
        time_windows = {
            "7d": d7.isoformat(),
            "30d": d30.isoformat()
        }

        # Create and persist snapshot
        snapshot = PatientFeatureSnapshot(
            user_id=user_id,
            calculated_at=now,
            feature_schema_version=FeatureEngine.SCHEMA_VERSION,
            time_windows_used=time_windows,
            missing_data_fields=list(set(missing_data_fields)),
            data_source_timestamps=data_source_timestamps,
            features=features,
            data_completeness_score=score
        )
        
        db.add(snapshot)
        await db.commit()
        await db.refresh(snapshot)
        
        return snapshot
