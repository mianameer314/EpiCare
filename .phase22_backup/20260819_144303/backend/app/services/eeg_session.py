"""
EEG session service — orchestrates the full upload → validate → preprocess
→ infer lifecycle and persists every step so the UI can resume/display
state after a refresh or crash.

Status transitions (EegSessionStatus):
    UPLOADED -> VALIDATING -> PREPROCESSING -> INFERENCE_RUNNING -> COMPLETED
    any      -> INVALID / FAILED (terminal, retryable)
"""
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import error_response, not_found_error, service_unavailable_error
from app.ml.executor import run_cpu_bound
from app.ml.inference import predict
from app.ml.model_loader import get_model_loader
from app.models.eeg_session import EegSession
from app.models.model_version import ModelVersion
from app.models.prediction import Prediction
from app.models.user import User
from app.schemas.eeg_session import EegSessionStatus
from app.services import eeg_reader, eeg_validation
from app.services.vlm_report import generate_vlm_report
from app.services.eeg_preprocessing import preprocess_eeg
from app.services.storage.service import StorageService, get_storage_service
from app.services.storage.validator import get_extension, validate_eeg_upload

logger = logging.getLogger(__name__)

VALID_ANALYZE_STATUSES = {
    EegSessionStatus.UPLOADED,
    EegSessionStatus.INVALID,
    EegSessionStatus.FAILED,
    EegSessionStatus.COMPLETED,
}


def _coerce_user_id(user_or_id: User | int) -> int:
    """Accept both the current User object API and older integer-ID callers/tests."""
    value = getattr(user_or_id, "id", user_or_id)
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid EEG session user identity") from exc


@dataclass
class _ValidatedFile:
    """Result of the read + validation step."""

    validation: eeg_validation.EegValidationResult
    channel_labels: list[str]
    sampling_rate: float
    data: object  # np.ndarray carried for preprocessing reuse


# ------------------------------------------------------------------
# Queries
# ------------------------------------------------------------------

async def get_session(db: AsyncSession, session_id: int, user_id: int) -> EegSession | None:
    """Fetch a session that belongs to the given user."""
    result = await db.execute(
        select(EegSession).where(
            EegSession.id == session_id,
            EegSession.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_session(db: AsyncSession, session_id: int, user_id: int) -> bool:
    """Delete a user's EEG session and its stored file (preserved live feature)."""
    session = await get_session(db, session_id, user_id)
    if session is None:
        return False

    try:
        storage = get_storage_service()
        if storage.exists(session.stored_path):
            storage.delete(session.stored_path)
    except Exception as exc:
        logger.warning("Could not delete stored file %s: %s", session.stored_path, exc)

    await db.delete(session)
    await db.commit()
    return True


async def list_sessions(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    per_page: int = 10,
) -> tuple[list[EegSession], int]:
    """Paginated session list for a user, newest first."""
    base = select(EegSession).where(EegSession.user_id == user_id)
    count_result = await db.execute(
        select(func.count()).select_from(base.subquery())
    )
    total = int(count_result.scalar_one())

    offset = (page - 1) * per_page
    result = await db.execute(
        base.order_by(EegSession.created_at.desc()).offset(offset).limit(per_page)
    )
    return list(result.scalars().all()), total


async def get_prediction_for_session(
    db: AsyncSession, session_id: int
) -> Prediction | None:
    """Return the latest prediction attached to a session."""
    result = await db.execute(
        select(Prediction)
        .where(Prediction.session_id == session_id)
        .order_by(Prediction.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _set_status(db: AsyncSession, session: EegSession, status: EegSessionStatus) -> None:
    """Persist a status transition (used before/after each heavy step)."""
    session.status = status.value
    await db.commit()


async def _set_failed(db: AsyncSession, session: EegSession, message: str) -> None:
    """Mark a session FAILED with a readable message."""
    session.status = EegSessionStatus.FAILED.value
    session.error_message = message[:2000]
    await db.commit()
    logger.error("eeg_session_failed", extra={"session_id": session.id, "error": message})


# ------------------------------------------------------------------
# Upload
# ------------------------------------------------------------------

async def create_upload_session(
    db: AsyncSession,
    user: User | int,
    file: UploadFile,
    storage: StorageService | None = None,
) -> EegSession:
    """
    Validate + persist an uploaded EEG file and create a session row.

    The file is written to storage and the DB row is committed together;
    if the DB commit fails, the pending upload is rolled back from disk.
    """
    user_id = _coerce_user_id(user)
    storage = storage or get_storage_service()
    data = await validate_eeg_upload(file)

    filename = file.filename or "eeg"
    extension = get_extension(filename)
    try:
        storage_key, file_hash = storage.save_eeg(file, data)
    except Exception as exc:
        logger.error("eeg_upload_save_failed: %s", exc)
        raise error_response(
            code="STORAGE_WRITE_FAILED",
            message="Could not store the uploaded file.",
            status_code=500,
        ) from exc

    session = EegSession(
        user_id=user_id,
        original_filename=filename,
        stored_path=storage_key,
        file_size_bytes=len(data),
        file_hash=file_hash,
        status=EegSessionStatus.UPLOADED.value,
    )
    db.add(session)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        storage.rollback_uploads()
        raise
    await db.refresh(session)
    storage.clear_pending()

    logger.info(
        "eeg_session_created",
        extra={
            "session_id": session.id,
            "user_id": user_id,
            "bytes": len(data),
            "format": extension,
        },
    )
    return session


# ------------------------------------------------------------------
# Analyze (validate -> preprocess -> infer)
# ------------------------------------------------------------------

async def analyze_session(
    db: AsyncSession,
    user: User | int,
    session_id: int,
) -> Prediction:
    """
    Run the full analysis pipeline for an EEG session and persist a
    prediction. Every heavy step is executed in the process pool and the
    session status is updated before/after each one.

    Raises:
        HTTPException(404): session not found / not owned by user.
        HTTPException(400): invalid EEG (validation errors surfaced).
        HTTPException(503): model unavailable or inference failure.
    """
    user_id = _coerce_user_id(user)
    session = await get_session(db, session_id, user_id)
    if session is None:
        raise not_found_error("EEG session")

    if EegSessionStatus(session.status) not in VALID_ANALYZE_STATUSES:
        raise error_response(
            code="SESSION_NOT_ANALYZABLE",
            message=f"Cannot analyze session in status '{session.status}'",
            status_code=409,
        )

    storage = get_storage_service()
    try:
        file_bytes = storage.read(session.stored_path)
    except Exception:
        await _set_failed(db, session, "Stored file missing from disk")
        raise error_response(
            code="STORAGE_READ_FAILED",
            message="The stored EEG file could not be read.",
            status_code=500,
        ) from None

    # 1) Read + validate -------------------------------------------
    await _set_status(db, session, EegSessionStatus.VALIDATING)
    validated = await _read_and_validate(db, session, file_bytes)

    if not validated.validation.valid:
        session.validation_result = _validation_dict(validated.validation)
        session.error_message = "; ".join(validated.validation.errors)
        session.status = EegSessionStatus.INVALID.value
        await db.commit()
        raise error_response(
            code="INVALID_EEG_FILE",
            message="The EEG file failed validation.",
            details=validated.validation.errors,
            status_code=400,
        )

    # 2) Require the exact frozen serving package --------------------
    model_loader = get_model_loader()
    if not model_loader.is_ready or model_loader.package is None:
        message = model_loader.last_error or "Frozen seizure model is unavailable"
        await _set_failed(db, session, message)
        raise service_unavailable_error(
            "Seizure detection model is not available"
        )

    session.validation_result = _validation_dict(validated.validation)
    await db.commit()

    # 3) Frozen preprocessing + signal-driven routing ----------------
    await _set_status(db, session, EegSessionStatus.PREPROCESSING)
    try:
        preprocessed = await preprocess_eeg(
            validated.data,
            validated.sampling_rate,
            validated.channel_labels,
            str(model_loader.package.root),
        )
    except Exception as exc:
        await _set_failed(db, session, str(exc))
        raise error_response(
            code="EEG_PREPROCESSING_FAILED",
            message="The EEG could not be transformed with the frozen serving contract.",
            details=str(exc),
            status_code=400,
        ) from exc

    # Persist serving diagnostics without changing the prediction table schema.
    validation_payload = _validation_dict(
        validated.validation,
        preprocessed.warnings,
    )
    validation_payload["preprocessing"] = {
        "montage_style": preprocessed.montage_style,
        "universal_route": preprocessed.universal_route,
        "sampling_rate": preprocessed.sampling_rate,
        "window_seconds": preprocessed.window_seconds,
        "windows_count": preprocessed.windows_count,
    }
    session.validation_result = validation_payload
    await db.commit()

    # 4) One-input ONNX + frozen causal temporal policy --------------
    await _set_status(db, session, EegSessionStatus.INFERENCE_RUNNING)
    try:
        inference = predict(preprocessed.model_inputs)
    except Exception as exc:
        await _set_failed(db, session, str(exc))
        raise

    # 5) Persist --------------------------------------------------------
    model_version_id = await _resolve_model_version_id(db, inference.model_version)
    prediction = Prediction(
        session_id=session.id,
        user_id=user_id,
        model_version_id=model_version_id,
        predicted_class=inference.predicted_class,
        confidence=inference.confidence,
        threshold=inference.threshold,
        positive_windows=inference.positive_windows,
        total_windows=inference.total_windows,
        max_probability=inference.max_probability,
        mean_probability=inference.mean_probability,
        window_probabilities=inference.window_probabilities,
        status="COMPLETED",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(prediction)

    session.status = EegSessionStatus.COMPLETED.value
    session.error_message = None
    await db.commit()
    await db.refresh(prediction)

    # 6) Optional VLM report generation (preserved live feature).
    # It remains non-blocking for the detector lifecycle: unavailable/pending VLM
    # support is logged but never changes the frozen seizure prediction.
    try:
        await generate_vlm_report(db, prediction.id)
    except Exception as exc:
        logger.info("VLM report generation skipped or pending: %s", exc)

    logger.info(
        "eeg_analysis_completed",
        extra={
            "session_id": session.id,
            "prediction_id": prediction.id,
            "predicted_class": inference.predicted_class,
            "confidence": inference.confidence,
            "model_version": inference.model_version,
        },
    )
    return prediction


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

async def _read_and_validate(
    db: AsyncSession,
    session: EegSession,
    file_bytes: bytes,
) -> _ValidatedFile:
    """Parse the stored file and run structural validation in the pool."""
    from app.services.storage.local import LocalStorageProvider

    provider = LocalStorageProvider()
    extension = get_extension(session.original_filename)
    temp_path = provider._resolve(f"eeg/_validate_{session.id}_{extension}")
    try:
        temp_path.write_bytes(file_bytes)
        read_result = await eeg_reader.read_eeg_file(str(temp_path), extension)
        payload = await run_cpu_bound(
            eeg_validation._validate_signal_block,
            {
                "data": read_result.data,
                "sampling_rate": read_result.sampling_rate,
                "channel_labels": read_result.channel_labels,
            },
            task_name="eeg_validate",
        )
        validation = eeg_validation.build_validation_result(payload)
        return _ValidatedFile(
            validation=validation,
            channel_labels=read_result.channel_labels,
            sampling_rate=read_result.sampling_rate,
            data=read_result.data,
        )
    finally:
        temp_path.unlink(missing_ok=True)


def _validation_dict(
    validation: eeg_validation.EegValidationResult,
    extra_warnings: list[str] | None = None,
) -> dict:
    """Serialize a validation result for the JSONB column."""
    warnings = list(validation.warnings) + (extra_warnings or [])
    return {
        "valid": validation.valid,
        "sampling_rate": validation.sampling_rate,
        "duration_seconds": validation.duration_seconds,
        "channels_found": validation.channels_found,
        "channels_used": validation.channels_used,
        "warnings": warnings,
        "errors": validation.errors,
    }


async def _resolve_model_version_id(db: AsyncSession, version: str) -> int | None:
    """Resolve a model version string to its DB row id (best effort)."""
    result = await db.execute(
        select(ModelVersion.id).where(ModelVersion.version == version)
    )
    return result.scalar_one_or_none()
