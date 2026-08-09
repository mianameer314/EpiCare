"""
Shared pytest fixtures for the EpiCare backend.

Strategy (mirrors BRANDING-SYSTEM tests):
- A dedicated test database (settings.TEST_DATABASE_URL) is created/dropped
  per session via the async engine, and `get_db` is overridden with the
  test session factory so no production data is ever touched.
- Storage writes into a throwaway directory under the OS temp dir.
- App imports happen inside fixtures so pure unit tests (channel mapper,
  validation, preprocessing) never import FastAPI/SQLAlchemy.
- Heavy EEG steps (process pool, ONNX inference) are mocked at the
  service boundary so tests stay fast, hermetic, and dependency-light.

Env vars MUST be set before any app import (settings is instantiated at
import time).
"""
import os
import sys
import tempfile
from collections.abc import AsyncGenerator, Generator
from pathlib import Path

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

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


# ---------- Database ----------
@pytest.fixture(scope="session")
async def _prepare_database() -> AsyncGenerator[None, None]:
    """Create all tables in the test DB before the session, drop after."""
    from sqlalchemy import text

    import app.models  # noqa: F401  (register every table on Base.metadata)
    from app.db.session import Base, test_engine

    # pgvector may not be installed on the local server; the vector-dependent
    # tables are not needed by the current suite, so skip them when the
    # extension cannot be enabled.
    async with test_engine.begin() as conn:
        vector_available = True
        try:
            async with conn.begin_nested():
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        except Exception:
            vector_available = False

        tables = list(Base.metadata.sorted_tables)
        if not vector_available:
            tables = [t for t in tables if t.name != "rag_chunks"]

        await conn.run_sync(Base.metadata.create_all, tables)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all, tables)
    await test_engine.dispose()


@pytest.fixture
async def db(_prepare_database) -> AsyncGenerator:
    """Yield a fresh test session per test."""
    from app.db.session import TestSessionLocal

    session = TestSessionLocal()
    try:
        yield session
    finally:
        await session.rollback()
        await session.close()


# ---------- Dependency overrides ----------
@pytest.fixture(scope="session")
def _apply_overrides() -> Generator[None, None, None]:
    """Wire FastAPI dependency overrides for tests that use the HTTP client."""
    from app.api.deps import get_db
    from app.main import app
    from app.services.storage.service import StorageService, get_storage_service

    async def override_get_db() -> AsyncGenerator:
        from app.db.session import TestSessionLocal

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

    test_storage = _LocalStorageService()

    def override_get_storage_service() -> StorageService:
        return test_storage

    from app.rate_limit import REGISTER_LIMIT, LOGIN_LIMIT, REFRESH_LIMIT
    async def bypass_rate_limit():
        pass
        
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_storage_service] = override_get_storage_service
    app.dependency_overrides[REGISTER_LIMIT] = bypass_rate_limit
    app.dependency_overrides[LOGIN_LIMIT] = bypass_rate_limit
    app.dependency_overrides[REFRESH_LIMIT] = bypass_rate_limit
    
    yield
    app.dependency_overrides.clear()


# ---------- HTTP client ----------
@pytest.fixture
def client(_prepare_database, _apply_overrides) -> Generator:
    """TestClient with DB + storage overrides applied (runs app lifespan)."""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


# ---------- Auth helpers ----------
@pytest.fixture
def auth_headers(client) -> dict:
    """Register + login a throwaway user; return bearer auth headers."""

    def _register(email: str = "test@example.com") -> dict[str, str]:
        import asyncio
        from app.db.session import TestSessionLocal
        from app.models.user import User
        from sqlalchemy import select
        
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "supersecret123",
                "full_name": "Test User",
                "phone_number": "+923000000000",
                "role": "PATIENT"
            },
        )
        assert response.status_code == 201, response.text
        
        # Manually verify the user in DB
        async def verify_user():
            async with TestSessionLocal() as session:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one()
                user.is_email_verified = True
                await session.commit()
                
        asyncio.run(verify_user())
        
        login = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "supersecret123"},
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _register