# EpiCare — Getting Started

## 1. Prerequisites

- Python 3.12+ 
- PostgreSQL 15 running locally on port 5432
- (Optional) Redis on 6379 — falls back to in-memory rate limiting
- Node.js 20+ for the frontend (not yet built)

## 2. Backend setup (Windows / PowerShell)

```powershell
# 1. Create venv + install deps
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 2. Configure environment
#    Edit backend\.env — at minimum DATABASE_URL, JWT_SECRET, MAIL_* values.
#    See docs/configuration.md for details.

# 3. Create the database + apply migrations
#    (create `EpiCare` in pgAdmin/psql if it doesn't exist)
.\.venv\Scripts\python.exe -m alembic upgrade head

# 4. Run the server
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Interactive API docs: **http://127.0.0.1:8000/docs**

## 3. Manual End-to-End Smoke Test

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
