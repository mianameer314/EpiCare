"""
EEG routes — upload, session lifecycle, and analysis (async).

The analyze endpoint runs the full pipeline (validate → preprocess → infer)
synchronously per request for the FYP; the session status column keeps every
step observable so a future background-task refactor is drop-in.
"""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbDep, TargetPatientIdForRead, TargetPatientIdForDiagnosticUpload
from app.core.exceptions import not_found_error
from app.rate_limit import UPLOAD_LIMIT
from app.schemas.eeg_session import EegSessionList, EegSessionOut
from app.schemas.prediction import PredictionOut
from app.services import eeg_session as session_service
from app.services.storage.service import get_storage_service

router = APIRouter(prefix="/eeg")


@router.post(
    "/upload",
    tags=['🤒 Patient - Diagnostics', '👨\u200d⚕️ Doctor - Diagnostics'],
    response_model=EegSessionOut,
    status_code=201,
    dependencies=[Depends(UPLOAD_LIMIT)],
    summary="Upload EEG recording",
    description="Upload an EEG file (EDF/CSV format) to create a new analysis session. Returns the created session details. Rate limits apply.",
    responses={
        400: {"description": "Bad Request - Invalid file format or file too large"},
        401: {"description": "Unauthorized"},
        429: {"description": "Too Many Requests - Upload rate limit exceeded"},
    },
)
async def upload_eeg(
    target_user_id: TargetPatientIdForDiagnosticUpload,
    db: DbDep,
    file: UploadFile = File(...),
    metadata: str | None = Form(None),
):
    """Upload an EEG file (EDF/CSV) and create an analysis session."""
    return await session_service.create_upload_session(db, target_user_id, file)


from datetime import date, datetime, time
from app.api.pagination import PaginationParams, get_pagination_params, get_total_count, apply_pagination, create_paginated_response
from app.schemas.common import PaginatedResponse
from app.models.eeg_session import EegSession
from app.models.prediction import Prediction
from sqlalchemy import select

@router.get(
    "/sessions",
    tags=['🤒 Patient - Diagnostics', '👨\u200d⚕️ Doctor - Diagnostics'],
    response_model=PaginatedResponse[EegSessionOut],
    summary="List EEG sessions",
    description="Retrieve a paginated list of all EEG sessions uploaded by the current authenticated user.",
    responses={
        401: {"description": "Unauthorized"},
    },
)
async def list_eeg_sessions(
    target_user_id: TargetPatientIdForRead,
    db: DbDep,
    params: PaginationParams = Depends(get_pagination_params),
    start_date: date | None = None,
    end_date: date | None = None,
    status: str | None = None
):
    """Paginated list of the current user's EEG sessions."""
    query = select(EegSession).where(EegSession.user_id == target_user_id)
    
    if start_date:
        query = query.where(EegSession.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.where(EegSession.created_at <= datetime.combine(end_date, time.max))
    if status:
        query = query.where(EegSession.status == status)
        
    if params.sort_by and hasattr(EegSession, params.sort_by):
        column = getattr(EegSession, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(EegSession.created_at.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


@router.get(
    "/sessions/{session_id}",
    tags=['🤒 Patient - Diagnostics', '👨\u200d⚕️ Doctor - Diagnostics'],
    response_model=EegSessionOut,
    summary="Get session details",
    description="Retrieve the details, validation result, and status pipeline for a single EEG session.",
    responses={
        401: {"description": "Unauthorized"},
        404: {"description": "Not Found - Session does not exist or belongs to another user"},
    },
)
async def get_eeg_session(
    session_id: int,
    target_user_id: TargetPatientIdForRead,
    db: DbDep,
):
    """Get a single session with its validation result and status."""
    session = await session_service.get_session(db, session_id, target_user_id)
    if session is None:
        raise not_found_error("EEG session")
    return session


@router.delete(
    "/sessions/{session_id}",
    tags=['🤒 Patient - Diagnostics', '👨‍⚕️ Doctor - Diagnostics'],
    status_code=204,
    summary="Delete EEG session",
    description="Delete an EEG recording session, associated predictions, and remove its stored file.",
    responses={
        204: {"description": "Session deleted successfully"},
        401: {"description": "Unauthorized"},
        404: {"description": "Not Found - Session does not exist or belongs to another user"},
    },
)
async def delete_eeg_session(
    session_id: int,
    target_user_id: TargetPatientIdForDiagnosticUpload,
    db: DbDep,
):
    """Delete a single EEG session."""
    deleted = await session_service.delete_session(db, session_id, target_user_id)
    if not deleted:
        raise not_found_error("EEG session")
    return None


@router.post(
    "/sessions/{session_id}/analyze",
    tags=['🤒 Patient - Diagnostics', '👨\u200d⚕️ Doctor - Diagnostics'],
    response_model=PredictionOut,
    summary="Analyze EEG session",
    description="Trigger the full AI analysis pipeline for the given session (validation, preprocessing, inference) and return the generated seizure prediction report.",
    responses={
        400: {"description": "Bad Request - Session already analyzed, or file invalid"},
        401: {"description": "Unauthorized"},
        404: {"description": "Not Found - Session does not exist or belongs to another user"},
        500: {"description": "Internal Server Error - ML pipeline failed"},
    },
)
async def analyze_eeg_session(
    session_id: int,
    target_user_id: TargetPatientIdForDiagnosticUpload,
    db: DbDep,
):
    """Run the full analysis pipeline and return the prediction."""
    return await session_service.analyze_session(db, target_user_id, session_id)


@router.get(
    "/sessions/{session_id}/spectrogram",
    tags=['🤒 Patient - Diagnostics', '👨\u200d⚕️ Doctor - Diagnostics'],
    summary="Get session spectrogram",
    description="Download or serve the generated spectrogram PNG image for a processed EEG session.",
    responses={
        200: {"description": "Successful Response - Returns an image/png file", "content": {"image/png": {}}},
        401: {"description": "Unauthorized"},
        404: {"description": "Not Found - Session or spectrogram does not exist"},
    },
)
async def get_session_spectrogram(
    session_id: int,
    target_user_id: TargetPatientIdForRead,
    db: DbDep,
):
    """Serve the stored spectrogram image for a session (if generated)."""
    session = await session_service.get_session(db, session_id, target_user_id)
    if session is None:
        raise not_found_error("EEG session")

    storage = get_storage_service()
    key = f"spectrograms/session_{session_id}.png"
    if not storage.exists(key):
        raise not_found_error("Spectrogram")

    from app.services.storage.local import LocalStorageProvider

    provider = storage.provider
    if isinstance(provider, LocalStorageProvider):
        return FileResponse(str(provider._resolve(key)), media_type="image/png")

    raise not_found_error("Spectrogram")


@router.get(
    "/sessions/{session_id}/predictions",
    tags=['🤒 Patient - Diagnostics', '👨\u200d⚕️ Doctor - Diagnostics'],
    response_model=PaginatedResponse[PredictionOut],
    summary="List session predictions",
    description="Retrieve a paginated list of all AI predictions associated with this session.",
    responses={
        401: {"description": "Unauthorized"},
        404: {"description": "Not Found - Session does not exist"},
    },
)
async def get_session_predictions(
    session_id: int,
    target_user_id: TargetPatientIdForRead,
    db: DbDep,
    params: PaginationParams = Depends(get_pagination_params),
):
    """Return all predictions for a session."""
    session = await session_service.get_session(db, session_id, target_user_id)
    if session is None:
        raise not_found_error("EEG session")

    query = select(Prediction).where(Prediction.session_id == session_id)
    if params.sort_by and hasattr(Prediction, params.sort_by):
        column = getattr(Prediction, params.sort_by)
        query = query.order_by(column.asc() if params.sort_order.lower() == "asc" else column.desc())
    else:
        query = query.order_by(Prediction.created_at.desc())
        
    total = await get_total_count(db, query)
    query = apply_pagination(query, params.skip, params.limit)
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(items, total, params.skip, params.limit)


@router.get(
    "/model-status",
    tags=['🤖 Machine Learning'],
    summary="Get AI Model Status",
    description="Check whether the active seizure classification model is loaded or awaiting weights deployment.",
)
async def get_eeg_model_status():
    """Returns the current loading and deployment status of the EEG seizure ML model."""
    from app.ml.model_loader import get_model_loader
    loader = get_model_loader()
    return {
        "ready": loader.is_ready,
        "status": "LOADED" if loader.is_ready else "TRAINING_PENDING",
        "version": loader.version or "v1-pending",
        "message": "AI neural model loaded and ready for inference." if loader.is_ready else "AI model weights pending deployment in models directory.",
    }

