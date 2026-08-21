import asyncio
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import TestSessionLocal
from app.models.emergency import EmergencyContact, SosEvent
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.services.email import send_verification_email
from app.services.sos_provider import (
    DeliveryStatus,
    FirebaseSOSProvider,
    TwilioSOSProvider,
    WhatsAppSOSProvider,
)
from app.services.user import check_reset_otp, reset_user_password, verify_registration_otp


# ── Helper for user setup ──────────────────────────────────────────────────

async def _create_user(client: TestClient, role: str = "PATIENT", prefix: str = "sec") -> tuple[dict, int]:
    email = f"{role.lower()}_{prefix}_{uuid.uuid4().hex[:6]}@example.com"
    phone = f"+923{str(uuid.uuid4().int)[:9]}"
    
    # 1. Register
    reg_res = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": f"Test {role.capitalize()}",
        "phone_number": phone,
        "role": role,
        "pmdc_number": f"PMDC-{prefix}" if role == "DOCTOR" else None,
    })
    assert reg_res.status_code == 201, reg_res.text

    # 2. Promote from pending to verified
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
            elif role == "DOCTOR":
                from app.models.doctor_profile import DoctorProfile
                session.add(DoctorProfile(user_id=user.id, pmdc_number=pending.pmdc_number, specialty="Neurology", is_pmdc_verified=True))
            elif role == "CARETAKER":
                from app.models.caretaker_profile import CaretakerProfile
                session.add(CaretakerProfile(user_id=user.id))

            await session.delete(pending)
            await session.commit()
            user_id = user.id
        else:
            user = (await session.execute(select(User).where(User.email == email))).scalar_one()
            user.is_email_verified = True
            await session.commit()
            user_id = user.id

    # 3. Login
    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


# ── 1. SOS Status Semantics & Integrity Tests ──────────────────────────────

@pytest.mark.asyncio
async def test_sos_providers_unconfigured_return_not_configured():
    """Verify that unconfigured/uninitialized providers return NOT_CONFIGURED instead of fake SENT."""
    event = SosEvent(id=999, user_id=1, status="SENDING")
    contact = EmergencyContact(id=1, user_id=1, name="Alice", phone_number="+1234567890")
    caretaker = User(id=2, full_name="Bob Care", email="bob@test.com", phone_number="+1987654321")

    # 1. WhatsApp with missing credentials & email fallback failure
    with patch.object(settings, "WHATSAPP_TOKEN", None), patch.object(settings, "WHATSAPP_PHONE_ID", None), patch("app.services.sos_provider.send_email", side_effect=Exception("Email unconfigured")):
        wa = WhatsAppSOSProvider()
        wa_res = await wa.send_sos_extended([contact], [caretaker], event, "Patient")
        assert wa_res.get(f"contact_{contact.id}") == DeliveryStatus.NOT_CONFIGURED
        assert wa_res.get(f"caretaker_{caretaker.id}") == DeliveryStatus.NOT_CONFIGURED

    # 2. Twilio with missing credentials & email fallback failure
    with patch.object(settings, "TWILIO_ACCOUNT_SID", None), patch.object(settings, "TWILIO_AUTH_TOKEN", None), patch("app.services.sos_provider.send_email", side_effect=Exception("Email unconfigured")):
        tw = TwilioSOSProvider()
        tw_res = await tw.send_sos_extended([contact], [caretaker], event, "Patient")
        assert tw_res.get(f"contact_{contact.id}") == DeliveryStatus.NOT_CONFIGURED
        assert tw_res.get(f"caretaker_{caretaker.id}") == DeliveryStatus.NOT_CONFIGURED

    # 3. Firebase with uninitialized SDK & email fallback failure
    with patch("app.services.sos_provider.ensure_firebase_initialized", return_value=False), patch("app.services.sos_provider.send_email", side_effect=Exception("Email unconfigured")):
        fb = FirebaseSOSProvider()
        fb_res = await fb.send_sos_extended([contact], [caretaker], event, "Patient")
        assert fb_res.get(f"caretaker_{caretaker.id}") == DeliveryStatus.NOT_CONFIGURED


# ── 2. FCM Diagnostics Sanitization Tests ─────────────────────────────────

@pytest.mark.asyncio
async def test_fcm_diagnostic_sanitization(client: TestClient):
    """Verify FCM diagnostics does NOT expose caretaker emails, token fragments, or credential paths."""
    headers, _ = await _create_user(client, role="PATIENT", prefix="fcm")

    response = client.get("/api/v1/emergency/fcm-diagnostic", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "firebase_credentials_path" not in data
    assert "sos_provider" not in data
    assert "push_ready" in data
    assert "firebase_admin_initialized" in data

    for ct in data.get("connected_caretakers", []):
        assert "email" not in ct
        assert "fcm_token_preview" not in ct
        assert "fcm_token" not in ct
        assert "has_fcm_token" in ct
        assert "name" in ct


# ── 3. OTP Attempt Lockout Tests ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_pending_registration_otp_lockout():
    """Verify that 5 failed OTP attempts lock out and invalidate the verification."""
    async with TestSessionLocal() as db:
        test_email = f"lockout_{uuid.uuid4().hex[:8]}@test.com"
        pending = PendingRegistration(
            email=test_email,
            password_hash=hash_password("Password123!"),
            full_name="Lockout User",
            role=UserRole.PATIENT,
            otp_secret_hash=hash_password("123456"),
            otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            otp_attempts=0,
        )
        db.add(pending)
        await db.commit()

        # 4 wrong attempts
        for _ in range(4):
            valid = await verify_registration_otp(db, test_email, "999999")
            assert valid is False

        # Check attempts count in DB
        res = await db.execute(select(PendingRegistration).where(PendingRegistration.email == test_email))
        p = res.scalar_one()
        assert p.otp_attempts == 4

        # 5th wrong attempt -> should trigger lockout
        valid = await verify_registration_otp(db, test_email, "999999")
        assert valid is False

        # Even if correct OTP is provided now, it must fail because attempts >= 5
        valid = await verify_registration_otp(db, test_email, "123456")
        assert valid is False

        # Clean up
        await db.delete(p)
        await db.commit()


@pytest.mark.asyncio
async def test_password_reset_otp_lockout():
    """Verify that password reset OTP verification locks out after 5 failed attempts."""
    async with TestSessionLocal() as db:
        test_email = f"reset_lockout_{uuid.uuid4().hex[:8]}@test.com"
        user = User(
            email=test_email,
            password_hash=hash_password("OldPassword123!"),
            full_name="Reset User",
            role=UserRole.PATIENT,
            is_active=True,
            is_email_verified=True,
            otp_secret_hash=hash_password("654321"),
            otp_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            otp_attempts=0,
        )
        db.add(user)
        await db.commit()

        # 5 wrong attempts on check_reset_otp
        for _ in range(5):
            valid = await check_reset_otp(db, user, "000000")
            assert valid is False

        # Now check with correct OTP -> must fail due to lockout
        valid = await check_reset_otp(db, user, "654321")
        assert valid is False

        # Reset password with correct OTP must also fail due to lockout
        reset_success = await reset_user_password(db, user, "654321", "NewPassword123!")
        assert reset_success is False

        # Clean up
        await db.delete(user)
        await db.commit()


# ── 4. Plaintext OTP Logging Elimination Test ─────────────────────────────

@pytest.mark.asyncio
async def test_email_fallback_does_not_log_plaintext_otp(caplog):
    """Verify that send_verification_email never prints plaintext OTP to log records."""
    caplog.set_level(logging.WARNING)
    secret_otp = "948271"
    target_email = "testuser@example.com"

    with patch.object(settings, "MAIL_USERNAME", None), patch.object(settings, "MAIL_PASSWORD", None):
        await send_verification_email(target_email, secret_otp, "Test User")

    # Check all captured log records
    for record in caplog.records:
        assert secret_otp not in record.message, f"Plaintext OTP leaked in log: {record.message}"


# ── 5. RAG Upload Authorization Test ──────────────────────────────────────

@pytest.mark.asyncio
async def test_rag_upload_requires_admin(client: TestClient):
    """Verify that patient role receives 403 on RAG document upload, while ADMIN is allowed."""
    patient_headers, _ = await _create_user(client, role="PATIENT", prefix="ragpt")

    file_data = io.BytesIO(b"%PDF-1.4 test document content")
    response = client.post(
        "/api/v1/rag/upload-document",
        files={"file": ("medical_guide.pdf", file_data, "application/pdf")},
        headers=patient_headers,
    )
    # Patient role MUST receive 403 Forbidden
    assert response.status_code == 403

    # Admin role is allowed
    admin_email = f"admin_{uuid.uuid4().hex[:6]}@example.com"
    async with TestSessionLocal() as session:
        admin_user = User(
            email=admin_email,
            password_hash=hash_password("Password123!"),
            phone_number=f"+923{str(uuid.uuid4().int)[:9]}",
            full_name="Admin Security User",
            role=UserRole.ADMIN,
            is_active=True,
            is_email_verified=True,
            is_phone_verified=False,
            otp_attempts=0,
        )
        session.add(admin_user)
        await session.commit()

    login_res = client.post("/api/v1/auth/login", json={"email": admin_email, "password": "Password123!"})
    assert login_res.status_code == 200, login_res.text
    admin_token = login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_file = io.BytesIO(b"%PDF-1.4 test document content for admin")
    admin_response = client.post(
        "/api/v1/rag/upload-document",
        files={"file": ("admin_guide.pdf", admin_file, "application/pdf")},
        headers=admin_headers,
    )
    assert admin_response.status_code == 200


# ── 6. Medication Prescriber Forgery Prevention Test ───────────────────────

@pytest.mark.asyncio
async def test_non_doctor_cannot_forge_prescriber_id(client: TestClient):
    """Verify that non-doctors cannot supply prescribed_by_doctor_id."""
    _, pt_id = await _create_user(client, role="PATIENT", prefix="forgept")
    ct_headers, ct_id = await _create_user(client, role="CARETAKER", prefix="forgect")

    # Link patient and caretaker in DB with active relationship
    async with TestSessionLocal() as session:
        from app.models.networks import PatientCaretakerNetwork
        from app.models.caretaker_profile import CaretakerProfile
        from app.models.patient_profile import PatientProfile
        from app.models.enums import ConnectionStatus

        pt_prof = (await session.execute(select(PatientProfile).where(PatientProfile.user_id == pt_id))).scalar_one()
        ct_prof = (await session.execute(select(CaretakerProfile).where(CaretakerProfile.user_id == ct_id))).scalar_one()

        net = PatientCaretakerNetwork(
            patient_id=pt_prof.id,
            caretaker_id=ct_prof.id,
            relationship_status=ConnectionStatus.ACTIVE,
            can_proxy=True,
        )
        session.add(net)
        await session.commit()

    payload = {
        "name": "Levetiracetam",
        "dosage": "500mg",
        "frequency": "BID",
        "start_date": "2026-08-21",
        "is_active": True,
        "prescribed_by_doctor_id": 999,  # Attempting to attribute to an arbitrary doctor
    }

    response = client.post(f"/api/v1/medications?patient_user_id={pt_id}", json=payload, headers=ct_headers)
    assert response.status_code == 403
    assert "Only a verified doctor may assign a prescriber" in response.text
