# EpiCare — Development Guide

## Technology Stack (Frozen)

| Layer | Choice |
| --- | --- |
| Frontend | React + Vite + TypeScript, React Router, TanStack Query, Axios, Framer Motion, Recharts |
| Backend | FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic |
| Database | PostgreSQL + pgvector |
| Auth | JWT access + refresh tokens, bcrypt password hashing |
| ML training | PyTorch, MNE, SciPy, NumPy, scikit-learn |
| ML inference | ONNX Runtime (model artifact = `model.onnx`) |
| RAG | pgvector and embedding infrastructure are present; production ingestion/retrieval/citations remain pending |
| Reports | Structured report boundary is present; VLM inference remains pending and must keep strict output validation |
| Recommender | Rules + KNN / Random Forest |
| SOS | Browser Geolocation with Email, Firebase, WhatsApp, and Twilio providers; unconfigured channels currently use development fallbacks |
| Background jobs | APScheduler with best-effort startup and PostgreSQL job store |
| Storage | Local filesystem and boto3 S3-compatible providers through `StorageService` |
| Deployment | Docker Compose; frontend can also deploy to Vercel |

## Repository Structure

```text
EpiCare/
|-- .cursorrules            # AI agent guardrails (this repo's AI instructions)
|-- docs/                   # system_scope, api_contract, database_schema, architecture, getting_started, development, testing, configuration, deployment
|-- backend/                # FastAPI application (mirrors BRANDING-SYSTEM/app)
|   |-- app/
|   |   |-- main.py
|   |   |-- core/           # config, security, exceptions, logging
|   |   |-- api/v1/         # auth, users, eeg, predictions, reports, chatbot, recommendations, medications, lifestyle, emergency, history, system
|   |   |-- db/             # session.py (+ pgvector helpers)
|   |   |-- models/         # SQLAlchemy models + central registry
|   |   |-- schemas/        # Pydantic request/response models
|   |   |-- services/       # business logic (eeg, preprocessing, report, rag, recommender, medication, sos, storage)
|   |   |-- ml/             # model_loader, model_registry, inference, contracts
|   |   `-- utils/
|   |-- alembic/            # migrations
|   |-- tests/
|   |-- requirements.txt
|   `-- Dockerfile
|-- frontend/               # live React SPA with protected role-based routes
|   `-- src/
|       |-- api/            # axios instance + endpoints
|       |-- config/         # env.ts
|       |-- components/     # shared UI (layout, shared, errors, ui)
|       |-- features/       # auth, dashboard, eeg, medications, lifestyle, recommendations, emergency, chat, profile, history
|       |-- hooks/          # shared hooks
|       |-- lib/            # utils, formdata
|       |-- providers/      # QueryProvider, AuthProvider
|       |-- router/         # route map + guards
|       `-- types/          # api.types, filters
|-- models/                 # versioned model artifacts
|   `-- seizure_detector/
|       |-- current.json    # {"active_version": "v1"}
|       `-- versions/vN/    # model.onnx, model_config.json, preprocessing.json, metrics.json
|-- training/               # training pipelines (never imported by backend)
|-- rag/                    # document location; production ingestion/retrieval pipeline pending
|-- storage/                # eeg/, spectrograms/, reports/, exports/
|-- scripts/                # dev/ops helpers
`-- tests/                  # shared/root-level test assets (EDF fixtures)
```

## Conventions Inherited from the Branding System

- **Backend layering**: `DbDep`/`CurrentUser` dependency aliases, service modules with query/action sections, `PaginatedResponse[T]` generic.
- **Storage abstraction**: `StorageService` (save/get/delete) with Local and S3-compatible providers plus pending-upload rollback.
- **Frontend architecture**: feature-based modules (`types.ts` / `api.ts` / `hooks.ts` / pages), centralized `endpoints.ts`, env validation in `config/env.ts`, axios refresh queue, `QueryProvider` defaults (30s staleTime, retry 1, no refetch on window focus).
- **Styling**: Tailwind v4 design tokens via `@theme` mapping to CSS variables.

## Database Migrations (Alembic)

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head      # apply
.\.venv\Scripts\python.exe -m alembic current           # check revision
.\.venv\Scripts\python.exe -m alembic downgrade -1      # roll back one step
.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "description"   # new migration
```
