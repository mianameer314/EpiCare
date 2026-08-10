# EpiCare — AI-Powered Epilepsy Care Platform

> **Complete Engineering Handbook** — architecture, RBAC, profiles, connections, auth (OTP), EEG pipeline, model registry, configuration, and testing.

EpiCare is a full-stack AI web application for **epilepsy detection and daily management**:

- Upload an EEG recording (EDF / CSV) → validate → preprocess → run binary seizure detection → get a confidence-scored result → generate a structured AI report.
- Role-based access control (`PATIENT`, `DOCTOR`, `CARETAKER`, `ADMIN`) with role-specific profiles, connection workflows, and strict ABAC security for data isolation.
- Supporting modules: Pagination/Filtering, RAG medical chatbot, medication tracker, lifestyle/trigger/sleep logging, emergency contacts + SOS.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](docs/development.md)
3. [Repository Structure](docs/development.md)
4. [Roles & Access Control (RBAC)](#4-roles--access-control-rbac)
5. [Role-Specific Profiles](#5-role-specific-profiles)
6. [Connection Networks (Request → Approve)](#6-connection-networks-request--approve)
7. [Authentication & OTP Flow](#7-authentication--otp-flow)
8. [Database Schema & Migrations](docs/database_schema.md)
9. [EEG Pipeline (Upload → Inference)](#9-eeg-pipeline-upload--inference)
10. [Model Registry & Artifacts](#10-model-registry--artifacts)
11. [API Reference](docs/api_contract.md)
12. [Configuration Reference](docs/configuration.md)
13. [Getting Started](docs/getting_started.md)
14. [Testing](docs/testing.md)
15. [Error Handling & Logging](#15-error-handling--logging)
16. [Security & Guardrails](#16-security--guardrails)
17. [Known Issues & Current State](#17-known-issues--current-state)
18. [Roadmap](#18-roadmap)
19. [FAQ](#19-faq)

---

## 1. Project Overview

### What is EpiCare?

EpiCare is an end-to-end epilepsy care platform built for a final-year project (FYP). It combines:

| Area | What it does |
| --- | --- |
| **EEG Analysis** | Accepts EDF/CSV uploads, validates them, preprocesses the signal (bandpass, notch, z-score, windowing, STFT), and produces a binary **seizure / no-seizure** prediction with confidence. |
| **RBAC + Profiles** | Four roles (`PATIENT`, `DOCTOR`, `CARETAKER`, `ADMIN`). Each role gets its own isolated profile table with role-specific fields. |
| **Connections** | Patients can search for a PMDC-verified doctor and send a connection request; the doctor approves it. Junction tables persist the `PENDING → ACTIVE` lifecycle. |
| **Auth** | JWT access + refresh tokens, bcrypt password hashing, **email OTP verification** (with a placeholder for SMS), phone-number-aware registration. |
| **AI Services & Core Features** | RAG medical chatbot, structured AI reports, Patient Dashboard, Lifestyle & Seizure tracking (Diet, Screen time, Menstruation). |
| **Emergency SOS** | Multi-channel instant alerts triggering Email, WhatsApp, and Firebase Push Notifications (FCM). |

### Guiding rules (frozen decisions)

1. **Binary classification only** — never claim seizure type, location, or diagnosis.
2. **PostgreSQL + pgvector** is the single database.
3. Model artifacts are **versioned** under `models/seizure_detector/versions/` with a `current.json` pointer.
4. Files are stored **on disk (UUID names)**; only paths are stored in the DB.
5. **JWT access + refresh**, bcrypt; never commit `.env`.
6. Frontend uses **TanStack Query** for server state; Context only for auth/theme.
7. **Training preprocessing == inference preprocessing** — one shared contract.
---

## 2. Technology Stack

| Layer | Choice |
| --- | --- |
| **Backend** | FastAPI, Pydantic v2 (strict), SQLAlchemy 2 (async), Alembic |
| **Database** | PostgreSQL 15 + pgvector (optional locally), asyncpg driver |
| **Auth** | PyJWT (access + refresh), passlib/bcrypt, email OTP via `fastapi-mail` |
| **EEG processing** | MNE, NumPy, SciPy (bandpass, notch, STFT) |
| **ML inference** | ONNX Runtime (`model.onnx` artifact) |
| **AI / RAG (planned)** | OpenAI-compatible API, pgvector embeddings, LangChain core |
| **Scheduling** | APScheduler (PostgreSQL job store) |
| **Rate limiting** | Redis-backed with in-memory fallback |
| **Storage** | Local filesystem (S3-compatible later via `StorageService` abstraction) |
| **Frontend (not yet built)** | React + Vite + TypeScript + Tailwind CSS v4, React Router v7, TanStack Query, Axios |
| **Deployment** | Docker Compose (`postgres`, `backend`, `frontend`) |

---

## 3. Repository Structure

```text
EpiCare/
├── README.md                     # ← you are here
├── architecture.md               # system design & standards
├── progress.md                   # milestone tracker / session log
├── .cursorrules                  # AI agent guardrails
├── .env.example                  # root env template
├── docker-compose.yml            # postgres + backend + frontend
├── docs/                         # system_scope, api_contract, database_schema, model_contract
├── backend/                      # FastAPI application
│   ├── app/
│   │   ├── main.py               # composition root (lifespan, middleware, routers)
│   │   ├── api/
│   │   │   ├── deps.py           # auth guards + RoleChecker + VerifiedDoctor
│   │   │   └── v1/               # auth, users, connections, eeg, system, admin
│   │   ├── core/                 # config, security, exceptions, logging, permissions
│   │   ├── db/                   # async session, tracing
│   │   ├── middleware/           # request context, security headers, twilio
│   │   ├── ml/                   # model registry, loader, inference, contracts
│   │   ├── models/               # SQLAlchemy models + enums + networks
│   │   ├── schemas/              # Pydantic request/response models
│   │   ├── services/             # business logic (user, profiles, eeg, storage, email)
│   │   ├── rate_limit/           # sliding-window limiter
│   │   ├── scheduler/            # APScheduler wrapper
│   │   └── templates/email/      # OTP email template
│   ├── alembic/                  # migrations (3 revisions)
│   ├── tests/                    # pytest suite
│   ├── .env                      # local secrets (never commit)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── Procfile
├── frontend/                     # empty skeleton (M4 not started)
├── models/seizure_detector/      # versioned model artifacts + current.json
├── rag/documents/                # RAG corpus (gitignored contents)
├── training/                     # training code (future)
├── scripts/                      # helper scripts
└── storage/                      # uploaded files (gitignored contents)
```
---

## 4. Roles & Access Control (RBAC)

### 4.1 Roles

Defined in `backend/app/models/enums.py`:

| Enum | DB value | Meaning |
| --- | --- | --- |
| `PATIENT` | `PATIENT` | Person living with epilepsy; uploads EEG, views predictions, manages medications/lifestyle. **Default role on signup.** |
| `DOCTOR` | `DOCTOR` | Neurologist; must supply a `pmdc_number` at registration; can approve patient connections once PMDC-verified. |
| `CARETAKER` | `CARETAKER` | Family member/guardian; holds relation + crisis contact info. |
| `ADMIN` | `ADMIN` | Staff/operations; future user management, audit logs, RAG ingestion. |

> These **replace** the earlier `user` / `admin` string enum in `core/permissions.py`. The new role lives on the `users` table via a Postgres enum type `user_role_enum` (default `PATIENT`).

### 4.2 Where the role lives

```text
users.role  (postgres enum: user_role_enum, server default 'PATIENT')
   │
   ├── users.is_email_verified     (OTP verified flag)
   ├── users.is_phone_verified     (reserved for SMS flow)
   ├── users.otp_secret_hash       (bcrypt hash of the 6-digit OTP)
   ├── users.otp_expires_at        (10-minute TTL)
   ├── users.phone_number          (unique, indexed, required at registration)
   ├── users.fcm_token             (Firebase Cloud Messaging token for push notifications)
   └── 1:1 role profiles ──► patient_profiles | doctor_profiles | caretaker_profiles
```

### 4.3 Enforcement — `RoleChecker`

Located in `backend/app/api/deps.py`. It is a dependency factory that returns a FastAPI dependency:

```python
class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: CurrentUser) -> User:
        if user.role not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Operation not permitted")
        return user
```

**Usage in a route:**

```python
@router.get("/doctors/search", response_model=List[DoctorSearchResponse])
async def search_doctors(
    pmdc_number: str,
    db: DbDep,
    current_user: User = Depends(RoleChecker([UserRole.PATIENT])),
):
    ...
```

**What happens:** if the authenticated user's `role` is not in `allowed_roles`, the request is rejected with **403 Forbidden** before the endpoint body runs.

### 4.4 Enforcement — `VerifiedDoctor`

A second guard for sensitive doctor actions. It first requires `DOCTOR` role, then checks the linked `DoctorProfile.is_pmdc_verified` flag:

```python
async def get_verified_doctor(
    user: Annotated[User, Depends(RoleChecker(["DOCTOR"]))], db: DbDep
) -> User:
    ...
    if not profile or not profile.is_pmdc_verified:
        raise HTTPException(status_code=403, detail="Doctor profile pending PMDC verification")
    return user

VerifiedDoctor = Annotated[User, Depends(get_verified_doctor)]
```

**The PMDC verification flow:**

```text
Doctor registers with pmdc_number  ──►  profile created (is_pmdc_verified = False)
                                              │
                    Admin verifies in the DB (is_pmdc_verified = True)
                                              │
                                              ▼
              Doctor can now log in & approve patient connections
```

Until the admin flips `is_pmdc_verified = True`, the doctor **cannot log in** (login endpoint rejects with 403) and **cannot** call `VerifiedDoctor` endpoints.

> **Admin Verification:** Verification is handled securely via the Admin Dashboard. Admins use the `PATCH /api/v1/admin/doctors/{user_id}/verify` endpoint to approve or reject doctors based on their credentials.

### 4.5 Permission matrix

| Action / Endpoint | PATIENT | DOCTOR | CARETAKER | ADMIN |
| --- | :-: | :-: | :-: | :-: |
| Register / login / verify OTP | ✅ | ✅ | ✅ | ❌ (Seeded) |
| `GET /users/me` | ✅ | ✅ | ✅ | ✅ |
| Patient profile CRUD | ✅ | — | — | — |
| Doctor profile (own) | — | ✅ | — | — |
| Caretaker profile (own) | — | — | ✅ | — |
| Search doctors by PMDC | ✅ | — | — | — |
| Request doctor connection | ✅ | — | — | — |
| Approve connection | — | ✅ (verified) | — | — |
| EEG upload / analyze | ✅ | ✅ (diagnostics) | ✅ (proxy) | — |
| Admin Dashboard (Users, PMDC, Metrics) | — | — | — | ✅ (role) |
| System diagnostics (`X-Admin-Key`) | — | — | — | ✅ (key) |

> Not all planned endpoints exist yet — see [Known Issues](#17-known-issues--current-state).
---

## 5. Role-Specific Profiles

Each role gets an **isolated 1:1 profile table** (instead of one generic profile). All profiles `CASCADE` delete with the user.

### 5.1 PatientProfile — `backend/app/models/patient_profile.py`

Medical + demographic fields for the patient:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `user_id` | FK → users.id | unique |
| `date_of_birth` | Date | **required** (never store age) |
| `gender` | String(30) | optional |
| `blood_type` | String(10) | optional |
| `city` | String(100) | optional |
| `primary_diagnosis` | String(100) | optional |
| `emergency_contact_name` | String(150) | optional |
| `emergency_contact_relation` | String(100) | optional |
| `emergency_contact_phone` | String(30) | optional |
| `known_triggers` | JSONB | list of trigger strings |
| `notes` | Text | optional |
| `timezone` | String(64) | default `UTC` |
| `created_at` / `updated_at` | timestamptz | server defaults |

> ⚠️ The legacy `height_cm` / `weight_kg` / `full_name` columns were **dropped** by the RBAC migration.

### 5.2 DoctorProfile — `backend/app/models/doctor_profile.py`

Physician-specific fields:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `user_id` | FK → users.id | unique |
| `pmdc_number` | String(50) | **unique, required** (Pakistan Medical & Dental Council) |
| `specialty` | String(100) | default `Neurologist` |
| `hospital_affiliation` | String(200) | optional |
| `license_image_url` | String(500) | optional license image |
| `is_pmdc_verified` | Boolean | default `False` — **admin gate** |

### 5.3 CaretakerProfile — `backend/app/models/caretaker_profile.py`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `user_id` | FK → users.id | unique |
| `relationship_to_patient` | String(100) | e.g. `parent`, `spouse` |
| `crisis_phone_number` | String(30) | emergency line |
| `created_at` / `updated_at` | timestamptz | |

### 5.4 Auto-provisioning on signup

`backend/app/services/user.py` creates the correct profile automatically based on the selected role:

| Role | Profile created |
| --- | --- |
| `PATIENT` | `PatientProfile(user_id, date_of_birth=<today placeholder>)` |
| `DOCTOR` | `DoctorProfile(user_id, pmdc_number, specialty="Neurologist")` |
| `CARETAKER` | `CaretakerProfile(user_id)` |
| `ADMIN` | none (no profile table) |

> ⚠️ The patient `date_of_birth` placeholder (`today`) should be updated by the user later — registration does not collect DOB yet.
---

## 6. Connection Networks (Request → Approve)

### 6.1 Models — `backend/app/models/networks.py`

Two many-to-many junction tables support a **single patient ↔ many doctors/caretakers** relationship:

| Table | Purpose |
| --- | --- |
| `patient_doctor_networks` | patient_profiles.id ↔ doctor_profiles.id |
| `patient_caretaker_networks` | patient_profiles.id ↔ caretaker_profiles.id |

Both store:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `patient_id` | FK → patient_profiles.id | CASCADE |
| `doctor_id` / `caretaker_id` | FK → respective profile | CASCADE |
| `relationship_status` | enum `connection_status_enum` | `PENDING` (default) → `ACTIVE` / `REVOKED` |
| `date_linked` | timestamptz | server default `now()` |
| `updated_at` | timestamptz | on update |

**Connection lifecycle:**

```text
PATIENT ──search doctor by PMDC──► POST /connections/doctors/request ──► PENDING
                                                                         │
                                      DOCTOR (PMDC-verified) ──approve──► ACTIVE
                                                                         │
                                                                         └─► REVOKED (future)
```

### 6.2 Endpoints — `backend/app/api/v1/connections.py`

| Method | Path | Role | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/v1/connections/doctors/search?pmdc_number=...` | PATIENT | Returns verified doctors matching the PMDC number (empty list when none). |
| `POST` | `/api/v1/connections/doctors/request` | PATIENT | Creates a `PENDING` connection (`{"doctor_id": <id>}`). 404 if no profile/doctor; 400 if connection already exists. |
| `POST` | `/api/v1/connections/doctors/approve/{connection_id}` | DOCTOR (verified) | Flips `PENDING → ACTIVE`. 404 if not found/owned; 400 if not pending. |

**Example flows (curl):**

```bash
# 1. Patient searches for a doctor
curl -H "Authorization: Bearer $PATIENT_TOKEN" \
  "http://localhost:8000/api/v1/connections/doctors/search?pmdc_number=PMDC-12345"

# 2. Patient requests a connection
curl -X POST -H "Authorization: Bearer $PATIENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"doctor_id": 1}' \
  http://localhost:8000/api/v1/connections/doctors/request

# 3. Doctor approves (only if is_pmdc_verified = true)
curl -X POST -H "Authorization: Bearer $DOCTOR_TOKEN" \
  http://localhost:8000/api/v1/connections/doctors/approve/1
```

---

## 7. Authentication & OTP Flow

### 7.1 Registration — `POST /api/v1/auth/register`

New required fields (compared to the original scaffold):

```json
{
  "email": "patient@example.com",
  "password": "supersecret123",
  "phone_number": "03001234567",
  "full_name": "Ali Khan",
  "role": "PATIENT",
  "pmdc_number": null
}
```

Rules enforced in `backend/app/services/user.py`:

- Duplicate **email** → `409 EMAIL_ALREADY_REGISTERED`
- Duplicate **phone_number** → `409 PHONE_ALREADY_REGISTERED`
- `role = DOCTOR` without `pmdc_number` → `400 "PMDC number is required for doctors"`
- `role = ADMIN` → `422 Validation Error` (Admins must be seeded via DB or `.env` `ADMIN_EMAIL` / `ADMIN_PASSWORD` on startup).
- A 6-digit OTP is generated, **bcrypt-hashed** into `otp_secret_hash`, with a **10-minute** expiry (`otp_expires_at`)
- The role-specific profile is created after the user row
- An email with the OTP is queued via `BackgroundTasks` (see `backend/app/services/email.py`)
- SMS is currently a **debug placeholder**:

  ```python
  print(f"DEBUG (SMS Gateway Skipped): Sending OTP {otp_plain} to {user.phone_number}")
  ```

### 7.2 OTP verification — `POST /api/v1/auth/verify-email`

```json
{ "email": "patient@example.com", "otp": "123456" }
```

- Valid + not expired → `is_email_verified = True`, OTP fields cleared.
- Already verified → `{"message": "Email is already verified"}`.
- Invalid/expired → `400 "Invalid or expired OTP"`.

### 7.3 Resend OTP — `POST /api/v1/auth/resend-otp`

- Always returns `{"message": "If an account exists, a new OTP has been sent."}` (does not leak account existence).
- Rejects with 400 if already verified.

### 7.4 Login — `POST /api/v1/auth/login`

```text
email + password ──► verify bcrypt hash ──► is_active? ──► is_email_verified?
                                          └─► DOCTOR? ──► is_pmdc_verified?
                                          ──► access_token + refresh_token
```

Rejections:

| Condition | Status |
| --- | --- |
| Bad credentials | `401` |
| `is_active = False` | `403 "Account is deactivated"` |
| Email not verified | `403 "Email is not verified. Please verify your email first."` |
| Doctor not PMDC-verified | `403 "Your doctor profile is pending PMDC verification by an admin."` |

### 7.5 Tokens

- `POST /auth/refresh` — refresh token → new token pair.
- `POST /auth/logout` — 204 (client discards tokens).
- `GET /auth/me`, `PATCH /auth/me`, `POST /auth/change-password`.
---

## 8. Database Schema & Migrations

### 8.1 Migration chain (Alembic)

| Revision | File | What it does |
| --- | --- | --- |
| `202608080001` | `202608080001_initial_schema.py` | All 21 core tables + pgvector setup (skips `rag_chunks` when pgvector unavailable). |
| `f42c7d723bd0` | `f42c7d723bd0_add_email_verification_fields.py` | Adds `is_verified`, `otp_secret_hash`, `otp_expires_at` to `users`. |
| `23058907d24b` | `23058907d24b_add_rbac_roles_profiles_and_networks.py` | **RBAC overhaul**: creates `user_role_enum`, `connection_status_enum`, `doctor_profiles`, `caretaker_profiles`, both network tables, and re-shapes `users` + `patient_profiles`. |
| `6c8f25f56b3e` | `6c8f25f56b3e_add_fcm_token.py` | Adds `fcm_token` to `users` for push notifications (Firebase integration). |
| `928d3b7d19a9` | `928d3b7d19a9_add_manual_seizures_and_lifestyle_.py` | Adds `manual_seizure_logs` table and `metadata_dict` JSONB to `lifestyle_logs` for robust tracking. |

**Current DB state (verified):** `alembic_version = 928d3b7d19a9 (head)`, **27 tables** created.

### 8.2 Tables (26)

```text
users  patient_profiles  doctor_profiles  caretaker_profiles
patient_doctor_networks  patient_caretaker_networks
eeg_sessions  predictions  ai_reports  model_versions
medications  medication_schedules  medication_logs
lifestyle_logs  trigger_logs  sleep_logs  recommendations  manual_seizure_logs
emergency_contacts  sos_events  sos_deliveries
chat_sessions  chat_messages  rag_documents
audit_logs  apscheduler_jobs  alembic_version
```

> `rag_chunks` is absent when the local Postgres does **not** have the `vector` extension (see [Known Issues](#17-known-issues--current-state)).

### 8.3 Running migrations

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head      # apply
.\.venv\Scripts\python.exe -m alembic current           # check revision
.\.venv\Scripts\python.exe -m alembic downgrade -1      # roll back one step
.\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "description"   # new migration
```

`alembic/env.py` swaps the asyncpg URL for the sync `psycopg2` URL automatically, so migrations work against the same `.env` `DATABASE_URL`.

---

## 9. EEG Pipeline (Upload → Inference)

### 9.1 Flow

```text
POST /eeg/upload (multipart file)
   │
   ▼
StorageService.validate_eeg_upload   (extension / MIME / size / empty checks, SHA-256 hash)
   │
   ▼
EegSession created (status = UPLOADED, UUID storage key)
   │
   ▼
POST /eeg/sessions/{id}/analyze
   │
   ├─► eeg_reader      (EDF/CSV parse off the event loop)
   ├─► eeg_validation  (sampling rate, channels, duration, NaN/Inf, flat-line)
   ├─► channel_mapper  (canonical channel mapping + fallback)
   ├─► eeg_preprocessing (bandpass 0.5–70 Hz, 50/60 Hz notch, z-score,
   │                      10 s windows, STFT spectrogram)
   ├─► inference (ONNX)  ──► 503 if model unavailable
   │
   ▼
Prediction (class, confidence, threshold, window probabilities) + status COMPLETED
```

### 9.2 Key services (all under `backend/app/services/`)

| File | Responsibility |
| --- | --- |
| `storage/validator.py` | Extension/MIME/size checks; `sha256_bytes` for duplicate detection. |
| `storage/service.py` + `local.py` | Storage abstraction; UUID filenames; exists/resolve for spectrograms. |
| `eeg_reader.py` | Parses EDF/CSV into numpy arrays (blocking work off the event loop). |
| `eeg_validation.py` | Validates sampling rate, channels, duration; flags NaN/Inf and flat signals. |
| `channel_mapper.py` | Maps arbitrary channel names to the canonical 19-channel set. |
| `eeg_preprocessing.py` | Bandpass + notch + z-score + 10 s windows + STFT (shape derived from actual STFT output). |
| `eeg_session.py` | Orchestrates upload → validate → preprocess → infer; persists session + prediction. |

---

## 10. Model Registry & Artifacts

### 10.1 Layout

```text
models/seizure_detector/
├── current.json                     # {"active_version": "v1"}
└── versions/v1/
    ├── model_config.json            # name, threshold, input/output names
    ├── preprocessing.json           # preprocess contract (windows, STFT)
    ├── metrics.json                 # eval metrics
    ├── checksum.txt                 # artifact checksum
    └── model.onnx                   # ❌ MISSING (placeholder only)
```

### 10.2 Behavior

- `app/ml/model_registry.py` resolves `current.json` → `ModelPackage`.
- `app/ml/model_loader.py` loads the ONNX session, validates inputs, runs a warm-up.
- If anything is missing (or ONNX Runtime is absent), **the server still boots**; `/system/model` reports `status: "unavailable"` and EEG analyze returns **503**.
- The placeholder currently has **no `model.onnx`**, so inference is unavailable until a real artifact is dropped in.
---

## 11. API Reference

Base path: **`/api/v1`**. Auth: `Authorization: Bearer <access_token>` (except auth/system endpoints).

### 11.1 Auth

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register` | email, password, phone_number, full_name, role, pmdc_number? | `201 UserOut` |
| POST | `/auth/login` | email, password | `200 Token` |
| POST | `/auth/verify-email` | email, otp | `200 {message}` |
| POST | `/auth/resend-otp` | email | `200 {message}` |
| POST | `/auth/refresh` | — (Bearer refresh) | `200 Token` |
| POST | `/auth/logout` | — | `204` |
| GET | `/auth/me` | — | `200 UserOut` |
| PATCH | `/auth/me` | full_name?, phone_number? | `200 UserOut` |
| POST | `/auth/change-password` | current_password, new_password | `204` |

### 11.2 Users / Profiles

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/users/me` | `200 UserOut` |
| GET | `/users/me/profile` | `200 PatientProfileOut` (404 if none) |
| POST | `/users/me/profile` | `201 PatientProfileOut` |
| PUT | `/users/me/profile` | `200 PatientProfileOut` (upsert) |

### 11.3 Connections

| Method | Path | Role | Returns |
| --- | --- | --- | --- |
| GET | `/connections/doctors/search?pmdc_number=` | PATIENT | `200 [DoctorSearchResponse]` |
| POST | `/connections/doctors/request` | PATIENT | `201 ConnectionResponse` |
| POST | `/connections/doctors/approve/{id}` | DOCTOR verified | `200 ConnectionResponse` |
| POST | `/connections/caretakers/request` | PATIENT | `201 ConnectionResponse` |
| GET | `/connections/caretakers/pending` | CARETAKER | `200 [ConnectionResponse]` |
| POST | `/connections/caretakers/approve/{id}` | CARETAKER | `200 ConnectionResponse` |

### 11.4 EEG

| Method | Path | Returns |
| --- | --- | --- |
| POST | `/eeg/upload` (multipart `file`) | `201 EegSessionOut` |
| GET | `/eeg/sessions` (page, per_page) | `200 EegSessionList` |
| GET | `/eeg/sessions/{id}` | `200 EegSessionOut` |
| POST | `/eeg/sessions/{id}/analyze` | `200 PredictionOut` / `503` |
| GET | `/eeg/sessions/{id}/spectrogram` | image |
| GET | `/eeg/sessions/{id}/prediction` | `200 PredictionOut` |

### 11.5 System / Admin

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/system/health` | `200 {"status": "healthy"}` |
| GET | `/system/model` | `200 ModelStatusOut` |
| GET | `/admin/health/diagnostics` | `200 DiagnosticsOut` (requires `X-Admin-Key`) |
| GET | `/admin/dashboard/metrics` | `200 AdminDashboardMetricsOut` (Admin Role) |
| GET | `/admin/users` | `200 [UserOut]` (Admin Role) |
| PATCH | `/admin/users/{id}/status` | `200 UserOut` (Admin Role) |
| GET | `/admin/doctors/pending` | `200 [DoctorProfileOut]` (Admin Role) |
| PATCH | `/admin/doctors/{id}/verify` | `200 DoctorProfileOut` (Admin Role) |

### 11.6 Lifestyle & Seizures (New)

| Method | Path | Returns |
| --- | --- | --- |
| POST | `/seizures/manual` | `201 ManualSeizureLogOut` |
| GET | `/seizures/manual` | `200 [ManualSeizureLogOut]` |
| POST | `/lifestyle/menstruation` | `201 LifestyleLogOut` |
| POST | `/lifestyle/diet` | `201 LifestyleLogOut` |
| POST | `/lifestyle/illness` | `201 LifestyleLogOut` |
| POST | `/lifestyle/med-side-effects` | `201 LifestyleLogOut` |
| POST | `/lifestyle/screen-time` | `201 LifestyleLogOut` |

### 11.7 Error envelope

Every error follows the same shape:

```json
{
  "error": {
    "code": "EMAIL_ALREADY_REGISTERED",
    "message": "Email already registered",
    "details": null
  },
  "trace_id": "a1b2c3d4e5f6a7b8"
}
```

---

## 12. Configuration Reference

All settings live in `backend/app/core/config.py` (pydantic-settings), overridden by `backend/.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+asyncpg://epicare:epicare@localhost:5432/epicare` | async app DB URL |
| `TEST_DATABASE_URL` | `.../epicare_test` | test DB URL |
| `REDIS_URL` | `redis://localhost:6379` | rate limiter (falls back to memory) |
| `JWT_SECRET` | change-me value | signs tokens |
| `JWT_ACCESS_EXPIRY_MINUTES` | 30 | access token TTL |
| `JWT_REFRESH_EXPIRY_DAYS` | 7 | refresh token TTL |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | allowed origins |
| `STORAGE_PROVIDER` | `local` | storage backend |
| `LOCAL_STORAGE_PATH` | `storage` | upload folder |
| `EEG_MAX_SIZE_MB` | 200 | upload limit |
| `ALLOWED_EEG_EXTENSIONS` | `.edf,.csv` | accepted types |
| `MODEL_ROOT` | `models/seizure_detector` | registry root (set to `../models/seizure_detector` in local `.env`) |
| `MODEL_NAME` | `EpiCareFusion` | display name |
| `OPENAI_API_KEY` / `LLM_MODEL` / `EMBEDDING_MODEL` | — | AI services (future) |
| `VECTOR_DIMENSION` | 1536 | pgvector dims |
| `TWILIO_*` | — | SOS SMS (future) |
| `SCHEDULER_ENABLED` | `true` | APScheduler on/off |
| `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_FROM` / `MAIL_SERVER` / `MAIL_PORT` / `MAIL_FROM_NAME` | — | OTP email via SMTP |
| `ADMIN_API_KEY` | `change_me_admin_api_key` | admin diagnostics header |
---

## 13. Getting Started

### 13.1 Prerequisites

- Python 3.12+ (project developed on 3.14)
- PostgreSQL 15 running locally on port 5432
- (Optional) Redis on 6379 — falls back to in-memory rate limiting
- Node.js 20+ for the frontend (not yet built)

### 13.2 Backend setup (Windows / PowerShell)

```powershell
# 1. Create venv + install deps
cd E:\BS_INTERN\EpiCare\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 2. Configure environment
#    Edit backend\.env — at minimum DATABASE_URL, JWT_SECRET, MAIL_* values.

# 3. Create the database + apply migrations
#    (create `EpiCare` in pgAdmin/psql if it doesn't exist)
.\.venv\Scripts\python.exe -m alembic upgrade head

# 4. Run the server
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs: **http://127.0.0.1:8000/docs**

### 13.3 Docker Compose

```powershell
docker compose up --build
# postgres :5432, backend :8000, frontend :5173 (frontend build pending)
```

### 13.4 Manual end-to-end smoke test

```powershell
# 1. Health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/system/health

# 2. Register a patient (OTP will print to the server console + email if configured)
$body = @{ email='patient@example.com'; password='supersecret123'; phone_number='03001234567'; full_name='Ali Khan'; role='PATIENT' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/auth/register -ContentType 'application/json' -Body $body

# 3. Verify OTP (grab the 6-digit code from the server console log)
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/auth/verify-email -ContentType 'application/json' `
  -Body (@{ email='patient@example.com'; otp='<code>' } | ConvertTo-Json)

# 4. Login → token
$login = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/auth/login -ContentType 'application/json' `
  -Body (@{ email='patient@example.com'; password='supersecret123' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.access_token)" }

# 5. Get own user + profile
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/v1/users/me -Headers $headers
```

### 13.5 Doctor + connection smoke test

```powershell
# Register a doctor (PMDC required)
$doc = @{ email='doc@example.com'; password='supersecret123'; phone_number='03019876543'; full_name='Dr. Ayesha'; role='DOCTOR'; pmdc_number='PMDC-12345' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/auth/register -ContentType 'application/json' -Body $doc

# Mark verified via Admin API
$admin_login = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/v1/auth/login -ContentType 'application/json' `
  -Body (@{ email='mianameer830@gmail.com'; password='superamdin123' } | ConvertTo-Json)
$admin_headers = @{ Authorization = "Bearer $($admin_login.access_token)" }

# Get the pending doctor's user ID from /api/v1/admin/doctors/pending, then verify:
Invoke-RestMethod -Method Patch -Uri http://127.0.0.1:8000/api/v1/admin/doctors/2/verify -Headers $admin_headers -ContentType 'application/json' `
  -Body (@{ status='approved'; notes='PMDC looks valid' } | ConvertTo-Json)

# Doctor logs in, patient requests connection, doctor approves (see section 6.2)
```
---

## 14. Testing

### 14.1 Test layout

| File | Covers |
| --- | --- |
| `tests/test_auth.py` | register / login / me / OTP contract |
| `tests/test_eeg_api.py` | upload + analyze HTTP contract |
| `tests/test_channel_mapper.py` | channel mapping + fallback |
| `tests/test_eeg_preprocessing.py` | bandpass / resample / windows / STFT |
| `tests/test_eeg_validation.py` | sampling rate, channels, NaN/Inf, flat |
| `tests/test_admin_api.py` | User suspension, doctor PMDC verification, admin dashboard metrics |
| `tests/test_system_api.py` | System health, model status, diagnostics (with X-Admin-Key) |
| `tests/conftest.py` | test DB fixtures, dependency overrides, pgvector tolerance |

### 14.2 Running the suite

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

The suite expects a local Postgres (used by `tests/conftest.py` → `epicare_test` DB). Create it if missing:

```powershell
psql -U postgres -c "CREATE ROLE epicare WITH LOGIN PASSWORD 'epicare' CREATEDB;"
psql -U postgres -c "CREATE DATABASE epicare_test OWNER epicare;"
```

### 14.3 Current status

The test suite covers the new RBAC architecture, OTP verification, robust profile validation, connection requests between patients and doctors, the entire EEG processing pipeline, and the comprehensive Admin Dashboard operations.

All **59 tests are passing successfully**.

---

## 15. Error Handling & Logging

### 15.1 Exception handlers — `backend/app/core/exceptions.py`

- Registered in `app/main.py` via `register_exception_handlers(app)`.
- Validation failures → `VALIDATION_ERROR` code in the standard envelope.
- Service helpers: `conflict_error(...)`, `not_found_error(...)`.

### 15.2 Structured logging — `backend/app/core/logging.py`

- JSON logs with `timestamp`, `log_level`, `trace_id`, `module`, `message`, and extra fields.
- `RequestContextMiddleware` attaches a per-request `trace_id` (visible in responses/errors).

### 15.3 Middleware chain (order matters)

```text
RequestContextMiddleware → SecurityHeadersMiddleware → TwilioSignatureMiddleware → CORS
```

- Security headers: CSP, HSTS, frame-ancestors, nosniff, referrer policy.
- Rate limiting: Redis sliding window with in-memory fallback (see `app/rate_limit/`).
---

## 16. Security & Guardrails

- **Passwords:** bcrypt (`passlib`) — never stored plaintext.
- **OTP:** bcrypt-hashed in `otp_secret_hash`, 10-minute expiry, single-use (cleared after verify).
- **JWT:** HS256; access 30 min, refresh 7 days; `type` claim enforced (access vs refresh).
- **Email verification required before login**; doctors additionally need PMDC verification.
- **Profile isolation:** `user_id` is unique on every profile table → 1:1.
- **No path traversal:** uploads use UUID storage keys (`sanitize_filename` + `generate_storage_key`).
- **Account-existence protection:** `/auth/resend-otp` returns a generic message.
- **Never commit `.env`** — gitignored; contains real Gmail app-password + AWS keys in the local file.

> ⚠️ **Local `.env` contains real credentials** (`MAIL_PASSWORD` app password, AWS access key). Rotate/remove them before any share or deployment.

---

## 17. Known Issues & Current State

| # | Issue | Impact | Fix direction |
| --- | --- | --- | --- |
| 1 | `rag_chunks` skipped locally (no pgvector extension) | RAG/chatbot unavailable | Install pgvector into local Postgres or use Docker image with pgvector |
| 2 | No `model.onnx` artifact | `/eeg/.../analyze` returns 503 | Train/export a model into `models/seizure_detector/versions/v1/` |
| 3 | `users.role` default applies to new rows only; legacy rows may lack profiles | Old test users have no role-specific profile | Re-register users or backfill |
| 4 | Patient `date_of_birth` placeholder = today at registration | Wrong DOB until user updates | Collect DOB during registration or update via profile endpoint |
| 5 | SMS OTP is a debug print | No real SMS | Swap in Twilio/Lifetimesms call in `services/user.py` |
| 6 | Frontend is an empty skeleton | No UI yet | Build M4 (React/Vite) mirroring BRANDING-SYSTEM-FRONTEND |
| 7 | Redis not installed in venv | Rate limiter always falls back to memory | Add `redis` package + Redis server |

---

## 18. Roadmap

Progress tracking lives in `progress.md`. Milestone summary:

| Milestone | Status |
| --- | --- |
| M1 — Architecture & guardrails | ✅ done (docs exist) |
| M2 — Backend & DB foundation | ✅ largely done (config, models, auth, migrations) |
| M3 — EEG upload → inference | ✅ backend done (pipeline + services + tests) |
| M4 — Core frontend (upload → result) | ⬜ not started (empty `frontend/`) |
| M5 — AI report + RAG chatbot | ⬜ planned (services stubs, no pgvector locally) |
| M6 — Medication, lifestyle, recommendations | ✅ done (all trackers, scheduling, and recommender built) |
| M7 — SOS + dashboard + background jobs | ✅ done (endpoints live, background tasks active) |
| M8 — Security, testing, deployment | ✅ done (all tests passing, Docker compose present) |

---

## 19. FAQ

**Q: Why is `role` a Postgres enum instead of a string?**
A: Enums give DB-level integrity (no invalid roles) and map cleanly to Python `str, Enum` for API validation.

**Q: Can one patient connect to many doctors?**
A: Yes — `patient_doctor_networks` is a junction table; multiple rows per patient are allowed.

**Q: Why can't a doctor log in right after registering?**
A: `is_pmdc_verified` defaults to `False`; an admin must set it to `True` using the Admin Dashboard API before login/approve flows unlock.

**Q: How do I get the OTP in development?**
A: If SMTP is configured, it's emailed; otherwise the server console prints `DEBUG (SMS Gateway Skipped): Sending OTP <code> ...` from `services/user.py`. When email settings are absent, `email.py` logs "Would have sent OTP ...".

**Q: What happens if I don't have Redis?**
A: Nothing breaks — the rate limiter logs a warning and uses the in-memory fallback.

**Q: Why is EEG analysis returning 503?**
A: The active model (`v1`) has no `model.onnx` artifact. Add one and it will load automatically.

**Q: Where do migrations get the database URL?**
A: From `backend/.env` → `DATABASE_URL`; `alembic/env.py` swaps `+asyncpg` → sync psycopg2 automatically.

**Q: Should I commit `.env`?**
A: No. It is gitignored and currently contains real credentials.

---

*Last updated: 2026-08-09 · See `progress.md` for the live milestone tracker.*