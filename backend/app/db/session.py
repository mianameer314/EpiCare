"""
Database engine, async session factory, and declarative Base.

Sessions are created exclusively through the async_sessionmaker and are
managed by FastAPI dependencies (see app/api/deps.py) which guarantee
close + rollback on failure.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
    echo=False,
)

# Separate engine for tests (Docker-managed Postgres) — NullPool keeps
# transactional test isolation clean by never reusing stale connections.
test_engine = create_async_engine(
    settings.TEST_DATABASE_URL,
    pool_pre_ping=True,
    poolclass=NullPool,
    echo=False,
)

SessionLocal = async_sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
TestSessionLocal = async_sessionmaker(bind=test_engine, autoflush=False, autocommit=False, expire_on_commit=False)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency: yields an AsyncSession and guarantees cleanup.

    Rolls back any uncommitted transaction before closing so a failed
    request never leaks partial writes into the next request.
    """
    session = SessionLocal()
    try:
        yield session
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_test_db() -> AsyncGenerator[AsyncSession, None]:
    """Test-only dependency using the dedicated test database."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        await session.rollback()
        await session.close()
