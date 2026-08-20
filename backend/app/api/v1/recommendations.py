from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbDep
from app.models.recommendation import Recommendation
from app.models.recommendation_feedback import RecommendationFeedback
from app.schemas.recommendation import (
    RecommendationOut,
    RecommendationWhyOut,
    RecommendationStatsOut,
    FeedbackCreate
)
from app.services.feature_engine import FeatureEngine
from app.services.recommender import RuleEngine

async def attach_user_feedback(db: AsyncSession, user_id: int, recs: List[Recommendation]) -> List[Recommendation]:
    if not recs:
        return recs
    rec_ids = [r.id for r in recs]
    stmt = select(RecommendationFeedback).where(
        RecommendationFeedback.user_id == user_id,
        RecommendationFeedback.recommendation_id.in_(rec_ids),
        RecommendationFeedback.event_type.in_(["HELPFUL", "NOT_HELPFUL"])
    )
    feedbacks = (await db.execute(stmt)).scalars().all()
    feedback_map = {f.recommendation_id: f.event_type for f in feedbacks}
    
    for r in recs:
        # Dynamically attach to the SQLAlchemy model instance; Pydantic will pick it up
        r.user_feedback = feedback_map.get(r.id)
    return recs

router = APIRouter(prefix="/recommendations", tags=["🤒 Patient - Care Insights"])

@router.get("/", response_model=List[RecommendationOut])
async def get_active_recommendations(
    current_user: CurrentUser,
    db: DbDep,
):
    """Get active recommendations. Automatically tracks a SHOWN event if not read."""
    stmt = select(Recommendation).where(
        Recommendation.user_id == current_user.id,
        Recommendation.is_active == True
    ).order_by(Recommendation.created_at.desc())
    
    recs = (await db.execute(stmt)).scalars().all()
    return await attach_user_feedback(db, current_user.id, list(recs))


@router.get("/history", response_model=List[RecommendationOut])
async def get_recommendation_history(
    current_user: CurrentUser,
    db: DbDep,
    skip: int = 0,
    limit: int = 20,
):
    stmt = select(Recommendation).where(
        Recommendation.user_id == current_user.id
    ).order_by(Recommendation.created_at.desc()).offset(skip).limit(limit)
    recs = (await db.execute(stmt)).scalars().all()
    return await attach_user_feedback(db, current_user.id, list(recs))


@router.post("/regenerate", response_model=List[RecommendationOut])
async def regenerate_recommendations(
    current_user: CurrentUser,
    db: DbDep,
):
    """Force regenerate recommendations right now."""
    snapshot = await FeatureEngine.compute_snapshot(db, current_user.id, force_recompute=True)
    recs = await RuleEngine.generate_recommendations(db, snapshot)
    return await attach_user_feedback(db, current_user.id, recs)


@router.patch("/{id}/read")
async def mark_as_read(
    id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    rec = await db.get(Recommendation, id)
    if not rec or rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    rec.read_at = func.now()
    
    feedback = RecommendationFeedback(
        recommendation_id=rec.id,
        user_id=current_user.id,
        event_type="READ",
        feature_snapshot_id=rec.feature_snapshot_id,
        recommendation_category=rec.category,
        rule_id=rec.rule_id,
        rule_version=rec.rule_version
    )
    db.add(feedback)
    await db.commit()
    return {"status": "ok"}


@router.patch("/{id}/dismiss")
async def dismiss_recommendation(
    id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    rec = await db.get(Recommendation, id)
    if not rec or rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    rec.is_dismissed = True
    rec.is_active = False
    rec.dismissed_at = func.now()
    
    feedback = RecommendationFeedback(
        recommendation_id=rec.id,
        user_id=current_user.id,
        event_type="DISMISSED",
        feature_snapshot_id=rec.feature_snapshot_id,
        recommendation_category=rec.category,
        rule_id=rec.rule_id,
        rule_version=rec.rule_version
    )
    db.add(feedback)
    await db.commit()
    return {"status": "ok"}


@router.post("/{id}/feedback")
async def submit_feedback(
    id: int,
    feedback_in: FeedbackCreate,
    current_user: CurrentUser,
    db: DbDep,
):
    rec = await db.get(Recommendation, id)
    if not rec or rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    # Check for existing feedback of the same group to ensure idempotency
    if feedback_in.event_type in ["HELPFUL", "NOT_HELPFUL"]:
        stmt = select(RecommendationFeedback).where(
            RecommendationFeedback.recommendation_id == id,
            RecommendationFeedback.user_id == current_user.id,
            RecommendationFeedback.event_type.in_(["HELPFUL", "NOT_HELPFUL"])
        )
        existing = (await db.execute(stmt)).scalars().first()
        
        if existing:
            # Update the existing record instead of spamming new rows
            existing.event_type = feedback_in.event_type
            if feedback_in.feedback_text:
                existing.feedback_text = feedback_in.feedback_text
            await db.commit()
            return {"status": "ok"}
            
    feedback = RecommendationFeedback(
        recommendation_id=rec.id,
        user_id=current_user.id,
        event_type=feedback_in.event_type,
        feedback_text=feedback_in.feedback_text,
        feature_snapshot_id=rec.feature_snapshot_id,
        recommendation_category=rec.category,
        rule_id=rec.rule_id,
        rule_version=rec.rule_version
    )
    db.add(feedback)
    await db.commit()
    return {"status": "ok"}


@router.get("/{id}/why-this-was-shown", response_model=RecommendationWhyOut)
async def why_this_was_shown(
    id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    stmt = select(Recommendation).options(selectinload(Recommendation.feature_snapshot)).where(Recommendation.id == id, Recommendation.user_id == current_user.id)
    rec = (await db.execute(stmt)).scalar_one_or_none()
    
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    from app.services.recommender import RULES
    
    rule = next((r for r in RULES if r.rule_id == rec.rule_id), None)
    explanation = rule.rationale if rule else "Triggered by deterministic rules."
    
    features = {}
    if rec.feature_snapshot:
        features = rec.feature_snapshot.features
        
    return RecommendationWhyOut(
        rule_id=rec.rule_id,
        rule_version=rec.rule_version,
        condition_description=explanation,
        feature_values_used=features,
        generated_at=rec.created_at
    )


@router.get("/stats/analytics", response_model=RecommendationStatsOut)
async def get_analytics(
    current_user: CurrentUser,
    db: DbDep,
):
    # Total generated
    gen_stmt = select(func.count(Recommendation.id)).where(Recommendation.user_id == current_user.id)
    total_generated = (await db.execute(gen_stmt)).scalar_one() or 0
    
    # Read and dismissed
    read_stmt = select(func.count(Recommendation.id)).where(Recommendation.user_id == current_user.id, Recommendation.read_at.is_not(None))
    total_read = (await db.execute(read_stmt)).scalar_one() or 0
    
    dis_stmt = select(func.count(Recommendation.id)).where(Recommendation.user_id == current_user.id, Recommendation.is_dismissed == True)
    total_dismissed = (await db.execute(dis_stmt)).scalar_one() or 0
    
    # Helpful
    help_stmt = select(func.count(RecommendationFeedback.id)).where(RecommendationFeedback.user_id == current_user.id, RecommendationFeedback.event_type == "HELPFUL")
    total_helpful = (await db.execute(help_stmt)).scalar_one() or 0
    
    # Not helpful
    nhelp_stmt = select(func.count(RecommendationFeedback.id)).where(RecommendationFeedback.user_id == current_user.id, RecommendationFeedback.event_type == "NOT_HELPFUL")
    total_not_helpful = (await db.execute(nhelp_stmt)).scalar_one() or 0
    
    # Categories
    cat_stmt = select(Recommendation.category, func.count(Recommendation.id)).where(Recommendation.user_id == current_user.id).group_by(Recommendation.category)
    cat_rows = (await db.execute(cat_stmt)).all()
    categories = {row.category: row.count for row in cat_rows}
    
    return RecommendationStatsOut(
        total_generated=total_generated,
        total_read=total_read,
        total_dismissed=total_dismissed,
        total_helpful=total_helpful,
        total_not_helpful=total_not_helpful,
        categories=categories
    )
