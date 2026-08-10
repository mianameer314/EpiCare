# EpiCare — Configuration Reference

All settings live in `backend/app/core/config.py` (using `pydantic-settings`). They are overridden by values in `backend/.env`.

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

## Security & Env

- Secrets must only be provided via the environment (`.env` file). Never commit `.env` into source control.
- Only `.env.example` should be committed.
