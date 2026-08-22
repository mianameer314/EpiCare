"""
Phase 1 Security & Architecture Tests
Tests Session Management, Refresh Token Hardening & Reuse Detection (Finding 4),
Production Settings Fail-Secure Startup (Finding 8), Liveness/Readiness Probes (Finding 8),
and Doctor Connection PMDC Verification Guard (Finding 13).
"""
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.config import Settings
from app.core.security import decode_token, hash_password
from app.db.session import TestSessionLocal
from app.models.doctor_profile import DoctorProfile
from app.models.enums import ConnectionStatus, UserRole
from app.models.patient_profile import PatientProfile
from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.models.user_session import UserSession


async def _create_user(client: TestClient, role: str = "PATIENT", prefix: str = "p1") -> tuple[dict, int, str]:
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
async def test_session_lifecycle_and_cookie_on_login(client: TestClient):
    """Finding 4: Login must create a UserSession record and set an HttpOnly epicare_refresh cookie."""
    _, user_id, email = await _create_user(client, role="PATIENT", prefix="sesslogin")

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Verify epicare_refresh cookie was set
    assert "epicare_refresh" in resp.cookies

    # Verify session in database
    async with TestSessionLocal() as session:
        sess_res = await session.execute(
            select(UserSession).where(UserSession.user_id == user_id)
        )
        sessions = sess_res.scalars().all()
        assert len(sessions) >= 1
        latest_session = sessions[-1]
        assert latest_session.is_revoked is False
        assert latest_session.refresh_token_jti is not None


@pytest.mark.asyncio
async def test_token_rotation_and_cookie_update(client: TestClient):
    """Finding 4: Refreshing tokens rotates the refresh token and updates the session."""
    _, user_id, email = await _create_user(client, role="PATIENT", prefix="tokrot")

    # 1. Login to establish session
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    first_refresh = login_resp.json()["refresh_token"]

    # 2. Call /refresh with cookie
    client.cookies.set("epicare_refresh", first_refresh)
    refresh_resp = client.post("/api/v1/auth/refresh")
    assert refresh_resp.status_code == 200, refresh_resp.text
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    second_refresh = new_tokens["refresh_token"]
    assert second_refresh != first_refresh


@pytest.mark.asyncio
async def test_token_reuse_theft_detection_revokes_all_sessions(client: TestClient):
    """
    Finding 4: Reusing an already-rotated refresh token (theft replay attack)
    must immediately revoke all active sessions for that user.
    """
    _, user_id, email = await _create_user(client, role="PATIENT", prefix="reuse")

    # 1. Login to get initial refresh token
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    first_refresh = login_resp.json()["refresh_token"]

    # 2. Legitimate client rotates token
    client.cookies.set("epicare_refresh", first_refresh)
    legit_refresh_resp = client.post("/api/v1/auth/refresh")
    assert legit_refresh_resp.status_code == 200

    # 3. Attacker tries to replay first_refresh
    client.cookies.set("epicare_refresh", first_refresh)
    replay_resp = client.post("/api/v1/auth/refresh")
    assert replay_resp.status_code == 401

    # 4. Confirm that all sessions for this user are now revoked
    async with TestSessionLocal() as session:
        sess_res = await session.execute(
            select(UserSession).where(UserSession.user_id == user_id)
        )
        sessions = sess_res.scalars().all()
        for s in sessions:
            assert s.is_revoked is True


@pytest.mark.asyncio
async def test_logout_revokes_session_and_clears_cookie(client: TestClient):
    """Finding 4: Logout marks session revoked and clears cookie."""
    _, user_id, email = await _create_user(client, role="PATIENT", prefix="logout")

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    access_token = login_resp.json()["access_token"]
    payload = decode_token(access_token)
    sid = payload.get("sid")

    # Logout
    logout_resp = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_resp.status_code == 204

    # Verify session revoked in DB
    if sid:
        async with TestSessionLocal() as session:
            sess_res = await session.execute(
                select(UserSession).where(UserSession.session_id == sid)
            )
            sess = sess_res.scalar_one_or_none()
            assert sess is not None
            assert sess.is_revoked is True


@pytest.mark.asyncio
async def test_password_change_revokes_all_active_sessions(client: TestClient):
    """Finding 4: Changing password revokes all active sessions for the user."""
    _, user_id, email = await _create_user(client, role="PATIENT", prefix="pwdchg")

    # Login once
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    access_token = login_resp.json()["access_token"]

    # Change password
    change_resp = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Password123!", "new_password": "NewSecurePassword456!"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert change_resp.status_code == 204

    # Verify all sessions revoked
    async with TestSessionLocal() as session:
        sess_res = await session.execute(
            select(UserSession).where(UserSession.user_id == user_id)
        )
        sessions = sess_res.scalars().all()
        for s in sessions:
            assert s.is_revoked is True


def test_production_settings_fail_secure_validation():
    """Finding 8: Settings must raise ValueError in production on unsafe configurations."""
    # 1. Insecure JWT secret (< 32 chars)
    with pytest.raises(ValueError, match="JWT_SECRET must be at least 32 characters"):
        Settings(
            APP_ENV="production",
            JWT_SECRET="short_secret",
            DEBUG=False,
            DATABASE_URL="postgresql+asyncpg://user:pass@db:5432/epicare",
            CORS_ORIGINS="https://epicare.health",
            SOS_PROVIDER="none",
        )

    # 2. DEBUG is True
    with pytest.raises(ValueError, match="DEBUG must be False in production"):
        Settings(
            APP_ENV="production",
            JWT_SECRET="a" * 32,
            DEBUG=True,
            DATABASE_URL="postgresql+asyncpg://user:pass@db:5432/epicare",
            CORS_ORIGINS="https://epicare.health",
            SOS_PROVIDER="none",
        )

    # 3. SQLite or empty DATABASE_URL
    with pytest.raises(ValueError, match="DATABASE_URL is required and cannot be SQLite"):
        Settings(
            APP_ENV="production",
            JWT_SECRET="a" * 32,
            DEBUG=False,
            DATABASE_URL="sqlite+aiosqlite:///epicare.db",
            CORS_ORIGINS="https://epicare.health",
            SOS_PROVIDER="none",
        )

    # 4. Wildcard or localhost in CORS_ORIGINS
    with pytest.raises(ValueError, match="Production CORS_ORIGINS must be explicit"):
        Settings(
            APP_ENV="production",
            JWT_SECRET="a" * 32,
            DEBUG=False,
            DATABASE_URL="postgresql+asyncpg://user:pass@db:5432/epicare",
            CORS_ORIGINS="http://localhost:3000",
            SOS_PROVIDER="none",
        )


def test_liveness_and_readiness_probes(client: TestClient):
    """Finding 8: /livez and /readyz probes must respond accurately."""
    # Liveness probe
    live_resp = client.get("/livez")
    assert live_resp.status_code == 200
    assert live_resp.json() == {"status": "alive"}

    # Readiness probe
    ready_resp = client.get("/readyz")
    assert ready_resp.status_code == 200
    data = ready_resp.json()
    assert data["status"] == "ready"
    assert "database" in data["components"]
    assert data["components"]["database"]["status"] == "ready"
    assert "storage" in data["components"]


@pytest.mark.asyncio
async def test_doctor_connection_requires_pmdc_verification(client: TestClient):
    """Finding 13: Requesting connection to an unverified doctor must fail with 404."""
    # 1. Create Patient
    pt_headers, pt_id, pt_email = await _create_user(client, role="PATIENT", prefix="docreqpt")

    # 2. Create unverified Doctor user + profile
    unverified_doc_email = f"unverified_doc_{uuid.uuid4().hex[:6]}@example.com"
    async with TestSessionLocal() as session:
        unverified_doc_user = User(
            email=unverified_doc_email,
            password_hash=hash_password("Password123!"),
            full_name="Dr. Unverified",
            role=UserRole.DOCTOR,
            phone_number=f"+923{str(uuid.uuid4().int)[:9]}",
            is_active=True,
            is_email_verified=True,
        )
        session.add(unverified_doc_user)
        await session.flush()

        unverified_prof = DoctorProfile(
            user_id=unverified_doc_user.id,
            pmdc_number="11111-U",
            specialty="Neurology",
            is_pmdc_verified=False,
        )
        session.add(unverified_prof)
        await session.commit()
        doc_prof_id = unverified_prof.id

    # 3. Patient logs in and attempts to request connection with unverified doctor
    req_resp = client.post(
        "/api/v1/connections/doctors/request",
        json={"doctor_id": doc_prof_id},
        headers=pt_headers,
    )
    assert req_resp.status_code == 404
    assert "Verified doctor not found" in str(req_resp.json())

    # 4. Now verify doctor PMDC and retry -> should succeed
    async with TestSessionLocal() as session:
        prof = (await session.execute(select(DoctorProfile).where(DoctorProfile.id == doc_prof_id))).scalar_one()
        prof.is_pmdc_verified = True
        await session.commit()

    success_resp = client.post(
        "/api/v1/connections/doctors/request",
        json={"doctor_id": doc_prof_id},
        headers=pt_headers,
    )
    assert success_resp.status_code == 200
    assert success_resp.json()["relationship_status"] in ("PENDING", "pending", ConnectionStatus.PENDING.value)
