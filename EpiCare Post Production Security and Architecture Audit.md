# EpiCare Post-Remediation Security and Architecture Audit

**Audit type:** Repeat production-grade review after Phase 0–4 remediation  
**Audit scope:** Backend, frontend, authentication, authorization, storage, uploads, SOS, RAG, VLM, deployment, migrations, tests, runtime configuration, and documentation claims  
**Prepared for:** Supervisor review and developer learning  
**Audit date:** 22 August 2026  
**Author:** Manus AI

> **Plain-language result:** The Phase 0–4 work fixed many of the original problems and the application now passes its current automated checks. It is significantly safer than before. However, several important issues remain before calling the system production-ready, especially around emergency-notification integrity, browser token storage, rate-limit fail-open behavior, dynamic execution of future AI files, and deployment health checks.

## 1. Executive Summary

### Overall security posture

**Post-remediation score: 6/10 — materially improved, but not yet production-ready for real clinical use.**

The score increased because the project now has server-side sessions, refresh-token rotation, replay detection, OTP lockout, production configuration checks, upload magic-byte validation, image re-encoding, restricted RAG upload access, prescriber-identity checks, safer certificate headers, trusted-proxy handling, CSP improvements, liveness/readiness probes, and a passing Phase 0–4 test suite.

The score is not higher because the web browser still keeps access and refresh tokens in `localStorage`, the sensitive rate limits still fall back to process-local memory when Redis is unavailable during startup, the SOS worker still has a second direct Firebase-send path that can duplicate notifications and mark delivery incorrectly, and future RAG/VLM Python files are dynamically executed from mutable filesystem locations. The Docker healthcheck also points to a route that does not exist.

### What Phase 0–4 successfully fixed

| Area | Verified result | Easy explanation |
|---|---|---|
| SOS fake-success states | Mostly fixed in provider classes | The system no longer automatically says “sent” just because a provider is configured incorrectly. |
| OTP security | Attempt counters, five-attempt lockout, rate limits, and no plaintext OTP logging | A person cannot try unlimited six-digit codes, and the code is no longer written into logs. |
| RAG upload access | Admin-only route | Patients and caretakers cannot upload documents into the shared knowledge corpus. |
| Medication prescriber forgery | Non-doctors cannot choose an arbitrary prescriber ID | A patient cannot pretend that a doctor prescribed a medicine. |
| Sessions | Database-backed sessions, refresh rotation, replay detection, revocation | Logout, password changes, and stolen refresh-token reuse can invalidate sessions server-side. |
| Uploads | Extension, size, magic-byte, EDF-header, and image re-encoding checks | A file called `photo.jpg` must actually be an allowed image, not a disguised executable. |
| Proxy/rate-limit identity | Trusted proxy settings were added | The application no longer blindly trusts any client-supplied `X-Forwarded-For` address. |
| Frontend quality gates | Current build and lint pass | The client compiles and lint reports zero warnings and zero errors. |
| Backend quality gates | Current compilation and test run pass | The backend compiles and the current full test command exits successfully. |

### Current verification evidence

| Check | Current result |
|---|---|
| Backend `compileall` | Passed, exit code 0 |
| Backend full pytest run | Passed, exit code 0; one Starlette/httpx deprecation warning |
| Frontend production build | Passed, 3,050 modules transformed |
| Frontend lint | Passed, 0 warnings and 0 errors |
| Alembic current/head | Both report `202608210002 (head)` |
| `git diff --check` | Passed, exit code 0 |
| Targeted residual scan | Confirmed remaining dynamic imports, browser token storage, permissive CSP, and Docker healthcheck mismatch |

### Important scope clarification

RAG and VLM are still not complete production AI implementations. The current RAG code stores and deduplicates documents but does not perform the complete extract–chunk–embed–retrieve–cite pipeline. The current VLM code has adapter discovery, but its default report is fixed placeholder content and any file in the VLM directory can make the system appear ready. These are both implementation gaps and security boundaries, not merely documentation tasks.

## 2. Critical & High-Severity Findings

### Finding 1 — Dynamic RAG and VLM Python files are executed from mutable filesystem paths

**Severity:** High  
**Category:** CWE-94 code execution; supply-chain risk; STRIDE tampering/elevation of privilege  
**Where:**

- `backend/app/services/chat.py:161-175`
- `backend/app/services/vlm_report.py:60-71`
- `backend/app/services/rag_ingestion.py:19-28`

**What is happening:** The application looks for `rag/scripts/query.py` or `models/vlm/inference.py`, imports the file dynamically, and executes its code with `exec_module`.

**Easy example:** If an attacker, compromised deployment process, writable mounted volume, or malicious future AI code drop can place a Python file in that directory, the backend will run the file with the same permissions as the API. That code could read database credentials, JWT secrets, patient data, or storage credentials.

**Why it matters:** A future AI integration has become a server-code execution boundary. The application is not only loading a model; it is executing arbitrary Python from a filesystem directory.

**Evidence:**

```python
# backend/app/services/chat.py:168-172
spec = importlib.util.spec_from_file_location("rag_query_module", str(query_script))
rag_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rag_module)
```

```python
# backend/app/services/vlm_report.py:63-67
spec = importlib.util.spec_from_file_location("vlm_inference_module", str(inference_script))
vlm_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vlm_module)
```

**Production remediation:** Do not execute files discovered at runtime. Package the approved adapter as an immutable Python module, validate a signed release manifest, or run the model in an isolated worker with no database or secret access.

```python
# Safer adapter registry: only import approved, packaged adapters.
from importlib import import_module
from typing import Callable

ALLOWED_ADAPTERS: dict[str, str] = {
    "rag_v1": "app.ai_adapters.rag_v1:answer_question",
    "vlm_v1": "app.ai_adapters.vlm_v1:generate_report",
}


def load_approved_adapter(name: str) -> Callable:
    target = ALLOWED_ADAPTERS.get(name)
    if not target:
        raise RuntimeError("Unknown AI adapter")
    module_name, function_name = target.split(":", 1)
    module = import_module(module_name)
    function = getattr(module, function_name, None)
    if not callable(function):
        raise RuntimeError("Approved adapter is invalid")
    return function
```

**Supervisor explanation:** “We fixed the AI integration boundary by preventing the server from running arbitrary files just because they appear in a folder. Approved model adapters should be packaged, reviewed, signed, or isolated.”

### Finding 2 — The web application still stores access and refresh bearer tokens in `localStorage`

**Severity:** High  
**Category:** OWASP session management; token theft after XSS; broken session architecture alignment  
**Where:**

- `frontend/src/api/client.ts:57-104,107-179,181-203`
- `frontend/src/providers/AuthProvider.tsx:25-45,49-70,80-95`
- `frontend/src/api/auth.ts:4-8`
- `backend/app/api/v1/auth.py:103-118,265-297`

**What is happening:** Phase 1 added HttpOnly refresh cookies and database-backed sessions, but the browser still receives the refresh token in JSON, stores both tokens in `localStorage`, and sends the refresh token as a bearer header.

**Easy example:** If a malicious script executes in the browser, it can run `localStorage.getItem('refresh_token')`, send the refresh token to an attacker, and use it to obtain new access tokens until the server detects or revokes the session.

**Evidence:**

```typescript
// frontend/src/api/client.ts:58,91-94
const refreshToken = localStorage.getItem('refresh_token');
localStorage.setItem('access_token', data.access_token);
localStorage.setItem('refresh_token', data.refresh_token);
```

```typescript
// frontend/src/providers/AuthProvider.tsx:87-90
const res = await apiClient.post('/auth/login', { email, password });
localStorage.setItem(TOKEN_KEY, res.access_token);
localStorage.setItem(REFRESH_KEY, res.refresh_token);
```

**Production remediation:** Use an HttpOnly, Secure, SameSite refresh cookie for browser sessions. Keep the short-lived access token in memory only, or use a backend-for-frontend pattern. Return refresh tokens in JSON only for explicitly separated non-browser clients.

```python
# Browser login response: set the refresh cookie, do not return refresh_token to the web client.
class BrowserTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/login/browser", response_model=BrowserTokenResponse)
async def browser_login(...):
    access_token, refresh_token, _ = await session_service.create_session(db, user, ...)
    response.set_cookie(
        key="epicare_refresh",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.JWT_REFRESH_EXPIRY_DAYS * 86400,
        path="/api/v1/auth",
    )
    return BrowserTokenResponse(access_token=access_token)
```

```typescript
// Browser client: send cookies automatically; keep only the access token in memory.
const response = await fetch(`${API_BASE}/auth/refresh`, {
  method: 'POST',
  credentials: 'include',
});
```

**Supervisor explanation:** “The backend session fix is real, but the web client still uses the old browser-token pattern. We need to finish the migration so JavaScript cannot read the long-lived refresh token.”

### Finding 3 — Sensitive rate limits still fail open when Redis is unavailable during startup

**Severity:** High  
**Category:** Brute-force protection bypass; distributed security-control failure  
**Where:** `backend/app/rate_limit/core.py:59-80,90-110`

**What is happening:** Sensitive presets are marked `fail_closed=True`, but if Redis fails during application startup, `init()` sets `_using_redis=False`. Later, `check()` skips the fail-closed branch and uses the local memory limiter.

**Easy example:** With three API replicas, an attacker can send five login attempts to each replica. The intended limit is not shared across replicas, so the attacker receives many more attempts than expected.

**Evidence:**

```python
# backend/app/rate_limit/core.py:75-80
self._redis = None
self._using_redis = False
logger.warning("Rate limiter: Redis unavailable ... using in-memory fallback")
```

```python
# backend/app/rate_limit/core.py:90-110
if self._using_redis and self._redis is not None:
    ...
elif fail_closed and self._using_redis:
    raise HTTPException(status_code=503, ...)
return self._memory.check(key, limit, window_seconds)
```

The condition `fail_closed and self._using_redis` can never be true after startup Redis failure because `_using_redis` is already `False`.

**Production remediation:** Track Redis health separately from whether a connection is currently active. For sensitive limits, raise 503 whenever the distributed backend is unavailable. Use memory fallback only for explicitly non-sensitive limits.

```python
class RateLimiter:
    def __init__(self, redis_url: str) -> None:
        self._redis_url = redis_url
        self._redis = None
        self._memory = MemoryRateLimiter()
        self._using_redis = False
        self._redis_unavailable = False

    async def init(self) -> None:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(self._redis_url, decode_responses=True)
            await client.ping()
            self._redis = client
            self._using_redis = True
            self._redis_unavailable = False
        except Exception:
            self._redis = None
            self._using_redis = False
            self._redis_unavailable = True

    async def check(self, key: str, limit: int, window_seconds: int, fail_closed: bool = False):
        if self._using_redis and self._redis is not None:
            try:
                return await self._check_redis(key, limit, window_seconds)
            except Exception:
                self._redis_unavailable = True
                if fail_closed:
                    raise HTTPException(status_code=503, detail="Rate limiter unavailable")
        if fail_closed and self._redis_unavailable:
            raise HTTPException(status_code=503, detail="Rate limiter unavailable")
        return self._memory.check(key, limit, window_seconds)
```

**Supervisor explanation:** “We added a fail-closed flag, but the startup outage path still turns it off accidentally. The fix is to remember that Redis is unavailable and reject sensitive requests instead of silently using per-process memory.”

### Finding 4 — SOS dispatch still has a second direct Firebase-send path

**Severity:** High  
**Category:** Emergency integrity, duplicate notification, incorrect completion state  
**Where:** `backend/app/api/v1/emergency.py:190-242,254-261`; provider abstraction in `backend/app/services/sos_provider.py:255-333`

**What is happening:** The emergency worker first calls the selected provider, then separately initializes Firebase and sends another push to caretakers. The fallback only skips when the earlier result is exactly `"SENT"`; it does not skip `"DELIVERED"`, and it writes raw `"SENT"` into the result map.

**Easy example:** The Firebase provider sends a push and returns `DELIVERED`. The emergency route does not recognize that as already sent because it checks only for `SENT`, so it sends a second push. Alternatively, a provider can report `NOT_CONFIGURED`, while the direct Firebase branch sends successfully and changes the overall event to `COMPLETED` outside the selected provider’s policy.

**Evidence:**

```python
# backend/app/api/v1/emergency.py:207-215
# Direct push notification fallback
if ensure_firebase_initialized():
    for ct in caretakers:
        if ct.fcm_token and delivery_results.get(f"caretaker_{ct.id}") != "SENT":
```

```python
# backend/app/api/v1/emergency.py:237-239
resp = fb_messaging.send(msg)
delivery_results[f"caretaker_{ct.id}"] = "SENT"
```

```python
# backend/app/api/v1/emergency.py:254-261
if any(s in ("SENT", "DELIVERED") for s in statuses):
    event.status = "COMPLETED"
else:
    event.status = "FAILED"
```

**Production remediation:** Delete the second dispatch path. The selected provider must own all sending, and the event must be completed only from normalized provider acknowledgements.

```python
# emergency.py — one dispatch pipeline only
provider = get_sos_provider()
delivery_results = await provider.send_sos_extended(
    contacts=contacts,
    caretakers=caretakers,
    event=event,
    patient_name=patient_name,
    patient_email=patient_user.email if patient_user else None,
)

successful = {
    DeliveryStatus.SENT,
    DeliveryStatus.DELIVERED,
}
confirmed = any(status in successful for status in delivery_results.values())
event.status = "COMPLETED" if confirmed else "FAILED"
```

**Supervisor explanation:** “Emergency messages must have one source of truth. We should never send once through the provider and then send again through a hidden fallback, because that can duplicate alerts or report the wrong delivery state.”

### Finding 5 — Firebase production validation accepts a default project ID without credentials

**Severity:** High  
**Category:** Fail-secure startup failure; emergency availability risk  
**Where:** `backend/app/core/config.py:87-97,145-170`

**What is happening:** `FIREBASE_PROJECT_ID` has a non-empty default value, and production validation accepts that project ID as sufficient Firebase configuration. A production deployment can therefore start without service-account JSON, valid credential path, or a proven workload-identity setup.

**Easy example:** Railway starts with `SOS_PROVIDER=firebase` and the default project ID, but Firebase Admin cannot initialize. The service is running, yet emergency push delivery is not actually ready.

**Evidence:**

```python
# backend/app/core/config.py:91
FIREBASE_PROJECT_ID: str = "epicare-2fc46"
```

```python
# backend/app/core/config.py:165-167
elif self.SOS_PROVIDER == "firebase":
    if not self.FIREBASE_CREDENTIALS_PATH and not self.FIREBASE_PROJECT_ID:
        raise ValueError("Firebase credentials are required ...")
```

**Production remediation:** Require explicit credential material or explicitly configured workload identity. Never treat a project identifier as an authentication credential.

```python
elif self.SOS_PROVIDER == "firebase":
    has_service_account = bool(self.FIREBASE_CREDENTIALS_JSON)
    has_credential_file = bool(self.FIREBASE_CREDENTIALS_PATH)
    has_workload_identity = self.APP_ENV == "production" and self.FIREBASE_USE_DEFAULT_CREDENTIALS
    if not (has_service_account or has_credential_file or has_workload_identity):
        raise ValueError(
            "Firebase requires service-account credentials or explicitly enabled workload identity"
        )
```

Add a startup probe that actually initializes Firebase and fails readiness when the selected emergency provider cannot send.

**Supervisor explanation:** “A project name tells us which Firebase project to use; it does not prove that the server can authenticate to Firebase. Production must check real credentials or a deliberate cloud identity.”

## 3. Medium & Low-Severity Findings

### Finding 6 — Docker healthcheck probes a route that does not exist

**Severity:** Medium  
**Where:** `backend/Dockerfile:31-33`; `backend/app/main.py:254-267`

**What is happening:** The Docker image checks `/healthz`, but the application exposes `/livez` and `/readyz`, not `/healthz`.

**Easy example:** The API may be working, but Docker or Railway receives a 404 from `/healthz` and marks the container unhealthy or restarts it.

**Fix:** Point the healthcheck to the actual liveness route.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:8000/livez || exit 1
```

Use `/readyz` for traffic routing only when the deployment platform supports readiness semantics separately.

### Finding 7 — `/auth/me` and profile-photo upload responses still expose internal storage keys

**Severity:** Medium  
**Where:** `backend/app/schemas/user.py:123-139`; `backend/app/api/v1/users.py:28-51`; `backend/app/api/v1/auth.py:327-338`

**What is happening:** `UserOut` includes `profile_photo_path` and `profile_photo_mime_type`. The authenticated `/auth/me` endpoint and upload response serialize this schema.

**Easy example:** A user receives a backend object key such as `user-profile/<uuid>.jpg`. The key may reveal storage layout and becomes an unnecessary internal implementation detail in the public API contract.

**Fix:** Remove raw paths from `UserOut` and expose only availability and an authenticated route.

```python
class UserOut(StrictModel):
    id: int
    email: EmailStr
    phone_number: str | None
    full_name: str
    profile_photo_available: bool = False
    profile_photo_url: str | None = None
    role: StrictUserRole
    is_active: bool
    is_email_verified: bool
    is_phone_verified: bool
    created_at: StrictDatetime
    updated_at: StrictDatetime
```

Construct `profile_photo_url` server-side as `/api/v1/users/me/profile-photo`; never serialize `profile_photo_path`.

### Finding 8 — VLM readiness is triggered by any file and reports fixed placeholder findings

**Severity:** Medium  
**Where:** `backend/app/services/vlm_report.py:27-58,60-82`

**What is happening:** Any file in `models/vlm` can make `is_model_trained` true. If no valid `generate_report` function exists, the service persists fixed report content such as “Frontal/temporal transient epileptiform activity reviewed.”

**Easy example:** Someone places a README or checksum file in the folder. The API now behaves as if a VLM exists and stores a clinical-looking report even though no actual vision model ran.

**Fix:** Require a manifest, model hash, adapter version, and validated callable. If no model is available, return 503 and do not persist a report.

```python
manifest_path = VLM_MODEL_DIR / "manifest.json"
if not manifest_path.is_file():
    raise HTTPException(status_code=503, detail={"code": "MODEL_NOT_TRAINED"})

manifest = json.loads(manifest_path.read_text())
required = {"model_sha256", "adapter", "version"}
if not required.issubset(manifest):
    raise HTTPException(status_code=503, detail={"code": "MODEL_NOT_TRAINED"})

adapter = load_approved_adapter(manifest["adapter"])
report_json = adapter(prediction_id)
validate_report_schema(report_json)
```

### Finding 9 — RAG documents are marked `INGESTED` without actual ingestion

**Severity:** Medium  
**Where:** `backend/app/services/rag_ingestion.py:31-83`

**What is happening:** The service reads the file, hashes it, deduplicates it, stores the bytes, and marks it `INGESTED` when any `.py` or `.sh` file exists in `rag/scripts`. It does not extract text, clean it, chunk it, create embeddings, write vectors, retrieve passages, or generate citations.

**Easy example:** An administrator uploads a medical PDF and sees `INGESTED`, but the chatbot may still have no searchable text from that PDF.

**Fix:** Introduce separate states: `UPLOADED`, `EXTRACTING`, `CHUNKED`, `EMBEDDED`, `READY`, `FAILED`. Set `READY` only after all pipeline stages commit successfully.

```python
class RagStatus(StrEnum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    READY = "READY"
    FAILED = "FAILED"

# Only set READY after actual vector persistence.
doc.status = RagStatus.PROCESSING
await db.commit()
try:
    text = extract_document_text(data, filename)
    chunks = chunk_text(text)
    vectors = await embed_chunks(chunks)
    await persist_vectors(db, doc.id, chunks, vectors)
    doc.status = RagStatus.READY
except Exception:
    doc.status = RagStatus.FAILED
    raise
finally:
    await db.commit()
```

### Finding 10 — Large uploads are read fully into memory before size rejection

**Severity:** Medium  
**Where:** `backend/app/services/rag_ingestion.py:37-43`; `backend/app/services/storage/validator.py:118-130,186-194`

**What is happening:** The code calls `await file.read()` and only then checks the size.

**Easy example:** Ten concurrent 200 MB EEG uploads can require roughly 2 GB of memory before the application rejects or processes them.

**Fix:** Stream in bounded chunks and stop as soon as the configured limit is exceeded.

```python
async def read_limited_upload(file: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail="Uploaded file is too large")
        chunks.append(chunk)
    return b"".join(chunks)
```

For very large files, stream directly to temporary storage and hash incrementally instead of joining all chunks in memory.

### Finding 11 — CSP still permits unsafe inline scripts/styles and remote script trust

**Severity:** Medium  
**Where:** `backend/app/middleware/security_headers.py:19-29`; `frontend/src/services/firebase.ts:58-59`; `frontend/public/firebase-messaging-sw.js:6-7`

**What is happening:** CSP includes `'unsafe-inline'`, `cdn.jsdelivr.net`, and the frontend/service worker dynamically loads Firebase scripts from `gstatic.com`.

**Easy example:** If an XSS bug appears, `unsafe-inline` reduces the browser’s ability to block injected inline code. A compromised third-party script can also execute with the application’s page privileges.

**Fix:** Bundle Firebase dependencies locally where possible, remove `unsafe-inline`, use nonces/hashes for unavoidable inline code, and restrict `script-src` to approved origins.

```python
"Content-Security-Policy": (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data: blob:; "
    "font-src 'self'; "
    "connect-src 'self' https://firebase.googleapis.com https://fcm.googleapis.com; "
    "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
)
```

Test the policy in report-only mode before enforcement to identify required legitimate sources.

### Finding 12 — FCM diagnostic returns unnecessary identity information

**Severity:** Low/Medium  
**Where:** `backend/app/api/v1/emergency.py:324-378`, especially `365-372`

**What is happening:** The diagnostic response still returns the patient name, patient token presence, and caretaker names.

**Easy example:** A monitoring or support tool that only needs to know whether push is ready receives names it does not need.

**Fix:** Return only readiness booleans and counts, or make the endpoint admin-only.

```python
return {
    "firebase_admin_initialized": fb_ready,
    "push_ready": push_ready,
    "connected_caretaker_count": len(caretaker_info),
    "caretakers_with_tokens": sum(1 for item in caretaker_info if item["has_fcm_token"]),
}
```

### Finding 13 — Readiness returns 200 while rate limiting or model loading is degraded

**Severity:** Medium  
**Where:** `backend/app/main.py:266-323`; `backend/app/api/v1/system.py:17-50`

**What is happening:** `/readyz` fails closed for database/storage but reports Redis as degraded and model loading as unavailable while still returning success if the database and storage are healthy. `/system/health` also reports healthy whenever the database is connected, even if Redis is unavailable.

**Easy example:** A deployment platform routes users to an instance where login protection is not distributed or the seizure model is not loaded because the readiness probe says the instance is ready.

**Fix:** Make critical dependencies configurable per deployment profile and return 503 when a dependency required for that profile is unavailable.

```python
critical = {"database", "storage"}
if settings.REQUIRE_REDIS_FOR_AUTH:
    critical.add("rate_limiter")
if settings.REQUIRE_MODEL_FOR_EEG:
    critical.add("model_loader")

is_ready = all(components[name]["status"] in {"ready", "connected"} for name in critical)
response.status_code = 200 if is_ready else 503
```

### Finding 14 — Invalid or foreign chat session IDs silently create new sessions

**Severity:** Low/Medium  
**Where:** `backend/app/api/v1/chat.py:228-245`

**What is happening:** If a caller supplies a session ID that does not exist or belongs to another user, the endpoint silently creates a new session instead of returning an error.

**Easy example:** A typo in `session_id=999` creates an unexpected new conversation. A tampered foreign ID is hidden instead of being logged and rejected.

**Fix:** Create a new session only when `session_id` is omitted. Return 404 when a supplied ID is not owned by the caller.

```python
if payload.session_id is not None:
    chat_session = await get_owned_session(db, current_user.id, payload.session_id)
    if chat_session is None:
        raise HTTPException(status_code=404, detail="Chat session not found")
else:
    chat_session = await create_chat_session_for_user(db, current_user.id, payload.content)
```

### Finding 15 — SOS email HTML and logs use personal values without full escaping/redaction

**Severity:** Medium  
**Where:** `backend/app/services/sos_provider.py:96-176,234-245,312-318,367-370,434-449`; `backend/app/schemas/user.py:31-42`

**What is happening:** Patient names and location values are interpolated into HTML, and provider logs include recipient names, email addresses, and phone numbers. Names are length-bounded but not restricted to safe HTML characters.

**Easy example:** A name containing HTML markup can alter the emergency email. Logs containing phone numbers and email addresses increase exposure if logs are accessed by a broader team.

**Fix:** Escape all HTML values, validate coordinates as numeric ranges, and redact contact data in logs.

```python
from html import escape

safe_name = escape(patient_name, quote=True)
if not (-90 <= event.latitude <= 90 and -180 <= event.longitude <= 180):
    location_url = None
else:
    location_url = f"https://maps.google.com/?q={event.latitude},{event.longitude}"

logger.info(
    "sos_delivery_completed",
    extra={"event_id": event.id, "recipient_type": "caretaker"},
)
```

### Finding 16 — Database migrations run inside every web replica’s startup command

**Severity:** Medium operational risk  
**Where:** `backend/Dockerfile:38-39`

**What is happening:** Every application container executes `alembic upgrade head` before starting Uvicorn.

**Easy example:** During a rolling deployment, several replicas can try to migrate at the same time. If a migration takes a long time or fails, web startup is coupled to schema mutation and all replicas may remain unavailable.

**Fix:** Run migrations as a one-time deployment job or release phase, then start the web process separately.

```dockerfile
# Dockerfile: only start the web process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# Deployment pipeline concept
release:
  command: PYTHONPATH=. alembic upgrade head
web:
  command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Finding 17 — Session logout depends on decoding the access token rather than the session cookie

**Severity:** Low/Medium  
**Where:** `backend/app/api/v1/auth.py:309-323`

**What is happening:** Logout revokes the session only if it can derive `sid` from the access-token Authorization header. A browser using only the refresh cookie may clear the cookie but leave the server session active until expiry.

**Easy example:** A user clicks logout from a cookie-based browser session. The cookie disappears locally, but the server-side session may remain active and can be reused if the refresh cookie was copied elsewhere.

**Fix:** Decode the refresh cookie, verify it against the session, revoke that session, and clear the cookie regardless of access-header presence.

```python
refresh = request.cookies.get("epicare_refresh")
if refresh:
    payload = decode_token(refresh)
    sid = payload.get("sid")
    if sid:
        await session_service.revoke_session(db, sid)
response.delete_cookie("epicare_refresh", path="/api/v1/auth")
```

### Finding 18 — Current tests do not cover several important residual paths

**Severity:** Low/Medium  
**Where:** Phase test files under `backend/tests/`

**What is happening:** The Phase 0–4 tests verify many fixes, but the current test set does not demonstrate coverage for browser cookie-only sessions, Docker `/healthz`, Redis unavailable at startup with `fail_closed=True`, duplicate SOS dispatch, VLM stray-file readiness, raw `UserOut` storage-key exposure, dynamic adapter trust, or upload memory limits.

**Fix:** Add regression tests before production sign-off.

```python
@pytest.mark.asyncio
async def test_sensitive_rate_limit_fails_closed_when_redis_unavailable():
    limiter = RateLimiter("redis://unavailable")
    await limiter.init()
    with pytest.raises(HTTPException) as exc:
        await limiter.check("login:ip", 5, 600, fail_closed=True)
    assert exc.value.status_code == 503


def test_docker_healthcheck_uses_existing_probe():
    dockerfile = Path("backend/Dockerfile").read_text()
    assert "/livez" in dockerfile
    assert "/healthz" not in dockerfile
```

## 4. Deprecations & Technical Debt

### 4.1 Starlette/httpx test-client deprecation warning

The current backend test run passes but emits a deprecation warning from the installed Starlette/httpx combination. Align compatible versions or migrate tests to the supported client API before the next dependency upgrade.

### 4.2 Dual browser/API token contract

The API returns refresh tokens in JSON while also setting an HttpOnly cookie. This makes it difficult to guarantee that browser clients use the safer path. Split browser and non-browser authentication contracts or explicitly document and enforce separate clients.

### 4.3 Mutable filesystem model and RAG directories

`chat.py`, `rag_ingestion.py`, and `vlm_report.py` create AI directories during import. This hides packaging errors and makes runtime filesystem state part of the application’s code path. Prefer immutable deployment artifacts and explicit startup validation.

### 4.4 RAG and VLM are still future implementations

The repository now has safer boundaries and graceful unavailable states, but not production RAG/VLM capability. The next AI milestone should include:

- Approved document formats and extraction library.
- OCR policy for scanned PDFs.
- Chunking and metadata strategy.
- Embedding model and vector dimension compatibility.
- Tenant/document ACLs.
- Retrieval filters and citation provenance.
- Prompt-injection defenses for retrieved documents.
- VLM model manifest, checksum, versioning, input schema, output schema, and clinical validation.
- Offline evaluation fixtures and human review workflow.

### 4.5 Emergency provider configuration and delivery semantics

The provider classes now distinguish `NOT_CONFIGURED`, `FAILED`, `NO_DESTINATION`, and successful states, which is good. The remaining architecture debt is the duplicate dispatch path and lack of a durable, provider-neutral delivery event/outbox. A production emergency system should use an outbox or queue, idempotency key, provider message ID, retry policy, and reconciliation worker.

### 4.6 Deployment configuration should be explicit

`APP_ENV`, JWT secrets, CORS origins, Firebase credentials, Redis, object storage, email transport, and model artifacts should be validated in a deployment-specific configuration checklist. A service should not report “ready” merely because the database is reachable when critical clinical features are unavailable.

### 4.7 Content Security Policy should be enforced from the frontend deployment boundary

The backend API middleware sets security headers, but the deployed frontend needs equivalent headers from its static host or reverse proxy. Confirm that CSP, HSTS, `Permissions-Policy`, and cache rules are present on the actual browser-served origin, not only on API responses.

### 4.8 PII and PHI logging policy

Create a documented logging policy that forbids recipient email, phone numbers, raw tokens, patient names, location coordinates, certificate paths, and clinical payloads in ordinary application logs. Use event IDs and redacted structured fields.

## 5. Prioritized Remediation Roadmap

### Step 1 — Fix emergency notification integrity before real-user testing

Remove the direct Firebase fallback from `emergency.py`, keep one provider-owned dispatch path, normalize all delivery statuses through one enum, add idempotency keys, and require real Firebase credentials or explicit workload identity. Add tests for successful, failed, unconfigured, duplicate, and partial-delivery cases.

**Supervisor wording:** “Emergency actions must be trustworthy. The system should say completed only when a real provider confirms delivery, and it must never send the same alert twice because two code paths handled it.”

### Step 2 — Finish the browser session migration

Stop returning refresh tokens to browser clients, remove refresh-token storage from `localStorage`, use `credentials: 'include'`, revoke the cookie-derived session during logout, and add CSRF protection for cookie-authenticated state-changing routes where required by the deployment model.

**Supervisor wording:** “The server session architecture is implemented, but the browser still uses the old token-storage behavior. This step completes the security migration.”

### Step 3 — Make sensitive rate limits truly fail closed

Correct the Redis startup-outage state machine, fail closed for login/OTP/refresh/register/SOS when Redis is required, and add a multi-worker or Redis-unavailable regression test.

### Step 4 — Remove runtime execution of arbitrary future AI files

Replace `spec_from_file_location` and `exec_module` with a signed, allowlisted adapter registry or an isolated AI worker. Do not treat a folder containing any file as model readiness.

### Step 5 — Correct deployment health and readiness

Change the Docker healthcheck from `/healthz` to `/livez`. Define which dependencies are critical for each deployment profile and make `/readyz` return 503 when required auth, storage, emergency, or EEG dependencies are unavailable.

### Step 6 — Remove internal storage paths from API schemas

Update `UserOut`, upload responses, and `/auth/me` to expose only safe availability flags and authenticated endpoint URLs.

### Step 7 — Finish real RAG and VLM implementation safely

For RAG, implement extraction, chunking, embeddings, vector persistence, ACL filters, retrieval, citations, and evaluation. For VLM, implement a versioned model manifest, safe adapter loading, input validation, output schema validation, provenance, and human clinical review. Do not persist clinical-looking placeholder reports as if a model ran.

### Step 8 — Reduce memory pressure and protect operational reliability

Stream uploads, enforce size limits before buffering, add background job limits, use an outbox for emergency delivery, and move Alembic migrations to a release job instead of every web replica.

### Step 9 — Complete residual privacy and browser-boundary hardening

Remove unnecessary names from FCM diagnostics, escape SOS HTML values, redact personal data from provider logs, tighten CSP, bundle or pin Firebase scripts, and verify headers on the real deployed frontend origin.

### Step 10 — Add the missing regression tests and repeat the audit

Add tests for every finding in this report. Require the following release gates:

| Gate | Required result |
|---|---|
| Backend compile | Exit code 0 |
| Full backend tests | 100% pass, warnings reviewed |
| Frontend build | Exit code 0 |
| Frontend lint | 0 errors; warnings reviewed or 0 warnings |
| Migration check | One expected head; upgrade tested on a copy/staging database |
| Sensitive rate-limit outage test | 503/fail-closed behavior verified |
| Cookie-only browser auth test | Refresh and logout work without localStorage refresh tokens |
| SOS delivery test | No duplicate sends; status matches provider result |
| AI adapter trust test | Unapproved files are never executed |
| Container healthcheck | Existing liveness route returns 200 |
| PHI/secret scan | No raw tokens, secrets, or unnecessary identifiers in logs/responses |

### Final supervisor-ready statement

> “Across Phases 0–4, we implemented and tested major security and quality controls: OTP lockout, server-side sessions, refresh-token rotation, upload magic-byte validation, image sanitization, role and prescriber authorization, RAG upload restriction, proxy-aware rate limiting, hardened headers, liveness/readiness probes, frontend zero-warning linting, build optimization, and regression tests. The repeat audit confirms those improvements are real. The remaining production blockers are concentrated in emergency-delivery integrity, completing the browser cookie migration, true fail-closed distributed rate limiting, safe AI adapter loading, accurate deployment health checks, and the unfinished RAG/VLM pipelines.”

## References

[1]: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html "OWASP Session Management Cheat Sheet"

[2]: https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html "OWASP Content Security Policy Cheat Sheet"

[3]: https://cwe.mitre.org/data/definitions/94.html "CWE-94: Improper Control of Generation of Code"

[4]: https://owasp.org/Top10/ "OWASP Top 10"
