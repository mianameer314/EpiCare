"""
EpiCare FastAPI application — composition root.

Wires middleware, exception handlers, API routers, and the async lifespan
(rate limiter, cache, scheduler, model loader warm-up, vector index warm-up).
Startup is resilient: a missing model or unreachable Redis never blocks boot.
"""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    admin,
    auth,
    connections,
    eeg,
    system,
    users,
    emergency,
    medications,
    lifestyle,
    dashboard,
    seizures,
)
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.db.session import engine
from app.middleware.request_context import RequestContextMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.twilio import TwilioSignatureMiddleware
from app.ml.executor import shutdown_executor
from app.ml.model_loader import get_model_loader
from app.ml.vector_warmup import warm_up_vector_index
from app.rate_limit import close_rate_limiter, init_rate_limiter
from app.scheduler import get_scheduler

configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle — never raises on degraded dependencies."""
    # DB Connection and Superuser initialization
    try:
        # Simple query to check connection
        async with engine.begin() as conn:
            pass
        logger.info("Database connected successfully.")
        
        from app.db.init_db import init_superuser
        await init_superuser()
    except Exception as exc:
        logger.error(f"Database connection failed: {exc}")

    # Best-effort infra init (Redis fallbacks handled internally)
    try:
        await init_rate_limiter(settings.REDIS_URL)
        logger.info("Redis connected successfully.")
    except Exception as exc:
        logger.error(f"Redis connection failed: {exc}")

    # Model load is non-fatal: /system/model reports unavailable instead
    try:
        get_model_loader()
    except Exception as exc:
        logger.error("model_warmup_failed", extra={"error": str(exc)})

    # Scheduler start is best-effort too (jobstore may be unavailable)
    try:
        get_scheduler().start()
    except Exception as exc:
        logger.error("scheduler_start_failed", extra={"error": str(exc)})

    # pgvector warm-up (skips when rag_chunks is absent)
    try:
        await warm_up_vector_index(engine)
    except Exception as exc:
        logger.error("vector_warmup_failed", extra={"error": str(exc)})

    yield

    # Teardown with timeouts to prevent hanging on Ctrl+C (Windows / Uvicorn)
    try:
        await asyncio.wait_for(get_scheduler().shutdown(), timeout=2.0)
    except Exception as exc:
        logger.error("scheduler_shutdown_failed", extra={"error": str(exc)})
        
    try:
        await asyncio.wait_for(shutdown_executor(), timeout=2.0)
    except Exception as exc:
        logger.error("executor_shutdown_failed", extra={"error": str(exc)})
        
    try:
        await asyncio.wait_for(close_rate_limiter(), timeout=2.0)
    except Exception as exc:
        logger.error("rate_limiter_shutdown_failed", extra={"error": str(exc)})
        
    try:
        await asyncio.wait_for(engine.dispose(), timeout=3.0)
    except Exception as exc:
        logger.error("engine_dispose_failed", extra={"error": str(exc)})


openapi_tags = [
    {
        "name": "Authentication",
        "description": "Operations for user registration, login, and token management.",
    },
    {
        "name": "Admin",
        "description": "Administrative actions and secure system diagnostics.",
    },
    {
        "name": "Patient Dashboard",
        "description": "Aggregated analytics and AI-driven recommendations for patients.",
    },
    {
        "name": "Emergency SOS",
        "description": "Manage emergency contacts and trigger instant SOS alerts via multi-channel providers.",
    },
    {
        "name": "Manual Seizure Logs",
        "description": "Log seizures manually if they occur while not wearing an EEG device.",
    },
    {
        "name": "Medications",
        "description": "Prescription logging, scheduling, and adherence tracking.",
    },
    {
        "name": "Lifestyle & Diary",
        "description": "Log daily sleep, triggers, and stress levels for personalized AI insights.",
    },
    {
        "name": "EEG Analysis",
        "description": "Endpoints for EEG file upload, session lifecycle tracking, and AI-driven seizure analysis.",
    },
    {
        "name": "Patient Management",
        "description": "Operations for managing patient profiles.",
    },
    {
        "name": "Doctor Management",
        "description": "Operations for managing doctor profiles and PMDC verification.",
    },
    {
        "name": "Caretaker Management",
        "description": "Operations for managing caretaker profiles.",
    },
    {
        "name": "Connections",
        "description": "Manage relationships and connection requests between patients, doctors, and caretakers.",
    },
    {
        "name": "System Health & Status",
        "description": "Public system status and health checks.",
    },
]

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="""
**EpiCare AI** is a robust and comprehensive platform designed to manage and analyze epilepsy-related data, facilitating seamless interactions between patients, doctors, and caretakers.

### Core Features
- **Admin Dashboard**: Comprehensive system metrics and doctor PMDC verification tools.
- **User Management**: Unified profiles tailored for Patients, Doctors, and Caretakers.
- **Role-Based Authentication**: Secure access control with PMDC verification for doctors.
- **Connection System**: Connect patients with verified medical professionals and trusted caretakers.
- **AI-Driven EEG Analysis**: Upload EEG sessions, process signals, and receive detailed AI-generated seizure prediction reports.
- **Personalized Dashboard**: Get real-time heuristic recommendations based on daily habits.
- **Lifestyle & Medication Tracking**: Log sleep, stress, triggers, and medications with adherence algorithms.
- **Emergency SOS**: Instantly dispatch multi-channel (Firebase/WhatsApp/Email) SOS alerts to configured contacts.

This API adheres strictly to REST principles, delivering standardized responses and explicit HTTP status codes to ensure a reliable developer experience.
""",
    lifespan=lifespan,
    openapi_tags=openapi_tags,
)

# ---------- Middleware (order matters: context -> security -> twilio) ----------
app.add_middleware(RequestContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TwilioSignatureMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Exception handlers ----------
register_exception_handlers(app)

# ---------- Routers ----------
api_prefix = "/api/v1"
app.include_router(system.router, prefix=api_prefix)
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(eeg.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(admin.diagnostics_router, prefix=api_prefix)
app.include_router(connections.router, prefix=api_prefix)
app.include_router(emergency.router, prefix=api_prefix)
app.include_router(medications.router, prefix=api_prefix)
app.include_router(lifestyle.router, prefix=api_prefix)
app.include_router(dashboard.router, prefix=api_prefix)
app.include_router(seizures.router, prefix=api_prefix)


@app.get("/", include_in_schema=False)
async def root():
    """Minimal root probe (Docker healthcheck target)."""
    return {"app": settings.APP_NAME, "docs": "/docs"}
