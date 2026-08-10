# EpiCare — Testing Guide

## 1. Test Layout

The backend tests are located in `backend/tests/`. They use Pytest and an isolated testing database.

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

## 2. Running the suite

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

The suite expects a local Postgres (used by `tests/conftest.py` → `epicare_test` DB). Create it if missing:

```powershell
psql -U postgres -c "CREATE ROLE epicare WITH LOGIN PASSWORD 'epicare' CREATEDB;"
psql -U postgres -c "CREATE DATABASE epicare_test OWNER epicare;"
```

## 3. Current Status

The test suite covers the new RBAC architecture, OTP verification, robust profile validation, connection requests between patients and doctors, the entire EEG processing pipeline, and the comprehensive Admin Dashboard operations.

All tests are expected to pass successfully on the current main branch.
