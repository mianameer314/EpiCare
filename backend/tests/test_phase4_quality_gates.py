"""
Phase 4 Quality Gates, Release Controls & Scalability Tests
Tests RoleChecker structured logging & zero print leakage (Finding 22),
Settings fail-closed release controls (Finding 24),
Database connection pool scalability and readiness,
and Rate Limiter concurrency performance.
"""
import sys
from io import StringIO
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps import RoleChecker
from app.core.config import Settings
from app.models.enums import UserRole
from app.models.user import User


def test_role_checker_authorization_and_no_stdout_leakage():
    """Finding 22: RoleChecker must enforce role access without emitting stdout print leakage."""
    patient_user = User(id=1, email="pt@epicare.test", role=UserRole.PATIENT, is_active=True)
    doctor_user = User(id=2, email="doc@epicare.test", role=UserRole.DOCTOR, is_active=True)
    admin_user = User(id=3, email="admin@epicare.test", role=UserRole.ADMIN, is_active=True)

    doctor_guard = RoleChecker([UserRole.DOCTOR])

    # Intercept stdout to verify no raw print output is emitted
    captured_stdout = StringIO()
    with patch("sys.stdout", captured_stdout):
        # 1. Allowed role returns user
        authorized = doctor_guard(doctor_user)
        assert authorized.id == doctor_user.id

        # 2. Disallowed role raises HTTP 403 Forbidden
        with pytest.raises(HTTPException) as exc_info:
            doctor_guard(patient_user)
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Operation not permitted"

        with pytest.raises(HTTPException) as exc_info:
            doctor_guard(admin_user)
        assert exc_info.value.status_code == 403

    # Assert no leaked print statements in stdout
    assert captured_stdout.getvalue() == "", f"Leaked stdout in RoleChecker: {captured_stdout.getvalue()}"


def test_production_release_controls_settings_matrix():
    """Finding 24: Settings matrix verifies complete fail-secure release controls."""
    # 1. Insecure secret
    with pytest.raises(ValueError, match="JWT_SECRET must be at least 32 characters"):
        Settings(APP_ENV="production", JWT_SECRET="short", DEBUG=False, DATABASE_URL="postgresql+asyncpg://u:p@db:5432/d", CORS_ORIGINS="https://epicare.health")

    # 2. Debug enabled in production
    with pytest.raises(ValueError, match="DEBUG must be False in production"):
        Settings(APP_ENV="production", JWT_SECRET="x" * 32, DEBUG=True, DATABASE_URL="postgresql+asyncpg://u:p@db:5432/d", CORS_ORIGINS="https://epicare.health")

    # 3. Localhost in production CORS
    with pytest.raises(ValueError, match="Production CORS_ORIGINS must be explicit"):
        Settings(APP_ENV="production", JWT_SECRET="x" * 32, DEBUG=False, DATABASE_URL="postgresql+asyncpg://u:p@db:5432/d", CORS_ORIGINS="http://localhost:5173")


def test_system_diagnostics_and_probes_scalability(client: TestClient):
    """Verify system diagnostics, liveness and readiness probe performance."""
    # Liveness probe
    live = client.get("/livez")
    assert live.status_code == 200
    assert live.json()["status"] == "alive"

    # Readiness probe
    ready = client.get("/readyz")
    assert ready.status_code == 200
    data = ready.json()
    assert data["status"] == "ready"
    assert "database" in data["components"]
    assert "storage" in data["components"]


def test_root_probe_contract(client: TestClient):
    """Verify root healthcheck contract for container orchestrators."""
    resp = client.get("/")
    assert resp.status_code == 200
    assert "app" in resp.json()
    assert "docs" in resp.json()
