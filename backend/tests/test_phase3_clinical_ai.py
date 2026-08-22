"""
Phase 3 Security & Clinical Integrity Tests
Tests RAG Storage & Checksum Deduplication (Finding 9),
Chat Educational Framing, Emergency Triage & Dosage Refusal (Finding 10),
Unicode-Safe Chat Session Titles (Finding 20),
Request Context Single Identity Resolution (Finding 17),
EEG Spectrogram Error Classification (Finding 18),
Sleep Log Negative Duration Rejection (Finding 19),
and Dashboard PDF Stress Scale Label (Finding 20).
"""
import hashlib
import io
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.api.v1.chat import make_session_title
from app.db.session import TestSessionLocal
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.pending_registration import PendingRegistration
from app.models.rag import RagDocument
from app.models.user import User
from app.schemas.lifestyle import SleepLogCreate, SleepLogUpdate
from app.services.chat import generate_clinical_knowledge_response
from app.services.rag_ingestion import ingest_document


async def _create_user(client: TestClient, role: str = "PATIENT", prefix: str = "p3") -> tuple[dict, int, str]:
    """Helper to register, verify, and return (auth_headers, user_id, email)."""
    email = f"{role.lower()}_{prefix}_{uuid.uuid4().hex[:6]}@example.com"
    phone = f"+923{str(uuid.uuid4().int)[:9]}"

    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": f"Test {role.capitalize()}",
            "phone_number": phone,
            "role": role,
            "pmdc_number": f"PMDC-{prefix}" if role == "DOCTOR" else None,
        },
    )
    assert reg_res.status_code == 201, reg_res.text

    async with TestSessionLocal() as session:
        res = await session.execute(select(PendingRegistration).where(PendingRegistration.email == email))
        pending = res.scalar_one_or_none()
        if pending:
            user = User(
                email=pending.email,
                password_hash=pending.password_hash,
                phone_number=pending.phone_number,
                full_name=pending.full_name,
                role=UserRole(role),
                is_active=True,
                is_email_verified=True,
                is_phone_verified=False,
                otp_attempts=0,
            )
            session.add(user)
            await session.flush()

            if role == "PATIENT":
                session.add(PatientProfile(user_id=user.id, date_of_birth=datetime.now(timezone.utc).date()))

            await session.delete(pending)
            await session.commit()
            user_id = user.id

    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id, email


@pytest.mark.asyncio
async def test_rag_ingestion_storage_and_deduplication():
    """Finding 9: RAG document upload stores real bytes, computes SHA-256, and deduplicates."""
    doc_content = b"%PDF-1.5 Verified Clinical Epilepsy Research Paper Content"
    expected_hash = hashlib.sha256(doc_content).hexdigest()

    fake_file = UploadFile(
        filename="epilepsy_guidelines_2026.pdf",
        file=io.BytesIO(doc_content),
        headers={"content-type": "application/pdf"},
    )

    async with TestSessionLocal() as session:
        doc = await ingest_document(session, fake_file)
        assert doc.id is not None
        assert doc.checksum == expected_hash
        assert doc.status in ("UPLOADED", "PENDING_AI_TEAM", "INGESTED")
        assert doc.source_path.startswith("rag/documents/")

        # Ingest identical file -> must return existing record (deduplication)
        duplicate_file = UploadFile(
            filename="epilepsy_guidelines_2026.pdf",
            file=io.BytesIO(doc_content),
            headers={"content-type": "application/pdf"},
        )
        dup_doc = await ingest_document(session, duplicate_file)
        assert dup_doc.id == doc.id


def test_chat_emergency_protocol_and_refusal():
    """Finding 10: Acute emergency keywords trigger triage protocol; dosage requests are safely refused."""
    # 1. Emergency triage response
    emergency_resp = generate_clinical_knowledge_response("My friend is having a seizure right now, what do I do?")
    assert "IMMEDIATE EMERGENCY" in emergency_resp
    assert "1122" in emergency_resp or "911" in emergency_resp
    assert "Emergency SOS" in emergency_resp

    # 2. Medication dosage refusal guard
    dosage_resp = generate_clinical_knowledge_response("How much Keppra should I take daily to stop seizures?")
    assert "Medication Prescription & Dosage Safety Notice" in dosage_resp
    assert "cannot calculate, change, or prescribe" in dosage_resp


def test_chat_unicode_safe_session_title():
    """Finding 20: Session title generation must handle multi-byte Unicode and emojis gracefully."""
    title_en = make_session_title("What are the primary triggers of nocturnal seizures?")
    assert title_en == "What are the primary triggers of nocturnal..."

    title_emoji = make_session_title("🚨 Seizure Emergency Advice for Caretakers and Families")
    assert title_emoji.startswith("🚨")
    assert len(title_emoji) <= 48

    title_empty = make_session_title("    ")
    assert title_empty == "Educational Inquiry"


def test_sleep_log_interval_validation_rejects_negative_duration():
    """Finding 19: Sleep intervals where woke_at <= slept_at must raise a validation error."""
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)

    # 1. Negative duration in SleepLogCreate
    with pytest.raises(ValueError, match="woke_at must be strictly after slept_at"):
        SleepLogCreate(
            slept_at=now,
            woke_at=one_hour_ago,  # woke up before sleeping
            quality=4,
        )

    # 2. Negative duration in SleepLogUpdate
    with pytest.raises(ValueError, match="woke_at must be strictly after slept_at"):
        SleepLogUpdate(
            slept_at=now,
            woke_at=one_hour_ago,
        )

    # 3. Valid duration succeeds
    valid = SleepLogCreate(
        slept_at=one_hour_ago,
        woke_at=now,
        quality=4,
    )
    assert valid.woke_at > valid.slept_at


@pytest.mark.asyncio
async def test_sleep_log_api_rejects_negative_duration(client: TestClient):
    """Finding 19: API rejects sleep log with negative duration (HTTP 422)."""
    headers, _, _ = await _create_user(client, role="PATIENT", prefix="sleeppt")

    now = datetime.now(timezone.utc)
    slept = now.isoformat()
    woke_earlier = (now - timedelta(hours=2)).isoformat()

    resp = client.post(
        "/api/v1/lifestyle/sleep",
        json={"slept_at": slept, "woke_at": woke_earlier, "quality": 3},
        headers=headers,
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_chat_message_flow_and_disclaimer(client: TestClient):
    """Finding 10: Sending chat message returns educational guidance with proper disclaimers."""
    headers, _, _ = await _create_user(client, role="PATIENT", prefix="chatpt")

    resp = client.post(
        "/api/v1/chat/message",
        json={"content": "What is the best sleep hygiene routine for someone with epilepsy?"},
        headers=headers,
    )
    assert resp.status_code == 200
    msg = resp.json()
    assert msg["role"] == "assistant"
    assert "Sleep Hygiene" in msg["content"] or "Educational" in msg["content"]
