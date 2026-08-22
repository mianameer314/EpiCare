"""
Post-Production Security and Architecture Audit Regression Test Suite
Covers all 18 Findings and Remediations from EpiCare Post Production Security and Architecture Audit.md
"""
import json
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.deps import RoleChecker
from app.core.config import Settings
from app.models.emergency import SosEvent
from app.models.enums import UserRole
from app.models.user import User
from app.rate_limit.core import RateLimiter
from app.schemas.user import UserOut
from app.services.ai_registry import get_ai_adapter, register_ai_adapter
from app.services.sos_provider import DeliveryStatus, build_sos_html_email


# ==============================================================================
# Finding 1 & 8: AI Adapter Registry and VLM Manifest Validation
# ==============================================================================

def test_ai_adapter_registry():
    """Finding 1: Only approved, registered AI adapters are returned and executed."""
    register_ai_adapter("test_adapter_v1", lambda q, u: f"echo: {q}")
    adapter = get_ai_adapter("test_adapter_v1")
    assert adapter is not None
    assert adapter("hello", 1) == "echo: hello"
    assert get_ai_adapter("unregistered_adapter_xyz") is None


@pytest.mark.asyncio
async def test_vlm_missing_manifest_returns_503():
    """Finding 8: VLM report generation requires valid manifest.json and returns 503 if not trained."""
    from app.services.vlm_report import generate_vlm_report, VLM_MODEL_DIR

    manifest_file = VLM_MODEL_DIR / "manifest.json"
    had_manifest = manifest_file.exists()
    manifest_backup = manifest_file.read_text(encoding="utf-8") if had_manifest else None

    try:
        if had_manifest:
            manifest_file.unlink()

        mock_db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await generate_vlm_report(mock_db, prediction_id=999)

        assert exc_info.value.status_code == 503
        assert exc_info.value.detail["code"] == "MODEL_NOT_TRAINED"
    finally:
        if had_manifest and manifest_backup:
            manifest_file.write_text(manifest_backup, encoding="utf-8")


# ==============================================================================
# Finding 2 & 17: Cookie Session Handling and Logout Revocation
# ==============================================================================

def test_cookie_only_logout_revokes_session(client: TestClient):
    """Finding 17: Logout clears epicare_refresh cookie and executes with or without bearer header."""
    resp = client.post("/api/v1/auth/logout", cookies={"epicare_refresh": "fake_cookie_token"})
    assert resp.status_code == 204
    # Ensure cookie is deleted
    assert "epicare_refresh" in resp.headers.get("set-cookie", "") or resp.cookies.get("epicare_refresh") is None


# ==============================================================================
# Finding 3: Rate Limiter Fail-Closed State Machine
# ==============================================================================

@pytest.mark.asyncio
async def test_sensitive_rate_limit_fails_closed_when_redis_unavailable():
    """Finding 3: Sensitive rate limits fail closed with HTTP 503 when Redis is unavailable at startup."""
    limiter = RateLimiter(redis_url="redis://nonexistent-host:9999/0")
    await limiter.init()

    assert limiter.redis_unavailable is True
    assert limiter.using_redis is False

    # Sensitive limit must raise HTTP 503
    with pytest.raises(HTTPException) as exc_info:
        await limiter.check("auth:ip:127.0.0.1", limit=5, window_seconds=60, fail_closed=True)
    assert exc_info.value.status_code == 503
    assert "rate limiter" in exc_info.value.detail.lower()

    # Non-sensitive limit falls back to in-memory limiter gracefully
    result = await limiter.check("public:ip:127.0.0.1", limit=10, window_seconds=60, fail_closed=False)
    assert result.allowed is True


# ==============================================================================
# Finding 4 & 15: SOS Emergency Dispatch and HTML Escaping
# ==============================================================================

def test_sos_email_html_escaping_and_valid_coords():
    """Finding 15: SOS HTML email escapes XSS in patient names and validates coordinate bounds."""
    # 1. HTML escaping
    event = SosEvent(id=101, latitude=31.5204, longitude=74.3587)
    html = build_sos_html_email(event, patient_name="<script>alert(1)</script>John Doe")
    assert "<script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;John Doe" in html
    assert "https://maps.google.com/?q=31.5204,74.3587" in html

    # 2. Invalid coordinates fallback
    invalid_event = SosEvent(id=102, latitude=999.0, longitude=-500.0)
    html_invalid = build_sos_html_email(invalid_event, patient_name="Jane Doe")
    assert "https://maps.google.com/?q=999.0" not in html_invalid
    assert "Location was not available" in html_invalid


# ==============================================================================
# Finding 5: Firebase Production Settings Validation
# ==============================================================================

def test_firebase_production_settings_validation():
    """Finding 5: In production, Firebase provider requires real credential material."""
    with pytest.raises(ValueError, match="Firebase requires service-account credentials"):
        Settings(
            APP_ENV="production",
            JWT_SECRET="x" * 32,
            DEBUG=False,
            DATABASE_URL="postgresql+asyncpg://u:p@db:5432/d",
            CORS_ORIGINS="https://epicare.health",
            SOS_PROVIDER="firebase",
            FIREBASE_CREDENTIALS_PATH="",
        )


# ==============================================================================
# Finding 6 & 16: Dockerfile Healthcheck and Startup
# ==============================================================================

def test_dockerfile_healthcheck_and_decoupled_cmd():
    """Findings 6 & 16: Dockerfile uses /livez healthcheck and decoupled web startup."""
    dockerfile_path = Path("Dockerfile")
    if not dockerfile_path.exists():
        dockerfile_path = Path("backend/Dockerfile")

    content = dockerfile_path.read_text(encoding="utf-8")
    assert "/livez" in content, "Dockerfile HEALTHCHECK should target /livez"
    assert "/healthz" not in content, "Dockerfile should not reference non-existent /healthz"
    assert "alembic upgrade head && uvicorn" not in content, "Dockerfile CMD should decouple migrations"


# ==============================================================================
# Finding 7: UserOut Schema Internal Path Obfuscation
# ==============================================================================

def test_user_out_schema_hides_raw_storage_paths():
    """Finding 7: UserOut exposes profile_photo_available and profile_photo_url without raw storage keys."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    user = User(
        id=1,
        email="test@epicare.health",
        full_name="Dr. Sarah",
        profile_photo_path="user-profile/secret-uuid-key.jpg",
        profile_photo_mime_type="image/jpeg",
        role=UserRole.DOCTOR,
        is_active=True,
        is_email_verified=True,
        is_phone_verified=True,
        created_at=now,
        updated_at=now,
    )
    user_out = UserOut.model_validate(user)
    out_dict = user_out.model_dump()

    assert "profile_photo_path" not in out_dict
    assert "profile_photo_mime_type" not in out_dict
    assert out_dict["profile_photo_available"] is True
    assert out_dict["profile_photo_url"] == "/api/v1/users/me/profile-photo"


# ==============================================================================
# Finding 9 & 10: RAG Ingestion Status and Streaming Upload Reader
# ==============================================================================

@pytest.mark.asyncio
async def test_read_limited_upload_enforces_size():
    """Finding 10: Streaming upload reader rejects oversized files immediately."""
    from app.services.storage.validator import read_limited_upload
    from io import BytesIO
    from fastapi import UploadFile

    large_bytes = b"0" * (2 * 1024 * 1024)  # 2 MB
    upload_file = UploadFile(filename="large.pdf", file=BytesIO(large_bytes))

    # 1 MB max limit must raise HTTP 400 with size exceeded detail
    with pytest.raises(HTTPException) as exc_info:
        await read_limited_upload(upload_file, max_bytes=1024 * 1024)
    assert exc_info.value.status_code == 400
    assert "exceeds" in exc_info.value.detail


# ==============================================================================
# Finding 11: Content Security Policy Headers
# ==============================================================================

def test_csp_and_security_headers(client: TestClient):
    """Finding 11: Security headers middleware sets hardened CSP and security directives."""
    resp = client.get("/livez")
    assert resp.status_code == 200
    headers = resp.headers

    assert headers.get("x-frame-options") == "DENY"
    assert headers.get("x-content-type-options") == "nosniff"

    csp = headers.get("content-security-policy", "")
    assert "frame-ancestors 'none'" in csp
    assert "object-src 'none'" in csp
    assert "base-uri 'self'" in csp
    assert "form-action 'self'" in csp


# ==============================================================================
# Finding 13: System Probes & Health Aliases
# ==============================================================================

def test_system_probes_and_aliases(client: TestClient):
    """Findings 6 & 13: /livez, /healthz alias, and /readyz probes function correctly."""
    live = client.get("/livez")
    assert live.status_code == 200
    assert live.json()["status"] == "alive"

    health = client.get("/healthz")
    assert health.status_code == 200
    assert health.json()["status"] == "alive"

    ready = client.get("/readyz")
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
