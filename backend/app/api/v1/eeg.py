"""
EEG routes — upload, session lifecycle, and analysis (async).

The analyze endpoint runs the full pipeline (validate → preprocess → infer)
synchronously per request for the FYP; the session status column keeps every
step observable so a future background-task refactor is drop-in.
"""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbDep
from app.core.exceptions import not_found_error
from app.rate_limit import UPLOAD_LIMIT
from app.schemas.eeg_session import EegSessionList, EegSessionOut
from app.schemas.prediction import PredictionOut
from app.services import eeg_session as session_service
from app.services.storage.service import get_storage_service

router = APIRouter(prefix="/eeg", tags=["EEG Analysis"])


@router.post(
    "/upload",
    response_model=EegSessionOut,
    status_code=201,
    dependencies=[Depends(UPLOAD_LIMIT)],
)
async def upload_eeg(
    file: UploadFile = File(...),
    metadata: str | None = Form(None),
    current_user: CurrentUser,
    db: DbDep,
):
    """Upload an EEG file (EDF/CSV) and create an analysis session."""
    return await session_service.create_upload_session(db, current_user, file)


@router.get("/sessions", response_model=EegSessionList)
async def list_eeg_sessions(
    page: int = 1,
    per_page: int = 10,
    current_user: CurrentUser,
    db: DbDep,
):
    """Paginated list of the current user's EEG sessions."""
    sessions, total = await session_service.list_sessions(
        db, current_user.id, page=page, per_page=per_page
    )
    return EegSessionList(
        items=sessions,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/sessions/{session_id}", response_model=EegSessionOut)
async def get_eeg_session(
    session_id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    """Get a single session with its validation result and status."""
    session = await session_service.get_session(db, session_id, current_user.id)
    if session is None:
        raise not_found_error("EEG session")
    return session


@router.post("/sessions/{session_id}/analyze", response_model=PredictionOut)
async def analyze_eeg_session(
    session_id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    """Run the full analysis pipeline and return the prediction."""
    return await session_service.analyze_session(db, current_user, session_id)


@router.get("/sessions/{session_id}/spectrogram")
async def get_session_spectrogram(
    session_id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    """Serve the stored spectrogram image for a session (if generated)."""
    session = await session_service.get_session(db, session_id, current_user.id)
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


@router.get("/sessions/{session_id}/prediction", response_model=PredictionOut)
async def get_session_prediction(
    session_id: int,
    current_user: CurrentUser,
    db: DbDep,
):
    """Return the latest prediction for a session (404 when none exists)."""
    session = await session_service.get_session(db, session_id, current_user.id)
    if session is None:
        raise not_found_error("EEG session")

    prediction = await session_service.get_prediction_for_session(db, session_id)
    if prediction is None:
        raise not_found_error("Prediction")
    return prediction
