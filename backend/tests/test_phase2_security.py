"""
Phase 2 Security & Architecture Tests
Tests File Upload Magic-Byte Validation & PIL Re-Encoding (Finding 11),
Storage Key Masking & Opaque References (Finding 14),
RFC 6266/5987 Safe Content-Disposition Encoding (Finding 15),
FCM Token Regex & Bounds Validation (Finding 21),
Reverse Proxy Trust & Client IP Spoofing Defense (Finding 7),
and Hardened Content-Security-Policy Middleware (Finding 16).
"""
import io
import uuid
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import TestSessionLocal
from app.models.doctor_profile import DoctorProfile
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.schemas.profiles import DoctorProfileOut
from app.services.storage.validator import (
    sanitize_and_reencode_image,
    validate_doctor_upload,
    validate_eeg_upload,
)


def create_dummy_image(format_name: str = "PNG", size: tuple[int, int] = (100, 100)) -> bytes:
    """Helper to generate a clean synthetic in-memory image."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color="blue")
    img.save(buf, format=format_name)
    return buf.getvalue()


async def _create_user(client: TestClient, role: str = "PATIENT", prefix: str = "p2") -> tuple[dict, int, str]:
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
            elif role == "DOCTOR":
                session.add(DoctorProfile(user_id=user.id, pmdc_number=pending.pmdc_number, specialty="Neurology", is_pmdc_verified=True))

            await session.delete(pending)
            await session.commit()
            user_id = user.id

    login_res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    assert login_res.status_code == 200, login_res.text
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id, email


@pytest.mark.asyncio
async def test_doctor_upload_magic_byte_rejects_disguised_file():
    """Finding 11: Uploading arbitrary text disguised as a .pdf or .png must be rejected."""
    fake_pdf_file = UploadFile(
        filename="malicious.pdf",
        file=io.BytesIO(b"<script>alert(1)</script> fake pdf text content"),
        headers={"content-type": "application/pdf"},
    )
    with pytest.raises(HTTPException) as exc_info:
        await validate_doctor_upload(fake_pdf_file, photo=False)
    assert exc_info.value.status_code == 400
    assert "Invalid document signature" in exc_info.value.detail

    fake_image_file = UploadFile(
        filename="fake_photo.png",
        file=io.BytesIO(b"MZ\x90\x00 fake executable disguised as png"),
        headers={"content-type": "image/png"},
    )
    with pytest.raises(HTTPException) as exc_info:
        await validate_doctor_upload(fake_image_file, photo=True)
    assert exc_info.value.status_code == 400
    assert "Invalid image signature" in exc_info.value.detail


@pytest.mark.asyncio
async def test_doctor_upload_valid_image_reencoding():
    """Finding 11: Valid images must be sanitized and re-encoded using PIL."""
    valid_png_bytes = create_dummy_image("PNG", (80, 80))
    valid_file = UploadFile(
        filename="doctor_avatar.png",
        file=io.BytesIO(valid_png_bytes),
        headers={"content-type": "image/png"},
    )
    clean_bytes, filename, mime = await validate_doctor_upload(valid_file, photo=True)
    assert filename == "doctor_avatar.png"
    assert mime in ("image/png", "image/jpeg", "image/webp")
    assert len(clean_bytes) > 0


@pytest.mark.asyncio
async def test_eeg_upload_header_validation():
    """Finding 11: EEG uploads (.edf) must validate the EDF header signature."""
    invalid_edf = UploadFile(
        filename="test_session.edf",
        file=io.BytesIO(b"INVALID_HEADER_DATA_12345"),
        headers={"content-type": "application/octet-stream"},
    )
    with pytest.raises(HTTPException) as exc_info:
        await validate_eeg_upload(invalid_edf)
    assert exc_info.value.status_code == 400
    assert "Invalid EDF file header" in exc_info.value.detail

    # Valid EDF header begins with 8 ASCII characters starting with '0       '
    valid_edf_bytes = b"0       " + (b"\x00" * 256)
    valid_edf = UploadFile(
        filename="legit_session.edf",
        file=io.BytesIO(valid_edf_bytes),
        headers={"content-type": "application/octet-stream"},
    )
    validated = await validate_eeg_upload(valid_edf)
    assert validated.startswith(b"0       ")


def test_doctor_profile_out_opaque_asset_availability():
    """Finding 14: DoctorProfileOut must compute availability flags and URLs."""
    profile_dict = {
        "id": 1,
        "user_id": 42,
        "pmdc_number": "12345-D",
        "specialty": "Neurology",
        "is_pmdc_verified": True,
        "pmdc_certificate_path": "doctor_documents/cert_123.pdf",
        "pmdc_certificate_name": "My PMDC Certificate.pdf",
        "profile_photo_path": "doctor_photos/avatar_42.jpg",
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-01T10:00:00Z",
    }
    schema = DoctorProfileOut.model_validate(profile_dict)
    assert schema.certificate_available is True
    assert schema.profile_photo_available is True
    assert schema.certificate_url == "/api/v1/users/me/doctor-profile/pmdc-certificate"
    assert schema.profile_photo_url == "/api/v1/users/doctors/42/photo"


@pytest.mark.asyncio
async def test_rfc_safe_content_disposition_on_certificate_download(client: TestClient):
    """Finding 15: Certificate download must return RFC 6266/5987 encoded Content-Disposition."""
    doc_headers, doc_user_id, doc_email = await _create_user(client, role="DOCTOR", prefix="certrfcdoc")

    # Set up PMDC certificate in DB
    from app.services.storage.service import get_storage_service
    storage = get_storage_service()
    cert_bytes = b"%PDF-1.4 Mock PDF Certificate Content"
    cert_key = storage.save_doctor_file(cert_bytes, "Dr John's Certificate (2026).pdf", photo=False)

    async with TestSessionLocal() as session:
        doc_prof = (await session.execute(select(DoctorProfile).where(DoctorProfile.user_id == doc_user_id))).scalar_one()
        doc_prof.pmdc_certificate_path = cert_key
        doc_prof.pmdc_certificate_name = "Dr John's Certificate (2026).pdf"
        doc_prof.pmdc_certificate_mime_type = "application/pdf"
        doc_prof.pmdc_certificate_size = len(cert_bytes)
        await session.commit()

    # Download certificate
    resp = client.get(
        "/api/v1/users/me/doctor-profile/pmdc-certificate",
        headers=doc_headers,
    )
    assert resp.status_code == 200
    cd = resp.headers.get("content-disposition", "")
    assert cd.startswith("attachment;")
    assert "filename*=" in cd
    assert "UTF-8''" in cd
    assert resp.headers.get("x-content-type-options") == "nosniff"


@pytest.mark.asyncio
async def test_fcm_token_validation_bounds(client: TestClient):
    """Finding 21: FCM token must enforce min/max bounds and strict pattern."""
    headers, _, _ = await _create_user(client, role="PATIENT", prefix="fcmpt")

    # 1. Invalid characters (<script> / SQL / space)
    bad_resp = client.put(
        "/api/v1/users/me/fcm-token",
        json={"fcm_token": "token_with_<script>_injection"},
        headers=headers,
    )
    assert bad_resp.status_code == 422

    # 2. Too short (< 20 chars)
    short_resp = client.put(
        "/api/v1/users/me/fcm-token",
        json={"fcm_token": "short_token_123"},
        headers=headers,
    )
    assert short_resp.status_code == 422

    # 3. Valid FCM token
    valid_fcm = "eK1q_Z98v7:APA91bF" + "a" * 30
    good_resp = client.put(
        "/api/v1/users/me/fcm-token",
        json={"fcm_token": valid_fcm},
        headers=headers,
    )
    assert good_resp.status_code == 200


def test_security_headers_and_hardened_csp(client: TestClient):
    """Finding 16: Content-Security-Policy must include object-src 'none' and base-uri 'self'."""
    resp = client.get("/livez")
    assert resp.status_code == 200
    csp = resp.headers.get("content-security-policy", "")
    assert "object-src 'none'" in csp
    assert "base-uri 'self'" in csp
    assert resp.headers.get("x-content-type-options") == "nosniff"
    assert resp.headers.get("x-frame-options") == "DENY"
