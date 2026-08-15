import logging
import os
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.prediction import Prediction
from app.models.ai_report import AiReport

logger = logging.getLogger(__name__)

# The AI team is expected to put their VLM models/scripts in this directory
PROJECT_ROOT = Path(__file__).resolve().parents[3]
VLM_MODEL_DIR = PROJECT_ROOT / "models" / "vlm"


async def generate_vlm_report(db: AsyncSession, prediction_id: int) -> AiReport:
    """
    Generate an explainable AI report for a given prediction using the VLM.
    If the VLM model is not trained/present, returns a specific fallback exception
    so the frontend can display a graceful "Model Not Trained" state.
    """
    
    # 1. Dynamic Check: Does the VLM model or script exist?
    # We check if the directory exists and is not empty, or if a specific script exists.
    is_model_trained = VLM_MODEL_DIR.exists() and any(VLM_MODEL_DIR.iterdir())
    
    if not is_model_trained:
        logger.info(f"VLM model not found in {VLM_MODEL_DIR}. Graceful fallback triggered.")
        # We raise an HTTP exception with a specific error code that the frontend can catch
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_NOT_TRAINED",
                "message": "The VLM model is not trained yet. Awaiting AI team."
            }
        )
    
    # 2. If the model exists, the AI team will replace the code below with their actual
    # HuggingFace / LLaVA inference code.
    logger.info(f"VLM model found. Generating report for prediction {prediction_id}...")
    
    # --- AI TEAM: PASTE YOUR VLM INFERENCE CODE HERE ---
    # 
    # Example:
    # from vlm.inference import generate_report
    # report_json = generate_report(spectrogram_path)
    
    report_json = {
        "summary": "AI Team: Please populate this with real VLM output.",
        "findings": ["Finding 1", "Finding 2"],
        "recommendation": "Consult a neurologist."
    }
    
    # ---------------------------------------------------
    
    report = AiReport(
        prediction_id=prediction_id,
        report_json=report_json
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report
