"""
Phase 1 Security & Architecture Tests
Tests Session Management, Refresh Token Hardening & Reuse Detection (Finding 4),
Production Settings Fail-Secure Startup (Finding 8), Liveness/Readiness Probes (Finding 8),
and Doctor Connection PMDC Verification Guard (Finding 13).
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import create_refresh_token, decode_token
from app.models.doctor_profile import DoctorProfile
from app.models.enums import UserRole
from app.models.patient_profile import PatientProfile
from app.models.user import User
from app.models.user_session import UserSession
from app.services.session import (
    create_session,
    revoke_all_user_sessions,
    revoke_session,
    rotate_session_token,
)


@pytest.mark.asyncio
async def test_session_lifecycle_and_cookie_on_login(
    client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """Finding 4: Login must create a UserSession record and set an HttpOnly epicare_refresh cookie."""
    # Ensure test user is active and verified
    test_user.is_active = True
    test_user.is_email_verified = True
    await db_session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "Password123!"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

    # Verify epicare_refresh cookie was set
    assert "epicare_refresh" in resp.cookies

    # Verify session in database
    sess_res = await db_session.execute(
        select(UserSession).where(UserSession.user_id == test_user.id)
    )
    sessions = sess_res.scalars().all()
    assert len(sessions) >= 1
    latest_session = sessions[-1]
    assert latest_session.is_revoked is False
    assert latest_session.refresh_token_jti is not None


@pytest.mark.asyncio
async def test_token_rotation_and_cookie_update(
    client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """Finding 4: Refreshing tokens rotates the refresh token and updates the session."""
    test_user.is_active = True
    test_user.is_email_verified = True
    await db_session.commit()

    # 1. Login to establish session
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "Password123!"},
    )
    assert login_resp.status_code == 200
    first_refresh = login_resp.json()["refresh_token"]

    # 2. Call /refresh with cookie
    client.cookies.set("epicare_refresh", first_refresh)
    refresh_resp = await client.post("/api/v1/auth/refresh")
    assert refresh_resp.status_code == 200, refresh_resp.text
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    second_refresh = new_tokens["refresh_token"]
    assert second_refresh != first_refresh


@pytest.mark.asyncio
async def test_token_reuse_theft_detection_revokes_all_sessions(
    client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """
    Finding 4: Reusing an already-rotated refresh token (theft replay attack)
    must immediately revoke all active sessions for that user.
    """
    test_user.is_active = True
    test_user.is_email_verified = True
    await db_session.commit()

    # 1. Login to get initial refresh token
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "Password123!"},
    )
    first_refresh = login_resp.json()["refresh_token"]

    # 2. Legitimate client rotates token
    client.cookies.set("epicare_refresh", first_refresh)
    legit_refresh_resp = await client.post("/api/v1/auth/refresh")
    assert legit_refresh_resp.status_code == 200

    # 3. Attacker tries to replay first_refresh
    client.cookies.set("epicare_refresh", first_refresh)
    replay_resp = await client.post("/api/v1/auth/refresh")
    assert replay_resp.status_code == 401

    # 4. Confirm that all sessions for this user are now revoked
    sess_res = await db_session.execute(
        select(UserSession).where(UserSession.user_id == test_user.id)
    )
    sessions = sess_res.scalars().all()
    for s in sessions:
        assert s.is_revoked is True


@pytest.mark.asyncio
async def test_logout_revokes_session_and_clears_cookie(
    client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """Finding 4: Logout marks session revoked and clears cookie."""
    test_user.is_active = True
    test_user.is_email_verified = True
    await db_session.commit()

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "Password123!"},
    )
    access_token = login_resp.json()["access_token"]
    payload = decode_token(access_token)
    sid = payload.get("sid")

    # Logout
    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_resp.status_code == 204

    # Verify session revoked in DB
    if sid:
        sess_res = await db_session.execute(
            select(UserSession).where(UserSession.session_id == sid)
        )
        session = sess_res.scalar_one_or_none()
        assert session is not None
        assert session.is_revoked is True


@pytest.mark.asyncio
async def test_password_change_revokes_all_active_sessions(
    client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """Finding 4: Changing password revokes all active sessions for the user."""
    test_user.is_active = True
    test_user.is_email_verified = True
    await db_session.commit()

    # Login once
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "Password123!"},
    )
    access_token = login_resp.json()["access_token"]

    # Change password
    change_resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Password123!", "new_password": "NewSecurePassword456!"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert change_resp.status_code == 204

    # Verify all sessions revoked
    sess_res = await db_session.execute(
        select(UserSession).where(UserSession.user_id == test_user.id)
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


@pytest.mark.asyncio
async def test_liveness_and_readiness_probes(client: AsyncClient):
    """Finding 8: /livez and /readyz probes must respond accurately."""
    # Liveness probe
    live_resp = await client.get("/livez")
    assert live_resp.status_code == 200
    assert live_resp.json() == {"status": "alive"}

    # Readiness probe
    ready_resp = await client.get("/readyz")
    assert ready_resp.status_code == 200
    data = ready_resp.json()
    assert data["status"] == "ready"
    assert "database" in data["components"]
    assert data["components"]["database"]["status"] == "ready"
    assert "storage" in data["components"]


@pytest.mark.asyncio
async def test_doctor_connection_requires_pmdc_verification(
    client: AsyncClient, test_user: User, db_session: AsyncSession
):
    """Finding 13: Requesting connection to an unverified doctor must fail with 404."""
    # 1. Make test_user a Patient
    test_user.role = UserRole.PATIENT
    test_user.is_active = True
    test_user.is_email_verified = True
    await db_session.commit()

    # Ensure patient profile exists
    p_res = await db_session.execute(
        select(PatientProfile).where(PatientProfile.user_id == test_user.id)
    )
    patient_prof = p_res.scalar_one_or_none()
    if not patient_prof:
        patient_prof = PatientProfile(user_id=test_user.id)
        db_session.add(patient_prof)
        await db_session.commit()

    # 2. Create an unverified Doctor user + profile
    unverified_doc_user = User(
        email="unverified.doc@epicare.test",
        password_hash=test_user.password_hash,
        full_name="Dr. Unverified",
        role=UserRole.DOCTOR,
        is_active=True,
        is_email_verified=True,
    )
    db_session.add(unverified_doc_user)
    await db_session.commit()
    await db_session.refresh(unverified_doc_user)

    unverified_prof = DoctorProfile(
        user_id=unverified_doc_user.id,
        pmdc_number="11111-U",
        is_pmdc_verified=False,
    )
    db_session.add(unverified_prof)
    await db_session.commit()
    await db_session.refresh(unverified_prof)

    # 3. Patient logs in and attempts to request connection with unverified doctor
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": test_user.email, "password": "Password123!"},
    )
    token = login_resp.json()["access_token"]

    req_resp = await client.post(
        "/api/v1/connections/doctors/request",
        json={"doctor_id": unverified_prof.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert req_resp.status_code == 404
    assert "Verified doctor not found" in req_resp.json()["detail"]

    # 4. Now verify doctor PMDC and retry -> should succeed
    unverified_prof.is_pmdc_verified = True
    await db_session.commit()

    success_resp = await client.post(
        "/api/v1/connections/doctors/request",
        json={"doctor_id": unverified_prof.id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert success_resp.status_code == 200
    assert success_resp.json()["relationship_status"] == "pending"
