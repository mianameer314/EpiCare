"""
Shared pytest fixtures for the EpiCare backend.

Strategy (mirrors BRANDING-SYSTEM tests):
- A dedicated test database (settings.TEST_DATABASE_URL) is created/dropped
  per session via the async engine, and `get_db` is overridden with the
  test session factory so no production data is ever touched.
- Storage writes into a throwaway directory under the OS temp dir.
- The DB is only initialised for tests that request `db` / `client`;
  pure unit tests (channel mapper, validation, preprocessing) never touch it.
- Heavy EEG steps (process pool, ONNX inference) are mocked at the
  service boundary so tests stay fast, hermetic, and dependency-light.

Env vars MUST be set before `app.main` is imported (settings is instantiated
at import time).
"""
import os
import tempfile
from collections.abc import AsyncGenerator, Generator
from pathlib import Path

import pytest

# ---------- Test environment (before any app import) ----------
_TMP_ROOT = tempfile.mkdtemp(prefix="epicare_tests_")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("SCHEDULER_ENABLED", "false")
os.environ.setdefault("LOCAL_STORAGE_PATH", str(Path(_TMP_ROOT) / "storage"))
os.environ.setdefault(
    "DATABASE_URL", "postgresql+asyncpg://epicare:epicare@localhost:5432/epicare_test"
)
os.environ.setdefault(
    "TEST_DATABASE_URL", "postgresql+asyncpg://epicare:epicare@localhost:5432/epicare_test"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")

from fastapi.testclient import TestClient  # noqa: E402

from app.db.session import Base, TestSessionLocal, test_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.storage.service import StorageService, get_storage_service  # noqa: E402


# ---------- Database ----------
@pytest.fixture(scope="session")
async def _prepare_database() -> AsyncGenerator[None, None]:
    """Create all tables in the test DB before the session, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture
async def db(_prepare_database) -> AsyncGenerator:
    """Yield a fresh test session per test."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        await session.rollback()
        await session.close()


# ---------- Dependency overrides ----------
async def override_get_db() -> AsyncGenerator:
    """FastAPI override: use the test session factory."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        await session.rollback()
        await session.close()


class _LocalStorageService(StorageService):
    """StorageService bound to the throwaway test directory."""

    def __init__(self) -> None:
        from app.services.storage.local import LocalStorageProvider

        super().__init__(LocalStorageProvider())


_test_storage = _LocalStorageService()


def override_get_storage_service() -> StorageService:
    return _test_storage


@pytest.fixture(scope="session", autouse=True)
def _apply_overrides() -> Generator[None, None, None]:
    """Wire dependency overrides for the whole session (idempotent)."""
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_storage_service] = override_get_storage_service
    yield
    app.dependency_overrides.clear()


# ---------- HTTP client ----------
@pytest.fixture
def client(_prepare_database) -> Generator[TestClient, None, None]:
    """TestClient with DB + storage overrides applied (runs app lifespan)."""
    with TestClient(app) as test_client:
        yield test_client


# ---------- Auth helpers ----------
@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    """Register + login a throwaway user; return bearer auth headers."""

    def _register(email: str = "test@example.com") -> dict[str, str]:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "supersecret123",
                "full_name": "Test User",
            },
        )
        assert response.status_code == 201, response.text
        login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "supersecret123"},
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _register
