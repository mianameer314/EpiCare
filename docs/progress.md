# EpiCare — Progress Tracker

> Keep this file updated at the end of every working session/prompt so context is never lost.
> Conventions: `[x]` = done, `[~]` = in progress, `[ ]` = pending. Add a dated log entry for each session.

## Status Overview

- **Current milestone:** M2 — Backend & Database Foundation
- **Last updated:** 2026-08-08
- **Reference standard:** BRANDING-SYSTEM / BRANDING-SYSTEM-FRONTEND (O2Geeks)

---

## Milestones

### M1 — Architecture & Guardrails
- [x] Analyze branding system (backend + frontend) as golden standard
- [x] Create `.cursorrules` (AI agent guardrails)
- [x] Create `architecture.md`
- [x] Create `progress.md`
- [x] Define scope freeze (MVP core; no doctor portal/wearable/hospital/pre-ictal)
- [ ] Write `docs/system_scope.md`
- [ ] Write `docs/api_contract.md`
- [ ] Write `docs/database_schema.md`
- [ ] Write `docs/model_contract.md`

### M2 — Backend & Database Foundation
- [ ] Root config: `.gitignore`, `.env.example`, `docker-compose.yml`
- [ ] `backend/` skeleton mirroring BRANDING-SYSTEM layout
- [ ] `core/config.py` (pydantic-settings) + `core/security.py` (JWT + bcrypt)
- [ ] `core/exceptions.py` (consistent error shape) + `core/logging.py`
- [ ] DB session + SQLAlchemy 2 models (`users`, `patient_profiles`, ...)
- [ ] Alembic initial migration
- [ ] `/api/v1/system/health` + `/api/v1/system/model` endpoints
- [ ] Auth endpoints (register/login/refresh/me)
- [ ] Tests: `tests/conftest.py` + auth tests

### M3 — EEG Upload → Inference (MVP Heart)
- [ ] `services/storage` abstraction (Local provider, validation, UUID naming)
- [ ] EEG upload endpoint (EDF/CSV validation, size/extension/MIME checks)
- [ ] `services/eeg_validation.py` (sampling rate, channels, duration, NaN/Inf, flat)
- [ ] `services/channel_mapper.py` (canonical channel mapping, fallback strategy)
- [ ] `services/eeg_preprocessing.py` (bandpass, notch, z-score, windows, STFT)
- [ ] `ml/model_registry.py` + `ml/model_loader.py` + `ml/inference.py`
- [ ] `models/seizure_detector/` version contract + placeholder artifacts
- [ ] POST `/api/v1/eeg/analyze` → JSON prediction
- [ ] ML pipeline tests (fixtures: normal/seizure/corrupted/missing-channels)

### M4 — Core Frontend (Upload → Result)
- [ ] `frontend/` skeleton mirroring BRANDING-SYSTEM-FRONTEND
- [ ] env validation + axios instance + endpoints map
- [ ] QueryProvider + AuthProvider + router guards
- [ ] Login/Register pages
- [ ] Dashboard page
- [ ] EEG upload + analysis status flow (step-by-step progress UI)
- [ ] Analysis result view (prediction, confidence, spectrogram, model version)
- [ ] History page

### M5 — AI Report + RAG Chatbot
- [ ] `services/report_service.py` (structured, grounded output, fallback)
- [ ] RAG ingestion (PDF → clean → chunk → embed → pgvector)
- [ ] Chatbot endpoint with guardrails (no diagnosis/dosage, injection-safe)
- [ ] Frontend report view + chatbot UI

### M6 — Medication, Lifestyle, Recommendations
- [ ] Medication CRUD + schedules + logs + adherence %
- [ ] Lifestyle/trigger/sleep logging
- [ ] Recommender service (cold-start-safe, non-medical advice)
- [ ] Frontend modules

### M7 — SOS + Full Dashboard + Background Jobs
- [ ] Emergency contacts CRUD (max 3)
- [ ] SOS flow (confirmation → geolocation → Twilio → per-contact delivery state)
- [ ] Dashboard aggregates
- [ ] APScheduler jobs (reminders, missed-med detection)

### M8 — Security, Testing, Deployment
- [ ] Edge-case hardening (upload edge cases, token rotation, rate limiting)
- [ ] API integration tests + E2E (Playwright)
- [ ] Model regression test harness
- [ ] Docker Compose (postgres + backend + frontend)
- [ ] README + final docs + demo script

---

## Session Log

### 2026-08-08 — Session 1: Analysis + Scaffolding
- Analyzed `BRANDING-SYSTEM` backend: layered FastAPI (api/v1 → schemas → services → models), `core/config.py` pydantic-settings, `core/security.py` JWT+bcrypt, `db/session.py`, model registry in `app/models/__init__.py`, `PaginatedResponse[T]`, storage provider abstraction with rollback, RBAC permissions, alembic env wiring, pytest conftest with dependency overrides.
- Analyzed `BRANDING-SYSTEM-FRONTEND`: feature-based modules (`types.ts`/`api.ts`/`hooks.ts`), `config/env.ts` required-var validation, `api/axios.ts` with refresh queue, `api/endpoints.ts` centralized paths, QueryProvider/AuthProvider, ProtectedRoute/PublicRoute, Tailwind v4 `@theme` tokens, oxlint, strict tsconfig.
- Created root guardrails: `.cursorrules`, `architecture.md`, `progress.md`.
- Next session: M2 — config/env mirror, backend skeleton, models, migrations, auth.

## Frozen Decisions (Do Not Change Without Discussion)
1. Binary seizure/no-seizure only; no seizure type/location claims.
2. Postgres + pgvector as the single database.
3. Model artifacts versioned under `models/seizure_detector/versions/` with `current.json` pointer.
4. Files on disk (UUID names), paths in DB.
5. JWT access + refresh; bcrypt; never commit `.env`.
6. Frontend: TanStack Query for server state; Context only for auth/theme.
7. Training preprocessing == inference preprocessing (one shared contract).
