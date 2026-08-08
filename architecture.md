# EpiCare — System Architecture

> Source material: EpiCare proposal (EEG seizure detection + AI reports + RAG chatbot + lifestyle management).
> Code standard reference: O2Geeks Branding System (`BRANDING-SYSTEM` backend, `BRANDING-SYSTEM-FRONTEND` frontend).

## 1. System Overview

EpiCare is a full-stack AI web application for epilepsy detection and daily management:

- Upload EEG (EDF/CSV) → validate → preprocess → dual-domain CNN inference → structured AI report → history dashboard.
- Supporting modules: RAG medical chatbot, medication tracker, lifestyle/trigger logging, recommendations, emergency contacts + SOS, patient profile.

Out of scope for the FYP: doctor portal, community, wearable EEG, hospital integration, pre-ictal prediction, MRI/fMRI, real emergency services, mobile app.

## 2. Technology Stack (Frozen)

| Layer | Choice |
| --- | --- |
| Frontend | React + Vite + TypeScript + Tailwind CSS v4, React Router v7, TanStack Query, Axios |
| Backend | FastAPI + Pydantic v2 + SQLAlchemy 2 + Alembic |
| Database | PostgreSQL + pgvector |
| Auth | JWT access + refresh tokens, bcrypt password hashing |
| ML training | PyTorch, MNE, SciPy, NumPy, scikit-learn |
| ML inference | ONNX Runtime (model artifact = `model.onnx`) |
| RAG | pgvector + embeddings + LLM API (LangChain or direct implementation) |
| Reports | Structured, grounded generation with strict output validation (no free-form diagnosis) |
| Recommender | Rules + KNN / Random Forest |
| SOS | Browser Geolocation + Twilio SMS (simulated alerts for FYP) |
| Background jobs | APScheduler (initial); Celery + Redis only if needed |
| Storage | Local filesystem during FYP; S3-compatible later via `StorageService` abstraction |
| Deployment | Docker Compose; frontend can also deploy to Vercel |

## 3. High-Level Architecture

```text
                  FRONTEND
            React / TypeScript
                   |
                   | REST API (JWT)
                   v
                FastAPI
                   |
   +---------------+----------------+
   |               |                |
   v               v                v
EEG Analysis   Patient Services  AI Services
   |                               |
   v                    +----------+-----------+
Preprocessing           |          |           |
   |                 RAG     Recommender    Reports
   v                   |          |           |
Model Adapter          +----------+-----------+
   |                              |
   v                              v
Active Model (ONNX)      PostgreSQL + pgvector
   |
   v
Prediction + AI Report
```

Keep three parts completely separated:

```text
training/  --produces-->  models/seizure_detector/versions/vN/  --consumed by-->  backend inference
```

## 4. Repository Structure

```text
EpiCare/
|-- .cursorrules            # AI agent guardrails (this repo's AI instructions)
|-- architecture.md         # This document
|-- progress.md             # Dynamic milestone/context tracker
|-- .gitignore
|-- .env.example            # Root env template (docker compose defaults)
|-- docker-compose.yml      # postgres + backend (+ frontend later)
|-- docs/                   # system_scope, api_contract, database_schema, model_contract
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
|-- frontend/               # React SPA (mirrors BRANDING-SYSTEM-FRONTEND/src)
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
|-- rag/                    # documents/, ingestion/, evaluation/
|-- storage/                # eeg/, spectrograms/, reports/, exports/
|-- scripts/                # dev/ops helpers
`-- tests/                  # shared/root-level test assets (EDF fixtures)
```

## 5. Model Contract & Versioning

- Contract: raw EEG (float32 tensor) + spectrogram (float32 tensor) → seizure probability 0..1.
- Every version directory ships: `model.onnx`, `model_config.json`, `preprocessing.json`, `metrics.json`, `checksum.txt`.
- `models/seizure_detector/current.json` holds `{ "active_version": "v1" }`.
- Backend loads `current.json` → version dir → ONNX model → validates input/output shapes → dummy warm-up → READY.
- On failure: server still starts; `/api/v1/system/model` reports `unavailable`; EEG inference returns 503.
- Every prediction row stores `model_version_id` so history can show which model produced it.

## 6. Database (PostgreSQL + pgvector)

Core tables: `users`, `patient_profiles`, `eeg_sessions`, `predictions`, `ai_reports`, `medications`, `medication_schedules`, `medication_logs`, `lifestyle_logs`, `trigger_logs`, `sleep_logs`, `recommendations`, `emergency_contacts`, `sos_events`, `chat_sessions`, `chat_messages`, `rag_documents`, `rag_chunks`, `model_versions`, `audit_logs`.

Relationships:

```text
USER
 |-- PATIENT_PROFILE
 |-- EEG_SESSION --> PREDICTION --> AI_REPORT
 |-- MEDICATION --> MEDICATION_LOG
 |-- LIFESTYLE_LOG / TRIGGER_LOG / SLEEP_LOG
 |-- RECOMMENDATION
 |-- EMERGENCY_CONTACT / SOS_EVENT
 `-- CHAT_SESSION --> CHAT_MESSAGE
```

Store `date_of_birth`, never age. EEG files never live in PostgreSQL — only paths + metadata.

## 7. API Surface (v1)

- `/auth`: register, login, refresh, logout, me
- `/users/me`: get/patch profile (+ patient profile)
- `/eeg`: upload, sessions, validation result, analyze
- `/predictions`: list, detail
- `/reports`: detail, regenerate
- `/chatbot`: sessions, messages
- `/recommendations`: list, regenerate
- `/medications`: CRUD + schedules + logs + adherence
- `/lifestyle`: sleep, triggers, stress logs
- `/emergency`: contacts CRUD, SOS trigger
- `/history`: dashboard aggregates
- `/system`: health, model status

Error shape (consistent): `{ "error": { "code": "...", "message": "...", "details": null } }`.

## 8. Security & Env

- Secrets only via environment (`.env` / settings). Commit only `.env.example`.
- JWT access + refresh; bcrypt hashing; never store plain passwords.
- Uploads: extension + MIME + size validation, secure UUID filenames, never trust user filenames, no path traversal.
- RAG: documents are data, not instructions (prompt-injection guard). Chatbot refuses diagnosis/dosage questions.
- Reports: structured inputs only; fallback keeps prediction available when report generation fails.

## 9. Conventions Inherited from the Branding System

- Backend layering, `DbDep`/`CurrentUser` dependency aliases, service modules with query/action sections, `PaginatedResponse[T]` generic.
- Storage abstraction: `StorageService` (save/get/delete) with provider plugins (Local now, S3 later) + pending-upload rollback.
- Frontend feature-based modules (`types.ts` / `api.ts` / `hooks.ts` / pages), centralized `endpoints.ts`, env validation in `config/env.ts`, axios refresh queue, `QueryProvider` defaults (30s staleTime, retry 1, no refetch on window focus).
- Tailwind v4 design tokens via `@theme` mapping to CSS variables.
