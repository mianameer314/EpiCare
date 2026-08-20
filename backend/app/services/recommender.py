"""
Deterministic Rule-Based Recommender System
"""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.models.patient_feature_snapshot import PatientFeatureSnapshot
from app.models.recommendation import Recommendation

# RAG Graceful Degradation
try:
    from app.models.rag import RagChunk
    # Assume RAG available if import succeeds
    RAG_AVAILABLE = True
except ImportError:
    RAG_AVAILABLE = False


@dataclass
class RecommendationRule:
    rule_id: str
    rule_version: str
    category: str
    priority: str
    condition: Callable[[dict[str, Any]], bool]
    title: str
    body: str
    rationale: str
    action_url: str | None
    cooldown_hours: int
    search_query: str  # for RAG


# -----------------------------------------------------------------------------
# RULE DEFINITIONS
# -----------------------------------------------------------------------------

RULES: list[RecommendationRule] = [
    # --- SLEEP ---
    RecommendationRule(
        rule_id="SLEEP_LOW_AVG_7D",
        rule_version="1.0",
        category="SLEEP",
        priority="IMPORTANT",
        condition=lambda f: f.get("sleep_log_count_7d", 0) >= 3 and f.get("avg_sleep_hours_7d", 99) < 7.0,
        title="Your sleep average is below recommended levels",
        body="Over the past week, your average sleep was below 7 hours. Most adults benefit from 7–9 hours of regular sleep. Consider reviewing your bedtime routine and logging your sleep consistently.",
        rationale="Triggered because average sleep < 7h over 7 days.",
        action_url="/lifestyle",
        cooldown_hours=48,
        search_query="importance of sleep duration for epilepsy management",
    ),
    RecommendationRule(
        rule_id="SLEEP_INCONSISTENT_7D",
        rule_version="1.0",
        category="SLEEP",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("sleep_log_count_7d", 0) >= 5 and f.get("sleep_consistency_7d", 0) > 2.0,
        title="Your sleep schedule varies quite a bit",
        body="Your sleep times have varied by more than 2 hours this week. A consistent sleep routine may support your wellbeing. Try going to bed and waking up at similar times each day.",
        rationale="Triggered because sleep standard deviation > 2h over 7 days.",
        action_url="/lifestyle",
        cooldown_hours=48,
        search_query="sleep consistency and routine for epilepsy",
    ),
    RecommendationRule(
        rule_id="SLEEP_LOG_ENCOURAGE",
        rule_version="1.0",
        category="SLEEP",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("sleep_log_count_7d", 99) < 3,
        title="Keep your sleep diary up to date",
        body="You've logged sleep very few times this week. Consistent logging helps you and your clinician spot patterns over time. Try to log every night.",
        rationale="Triggered because sleep logs < 3 over 7 days.",
        action_url="/lifestyle",
        cooldown_hours=72,
        search_query="benefits of health tracking for epilepsy",
    ),

    # --- MEDICATION ---
    RecommendationRule(
        rule_id="MED_LOW_ADHERENCE_7D",
        rule_version="1.0",
        category="MEDICATION_ROUTINE",
        priority="IMPORTANT",
        condition=lambda f: f.get("active_medication_count", 0) > 0 and f.get("med_adherence_rate_7d", 100) < 80.0,
        title="Some medication logs are missing this week",
        body="Your medication logging rate is below 80% this week. Take your medication exactly as prescribed by your clinician. If you're having difficulty with your routine, please contact your healthcare professional.",
        rationale="Triggered because medication adherence < 80% over 7 days.",
        action_url="/medications",
        cooldown_hours=48,
        search_query="medication adherence strategies for epilepsy",
    ),
    RecommendationRule(
        rule_id="MED_MISSED_STREAK",
        rule_version="1.0",
        category="MEDICATION_ROUTINE",
        priority="IMPORTANT",
        condition=lambda f: f.get("consecutive_missed_med_logs", 0) >= 3,
        title="You have several consecutive missed medication logs",
        body="It looks like you haven't logged your medication for 3 or more scheduled times. If you've been taking your medication but forgot to log, you can backfill in the Medications page. If you're having trouble with your medication routine, please reach out to your clinician.",
        rationale="Triggered because >=3 consecutive medication logs were missed.",
        action_url="/medications",
        cooldown_hours=48,
        search_query="managing missed medication doses safely",
    ),
    RecommendationRule(
        rule_id="MED_PERFECT_WEEK",
        rule_version="1.0",
        category="MEDICATION_ROUTINE",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("active_medication_count", 0) > 0 and f.get("med_adherence_rate_7d", 0) == 100.0 and f.get("med_adherence_rate_30d", 0) > 0,
        title="Great medication consistency this week!",
        body="You've logged every scheduled medication this week. Maintaining a consistent routine is a positive step in your self-management journey. Keep it up!",
        rationale="Triggered because medication adherence is 100% over 7 days.",
        action_url="/medications",
        cooldown_hours=168,  # Weekly
        search_query="positive habits and self-management for epilepsy",
    ),

    # --- STRESS ---
    RecommendationRule(
        rule_id="STRESS_HIGH_AVG_7D",
        rule_version="1.0",
        category="STRESS",
        priority="IMPORTANT",
        condition=lambda f: f.get("avg_stress_level_7d", 0) >= 4.0,
        title="Your stress levels have been elevated",
        body="Your average stress this week is elevated. Stress management techniques such as deep breathing, gentle exercise, or mindfulness may support your wellbeing. Consider discussing your stress levels with your clinician at your next visit.",
        rationale="Triggered because average stress >= 4/5 over 7 days.",
        action_url="/lifestyle",
        cooldown_hours=72,
        search_query="stress management techniques for epilepsy",
    ),
    RecommendationRule(
        rule_id="STRESS_LOG_ENCOURAGE",
        rule_version="1.0",
        category="STRESS",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("avg_stress_level_7d", 0) == 0.0 and f.get("lifestyle_log_count_7d", 99) < 2,
        title="Track your daily wellbeing",
        body="Logging your stress, diet, and daily activities helps build a clearer picture of your health patterns. Even a quick daily check-in is valuable.",
        rationale="Triggered because 0 stress logs in 7 days.",
        action_url="/lifestyle",
        cooldown_hours=72,
        search_query="tracking stress and lifestyle factors",
    ),

    # --- TRIGGERS ---
    RecommendationRule(
        rule_id="TRIGGER_REPEATED",
        rule_version="1.0",
        category="TRIGGER_TRACKING",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("trigger_count_7d", 0) >= 3 and f.get("most_common_trigger_7d") is not None,
        title="You've logged a specific trigger frequently",
        body="You've recorded a specific trigger multiple times this week. Consistent tracking helps identify patterns. Consider discussing these observations with your clinician at your next visit.",
        rationale="Triggered because the same trigger was logged >=3 times in 7 days.",
        action_url="/lifestyle",
        cooldown_hours=72,
        search_query="identifying and managing seizure triggers",
    ),
    RecommendationRule(
        rule_id="TRIGGER_LOG_ENCOURAGE",
        rule_version="1.0",
        category="TRIGGER_TRACKING",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("trigger_log_count_7d", 99) == 0 and f.get("manual_seizure_count_7d", 0) > 0,
        title="Consider logging possible triggers",
        body="You logged a seizure event this week. Recording potential triggers — such as stress, lack of sleep, or missed meals — can help you and your clinician understand patterns better.",
        rationale="Triggered because a seizure was logged but no triggers were logged in 7 days.",
        action_url="/lifestyle",
        cooldown_hours=72,
        search_query="why logging triggers is helpful for epilepsy",
    ),

    # --- EMERGENCY ---
    RecommendationRule(
        rule_id="EMERGENCY_NO_CONTACTS",
        rule_version="1.0",
        category="EMERGENCY_PREP",
        priority="IMPORTANT",
        condition=lambda f: not f.get("has_emergency_contacts", True),
        title="Add an emergency contact",
        body="You don't have any emergency contacts set up yet. Adding a trusted person ensures they can be reached quickly if you ever need help. This is an important part of your personal safety plan.",
        rationale="Triggered because user has 0 emergency contacts.",
        action_url="/emergency",
        cooldown_hours=48,
        search_query="creating an epilepsy safety plan",
    ),

    # --- DIAGNOSTICS ---
    RecommendationRule(
        rule_id="DIAGNOSTICS_REVIEW_REPORT",
        rule_version="1.0",
        category="DIAGNOSTICS_TRACKING",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("ai_reports_generated_30d", 0) > 0,
        title="You have recent AI diagnostic reports",
        body="A recent EEG upload has finished AI processing. You can review the LLM-generated report to understand the findings. Remember, AI reports are for informational purposes and should be discussed with your clinician.",
        rationale="Triggered because an AI report was generated in the last 30 days.",
        action_url="/eeg",
        cooldown_hours=168,
        search_query="understanding EEG reports",
    ),
    RecommendationRule(
        rule_id="DIAGNOSTICS_EEG_ENCOURAGE",
        rule_version="1.0",
        category="DIAGNOSTICS_TRACKING",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("eeg_upload_count_30d", 99) == 0 and f.get("manual_seizure_count_30d", 0) > 0,
        title="Consider uploading recent EEG data",
        body="You've logged seizures recently but haven't uploaded new EEG data. If you have EDF/CSV files from a wearable device, uploading them allows the AI to generate a detailed report for your doctor to review.",
        rationale="Triggered because a seizure was logged but 0 EEGs were uploaded in 30 days.",
        action_url="/eeg",
        cooldown_hours=168,
        search_query="benefits of continuous EEG monitoring",
    ),

    # --- ENGAGEMENT & PROGRESS ---
    RecommendationRule(
        rule_id="ENGAGEMENT_LOW_ACTIVITY",
        rule_version="1.0",
        category="ENGAGEMENT",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("data_completeness_score", 1.0) < 0.3,
        title="Start building your health picture",
        body="The more you log — sleep, medication, stress, and triggers — the better insights you and your clinician will have. Even small, consistent entries make a difference over time.",
        rationale="Triggered because data completeness score < 0.3.",
        action_url="/dashboard",
        cooldown_hours=72,
        search_query="how health tracking improves epilepsy care",
    ),
    RecommendationRule(
        rule_id="ENGAGEMENT_SEIZURE_DIARY",
        rule_version="1.0",
        category="ENGAGEMENT",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("manual_seizure_count_30d", 0) > 0 and f.get("days_since_last_manual_seizure", 0) > 14,
        title="Keep your seizure diary current",
        body="Regular seizure diary entries help track your progress. If you've had any events recently, logging them while the details are fresh is most helpful.",
        rationale="Triggered because a seizure occurred in the last 30d, but not in the last 14d.",
        action_url="/lifestyle",
        cooldown_hours=72,
        search_query="the importance of an accurate seizure diary",
    ),
    RecommendationRule(
        rule_id="PROGRESS_IMPROVED_LOGGING",
        rule_version="1.0",
        category="POSITIVE_PROGRESS",
        priority="INFORMATIONAL",
        condition=lambda f: f.get("data_completeness_score", 0.0) > 0.7,
        title="Your logging consistency is excellent!",
        body="You've been logging very consistently recently. This gives you and your care team a clearer picture of your health patterns. Great work!",
        rationale="Triggered because data completeness score > 0.7.",
        action_url="/dashboard",
        cooldown_hours=168,
        search_query="positive reinforcement for health habits",
    ),
]


class RuleEngine:

    @staticmethod
    async def _fetch_rag_evidence(db: AsyncSession, query: str) -> list[dict]:
        """Gracefully attempts to fetch RAG context."""
        if not RAG_AVAILABLE:
            return []
        
        try:
            async with db.begin_nested():
                # Safe text matching as fallback.
                stmt = select(RagChunk).where(RagChunk.content.ilike(f"%{query.split()[0]}%")).limit(2)
                chunks = (await db.execute(stmt)).scalars().all()
            
            evidence = []
            for c in chunks:
                doc = c.document
                evidence.append({
                    "title": doc.title if doc else "Medical Document",
                    "content": c.content[:200] + "...",
                    "url": doc.source_path if doc else "#"
                })
            return evidence
        except Exception:
            return []

    @staticmethod
    async def generate_recommendations(db: AsyncSession, snapshot: PatientFeatureSnapshot) -> list[Recommendation]:
        user_id = snapshot.user_id
        now = datetime.now(timezone.utc)
        features = snapshot.features

        # 1. Fetch recent recommendations to check cooldowns
        cutoff = now - timedelta(days=7)
        recent_recs_stmt = select(Recommendation).where(
            Recommendation.user_id == user_id,
            Recommendation.created_at >= cutoff
        )
        recent_recs = (await db.execute(recent_recs_stmt)).scalars().all()

        # 2. Evaluate all rules
        candidates: list[RecommendationRule] = []
        for rule in RULES:
            # Check condition safely
            try:
                if not rule.condition(features):
                    continue
            except Exception:
                continue
                
            # Check cooldown
            on_cooldown = False
            for r in recent_recs:
                if r.rule_id == rule.rule_id:
                    delta_hours = (now - r.created_at).total_seconds() / 3600
                    if delta_hours < rule.cooldown_hours:
                        on_cooldown = True
                        break
            
            if not on_cooldown:
                candidates.append(rule)

        # 3. Deduplicate by category
        unique_candidates: list[RecommendationRule] = []
        seen_categories = set()
        
        # Sort so IMPORTANT goes first
        candidates.sort(key=lambda x: 0 if x.priority == "IMPORTANT" else 1)
        
        for rule in candidates:
            if rule.category not in seen_categories:
                seen_categories.add(rule.category)
                unique_candidates.append(rule)

        # 4. Cap at max 3
        final_rules = unique_candidates[:3]
        
        # 5. Expire old active ones
        await db.execute(
            update(Recommendation)
            .where(Recommendation.user_id == user_id, Recommendation.is_active == True)
            .values(is_active=False)
        )

        # 6. Build and persist new recommendations
        new_recs = []
        for rule in final_rules:
            # Graceful RAG fetch
            evidence = await RuleEngine._fetch_rag_evidence(db, rule.search_query)
            
            rec = Recommendation(
                user_id=user_id,
                category=rule.category,
                title=rule.title,
                body=rule.body,
                rationale=rule.rationale,
                evidence_tags=evidence if evidence else None,
                rule_id=rule.rule_id,
                rule_version=rule.rule_version,
                content_version="1.0",
                source="RULE_ENGINE",
                priority=rule.priority,
                action_url=rule.action_url,
                feature_snapshot_id=snapshot.id,
                is_active=True,
            )
            new_recs.append(rec)
            db.add(rec)

        await db.commit()
        
        for rec in new_recs:
            await db.refresh(rec)
            
        return new_recs
