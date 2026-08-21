# EpiCare Production Security and Architecture Audit

**Audit role:** Principal Application Security Engineer, Lead Code Auditor, Senior Software Architect  
**Audit date:** 21 August 2026  
**Scope:** Entire tracked EpiCare workspace, including FastAPI backend, React frontend, database models and migrations, storage, ML artifacts, RAG/VLM boundaries, deployment files, tests, configuration, and maintained documentation.

## 1. Executive Summary

### Overall security posture: **4/10 — not production-ready for emergency and authentication use**

EpiCare has a coherent full-stack architecture with meaningful ownership checks, role guards, typed request schemas, additive migrations, a working ONNX serving package, a functional React application, and a passing backend test suite. The codebase is not superficial: most core product workflows are implemented and the principal data paths are identifiable.

The production security posture is nevertheless materially weakened by authentication hardening gaps, false-positive emergency-delivery semantics, fail-open infrastructure defaults, an unprotected RAG corpus upload route, browser-persistent bearer tokens, and a clinical chatbot that returns deterministic medical guidance rather than grounded retrieval. The most serious concern is integrity: the SOS workflow can persist `SENT` and `COMPLETED` even when no downstream alert was delivered.

| Dimension | Assessment |
|---|---|
| Architecture health | **6/10** — modular and understandable, but several boundaries are fail-open and provider readiness is not enforced |
| Authentication/session security | **3/10** — JWT type checks exist, but OTP brute force, token persistence, missing revocation, and plaintext OTP logging remain |
| Authorization/data isolation | **6/10** — most clinical routes use ownership/connection dependencies, but RAG upload and medication attribution have concrete boundary flaws |
| Emergency integrity | **2/10** — delivery status can be fabricated and event completion is unconditional |
| Input/file safety | **5/10** — schemas and path-safe storage exist, but content validation is extension/MIME based and some fields are unbounded |
| Operational readiness | **4/10** — startup is deliberately fail-open, provider configuration is optional, and deployment defaults are development-oriented |
| Verification | **7/10** — backend compilation and pytest pass; frontend build passes; lint exits successfully with warnings |

The audit used STRIDE and data-flow reasoning across the principal boundaries: browser to API, API to database, API to storage, API to model/runtime, API to email/SMS/Firebase, and authenticated role-to-role clinical access.

## 2. Critical & High-Severity Findings

### 1. Critical — SOS delivery can be reported as successful without delivery

**File paths and lines:** `backend/app/services/sos_provider.py:167-185,254-259,313-318,349-353,406-410`; `backend/app/api/v1/emergency.py:244-256`.

**Threat description:** Multiple provider branches convert missing configuration, unimplemented providers, or missing delivery results into `SENT`. Firebase marks caretakers as sent when Firebase is not initialized, marks every emergency contact as sent without contacting them, and discards the email fallback result. WhatsApp and Twilio mark messages as sent when credentials are absent. The background processor defaults missing contact results to `SENT` and unconditionally marks the SOS event `COMPLETED`.

**Impact:** A patient or caretaker can receive a successful-looking SOS status while no emergency channel was contacted. This is a safety-critical integrity failure and can delay real-world assistance.

**Production remediation:** Provider methods must return explicit states such as `DELIVERED`, `FAILED`, `NOT_CONFIGURED`, or `NOT_ATTEMPTED`; the orchestration layer must derive the event status from actual results and never synthesize success.

```python
# backend/app/services/sos_provider.py
from enum import StrEnum

class DeliveryStatus(StrEnum):
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    NO_DESTINATION = "NO_DESTINATION"

if not token or not phone_id:
    logger.error("WhatsApp is not configured; no message was sent")
    results[key] = DeliveryStatus.NOT_CONFIGURED
    continue
```

```python
# backend/app/api/v1/emergency.py
statuses = list(delivery_results.values())
if any(value == "DELIVERED" for value in statuses):
    event.status = "COMPLETED"
else:
    event.status = "FAILED"

for contact in contacts:
    delivery_status = delivery_results.get(
        f"contact_{contact.id}", "NOT_ATTEMPTED"
    )
    db.add(SosDelivery(
        sos_event_id=event.id,
        contact_id=contact.id,
        delivery_status=delivery_status,
    ))
```

A deployment readiness check should reject `SOS_PROVIDER=firebase|twilio|whatsapp` when its credentials are absent. Unit tests must assert that missing credentials never produce `SENT` or `COMPLETED`.

### 2. High — Six-digit OTP and password-reset verification are not rate-limited

**File paths and lines:** `backend/app/api/v1/auth.py:109-137,188-231`; `backend/app/schemas/user.py:81-85,104-116`; `backend/app/rate_limit/__init__.py:12-24`; `backend/app/services/user.py:127-143,237-270`.

**Threat description:** Email verification, reset-OTP verification, and password reset have no dedicated rate-limit dependency. The OTP is six digits and the reset verification endpoint checks validity without consuming the code. There is no per-account attempt counter, lockout, or atomic failure budget.

**Impact:** An attacker who knows an email address can perform unlimited online OTP guesses. A successful reset-OTP guess enables password takeover. The reset OTP remains reusable until the password-reset request consumes it.

**Production remediation:** Add per-IP and per-account limits, consume or bind reset challenges atomically, and store a server-side challenge record with attempt count and lockout time.

```python
# backend/app/models/otp_challenge.py
class OtpChallenge(Base):
    __tablename__ = "otp_challenges"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(32))
    secret_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

```python
# backend/app/api/v1/auth.py
OTP_LIMIT = RateLimit(prefix="otp", limit=5, window_seconds=600)

@router.post("/verify-reset-otp", dependencies=[Depends(OTP_LIMIT)])
async def verify_reset_otp(data: VerifyResetOTPRequest, db: DbDep):
    challenge = await otp_service.verify(
        db, email=data.email, purpose="PASSWORD_RESET", otp=data.otp
    )
    if not challenge:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    return {"message": "OTP is valid", "reset_token": challenge.reset_token}
```

The reset endpoint should accept a short-lived one-time reset token rather than email plus OTP again.

### 3. High — Plaintext OTPs are written to logs when email delivery is unavailable

**File path and lines:** `backend/app/services/email.py:167-171`.

**Threat description:** The no-transport branch logs the complete OTP and recipient email using `Would have sent OTP {otp} to {email}`.

**Impact:** Anyone with application-log, centralized-log, or support-log access can complete email verification or reset a password. Logs become an authentication-secret datastore.

**Production remediation:** Fail the operation as undelivered, emit only a correlation ID, and never log OTP values.

```python
if not sent:
    logger.error(
        "verification_email_delivery_failed",
        extra={"recipient_domain": email.split("@")[-1], "request_id": get_request_id()},
    )
    raise EmailDeliveryError("Verification email could not be delivered")
```

### 4. High — Browser localStorage bearer tokens plus non-revocable refresh tokens

**File paths and lines:** `frontend/src/api/client.ts:57-104,107-158,181-203`; `frontend/src/providers/AuthProvider.tsx:25-46,86-105`; `backend/app/core/security.py:30-51`; `backend/app/api/v1/auth.py:234-263`.

**Threat description:** Access and refresh JWTs are persisted in `localStorage`. The backend issues stateless tokens containing only `sub`, `exp`, and `type`, with no `jti`, token version, or server-side session record. Logout only acknowledges intent; refresh-token reuse remains valid until expiry.

**Impact:** Any same-origin XSS, compromised dependency, browser extension, or injected script can exfiltrate both tokens. A stolen refresh token can mint new access tokens for up to seven days. Logout does not invalidate tokens on other devices.

**Production remediation:** Prefer an HttpOnly, Secure, SameSite refresh cookie; keep the access token in memory; rotate refresh tokens and persist a hashed session identifier with revocation and reuse detection.

```python
# backend/app/core/security.py
import uuid

def create_refresh_token(subject: str, session_id: int, expires_delta=None) -> str:
    expires = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.JWT_REFRESH_EXPIRY_DAYS)
    )
    return jwt.encode(
        {"sub": subject, "sid": str(session_id), "jti": uuid.uuid4().hex,
         "exp": expires, "type": "refresh", "iss": settings.JWT_ISSUER,
         "aud": settings.JWT_AUDIENCE},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
```

```python
# backend/app/api/v1/auth.py
@router.post("/logout", status_code=204)
async def logout(current_user: CurrentUser, db: DbDep, response: Response):
    await session_service.revoke_current_session(db, current_user.id)
    response.delete_cookie("epicare_refresh", httponly=True, secure=True, samesite="lax")
```

If localStorage must remain temporarily, enforce a short access-token lifetime, rotate refresh tokens, add a server-side revocation check, and remove all token values from client logs and error telemetry.

### 5. High — Any authenticated user can upload to the shared RAG corpus

**File paths and lines:** `backend/app/api/v1/rag.py:9-31`; `backend/app/services/rag_ingestion.py:16-56`.

**Threat description:** The route description calls itself an admin endpoint, but the function depends only on `CurrentUser`. The source contains an explicit comment at line 20 that an admin check may be needed. The ingestion service stores a fake path and checksum and writes directly into the shared `RagDocument` model.

**Impact:** Any authenticated patient, caretaker, or doctor can create corpus entries and, once retrieval is implemented, poison clinical context for other users. This is a broken-access-control and AI-integrity issue.

**Production remediation:** Restrict ingestion to administrators or a dedicated curator role, validate and quarantine files, compute a real checksum, and keep corpus documents separate from user uploads.

```python
# backend/app/api/v1/rag.py
from app.api.deps import RoleChecker
from app.models.enums import UserRole

RequireRagCurator = Depends(RoleChecker([UserRole.ADMIN]))

@router.post("/upload-document", dependencies=[RequireRagCurator])
async def upload_rag_document(
    current_user: CurrentUser,
    db: DbDep,
    file: UploadFile = File(...),
):
    return await rag_service.ingest_curated_document(db, file, current_user.id)
```

### 6. High — Caretakers can forge doctor attribution on medication records

**File paths and lines:** `backend/app/api/v1/medications.py:310-335`; `backend/app/schemas/medication.py:10-23`; `backend/app/api/deps.py:300-328`.

**Threat description:** The prescription target dependency permits caretakers. In `create_medication`, doctors are assigned as prescribers when the caller is a doctor, but non-doctors can supply arbitrary `prescribed_by_doctor_id` and have it persisted at lines 319-320.

**Impact:** A caretaker can create a medication record that appears to have been prescribed by an unrelated doctor. This undermines clinical audit trails and can mislead patients and clinicians.

**Production remediation:** Remove `prescribed_by_doctor_id` from the public create payload. Only a verified doctor can set it to their own ID. If caretaker proxy medication creation is intended, store `entered_by_user_id` and a separate `prescriber_id` that must already exist in an approved prescription.

```python
# backend/app/api/v1/medications.py
if current_user.role == UserRole.DOCTOR:
    await require_verified_doctor(db, current_user.id)
    prescriber_id = current_user.id
else:
    prescriber_id = None

if med_in.prescribed_by_doctor_id is not None and current_user.role != UserRole.DOCTOR:
    raise HTTPException(
        status_code=403,
        detail="Only a verified doctor may assign a prescriber",
    )
```

### 7. High — Rate limiting can be bypassed through spoofed proxy headers and process-local fallback

**File paths and lines:** `backend/app/rate_limit/dependencies.py:22-37`; `backend/app/rate_limit/core.py:59-96`.

**Threat description:** The limiter trusts the first `X-Forwarded-For` value without proving the request came through a trusted reverse proxy. When Redis fails, the limiter silently falls back to an in-memory limiter, which is not shared between workers or instances.

**Impact:** Attackers can rotate a spoofed identity or distribute requests across workers to evade login, OTP, and SOS limits. Redis outages weaken security exactly when operational instability is highest.

**Production remediation:** Use the platform’s trusted proxy configuration, derive client identity only from trusted proxy metadata, and fail closed for authentication-sensitive limiters when the shared store is unavailable.

```python
# backend/app/rate_limit/dependencies.py
client_ip = request.client.host if request.client else "unknown"
if settings.TRUST_PROXY_HEADERS and client_ip in settings.TRUSTED_PROXY_IPS:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
```

```python
# backend/app/rate_limit/core.py
if self._using_redis and self._redis is None:
    raise RateLimitUnavailable("Shared rate limiter is unavailable")
```

For public analytics-only endpoints, a memory fallback may be acceptable; it is not acceptable for login, OTP, password reset, or SOS controls.

### 8. High — Production security configuration is optional and startup fails open

**File paths and lines:** `backend/app/core/config.py:13-30,41-68,78-129,136-143`; `backend/app/main.py:54-94`; `docker-compose.yml:7-11,20-30,35-45`; `backend/Dockerfile:38-39`.

**Threat description:** The settings object permits empty JWT secret, database URL, storage provider, admin key, and provider credentials. The application catches DB, Redis, model, scheduler, and vector warm-up failures and still starts. Compose uses fixed database credentials, publishes services, and runs Uvicorn with reload. The container performs migrations during every startup.

**Impact:** A misconfigured deployment may run with an empty/weak secret, disabled rate limiting, unavailable persistence, or missing emergency/model dependencies while appearing healthy. Startup migrations can race across replicas and make rollback unsafe.

**Production remediation:** Add an environment-aware validator, separate liveness/readiness, remove development defaults from production images, run migrations as a deployment job, and use secrets management.

```python
# backend/app/core/config.py
from pydantic import model_validator

@model_validator(mode="after")
def validate_production(self):
    if self.APP_ENV == "production":
        if len(self.JWT_SECRET) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters in production")
        if self.DEBUG:
            raise ValueError("DEBUG must be false in production")
        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL is required in production")
        if not self.CORS_ORIGINS or "localhost" in self.CORS_ORIGINS:
            raise ValueError("Production CORS_ORIGINS must be explicit")
        if self.SOS_PROVIDER != "email" and not provider_credentials_present(self):
            raise ValueError("Selected SOS provider is not configured")
    return self
```

```python
# backend/app/main.py
@app.get("/livez")
async def livez():
    return {"status": "alive"}

@app.get("/readyz")
async def readyz():
    if not readiness_registry.all_required_dependencies_ready():
        raise HTTPException(status_code=503, detail="Service not ready")
    return {"status": "ready"}
```

### 9. High — RAG ingestion uses a non-portable hardcoded filesystem path and fake persistence

**File paths and lines:** `backend/app/services/rag_ingestion.py:12-13,23-31,37-56`.

**Threat description:** Readiness is determined using `Path("E:/BS_INTERN/EpiCare/rag/scripts")`, which is a developer workstation path and cannot work in Linux/Railway. Uploaded document bytes are not stored; `source_path` and `checksum` are fabricated.

**Impact:** The service can report an uploaded document while no recoverable source exists, and production deployments can silently remain in a pending state. Once retrieval is added, fake paths and checksums undermine provenance and deletion workflows.

**Production remediation:** Use configured storage, generate UUID object keys, compute SHA-256 from bytes, persist MIME/size/uploader metadata, and use an importable adapter or configured module path.

```python
# backend/app/services/rag_ingestion.py
async def ingest_document(db, file, uploader_id):
    data = await read_bounded_upload(file, max_bytes=settings.RAG_MAX_DOCUMENT_BYTES)
    digest = hashlib.sha256(data).hexdigest()
    key = storage.save_rag_document(data, file.filename or "document.pdf")
    doc = RagDocument(
        title=sanitize_title(file.filename),
        source_path=key,
        checksum=digest,
        status="UPLOADED",
        uploaded_by_user_id=uploader_id,
    )
    db.add(doc)
    await db.commit()
    return doc
```

### 10. High — Chat presents hardcoded medical guidance as a clinical assistant

**File paths and lines:** `backend/app/services/chat.py:17-132,135-154`; `backend/app/api/v1/chat.py:201-269`.

**Threat description:** The chatbot selects medical text by substring matching. Guidance includes missed-dose timing and named AED safety statements. The supposed RAG branch is a `pass` at lines 146-149, and every request falls back to the canned responder.

**Impact:** Users may treat deterministic text as personalized clinical guidance. The system has no retrieval provenance, citation, patient-context validation, contraindication handling, or safety evaluation. This creates medical misinformation and liability risk.

**Production remediation:** Until RAG and clinical evaluation exist, rename the feature as educational-only, constrain it to reviewed static content, add emergency refusal/routing, and never provide medication-specific dosing instructions without a verified source and clinician context.

```python
async def process_chat_message(db, user_id: int, message: str) -> str:
    if not rag_service.is_ready():
        raise HTTPException(
            status_code=503,
            detail={
                "code": "CLINICAL_ASSISTANT_UNAVAILABLE",
                "message": "The evidence-grounded assistant is not available yet.",
            },
        )
    context = await rag_service.retrieve(db, query=message, user_id=user_id)
    return await grounded_answer(message, context, require_citations=True)
```

### 11. High — File validation relies on extension and client MIME type

**File paths and lines:** `backend/app/services/storage/validator.py:58-95,98-139`.

**Threat description:** Doctor documents/photos and EEG files are accepted based primarily on filename extension and `UploadFile.content_type`. Neither is a reliable statement of file contents.

**Impact:** Attackers can upload arbitrary content disguised as an allowed file type. If later served inline or passed to parsers/ML libraries, this increases parser exploitation, resource exhaustion, and content-distribution risk.

**Production remediation:** Enforce byte-size limits while streaming, inspect magic bytes with `libmagic`/`filetype`, parse PDFs/images with safe libraries, re-encode images, quarantine EEG inputs, and never execute or serve uploaded content from an executable origin.

```python
kind = filetype.guess(data)
if photo and kind is None or kind.mime not in ALLOWED_IMAGE_MIMES:
    raise HTTPException(400, "Invalid image signature")
if not photo and kind is None or kind.mime not in ALLOWED_DOCUMENT_MIMES:
    raise HTTPException(400, "Invalid document signature")
```

### 12. Medium — FCM diagnostics expose caretaker email and token fragments

**File path and lines:** `backend/app/api/v1/emergency.py:317-373`, especially `:351-356` and `:358-362`.

**Threat description:** The diagnostic endpoint returns caretaker names, emails, token presence, the first 20 characters of FCM tokens, the Firebase credential path, patient identity, and provider configuration.

**Impact:** Authenticated users with an eligible target can obtain unnecessary PHI and push-token metadata. Token fragments aid correlation and credentials-path disclosure helps reconnaissance.

**Production remediation:** Remove token previews, credential paths, and email addresses from user-facing diagnostics. Return only boolean health signals to patients; expose detailed diagnostics to admins through a separate route.

```python
return {
    "firebase_admin_initialized": fb_ready,
    "push_ready": bool(fb_ready and settings.SOS_PROVIDER == "firebase"),
    "connected_caretakers": [
        {"has_fcm_token": bool(ct.fcm_token)} for ct in caretakers
    ],
}
```

## 3. Medium & Low-Severity Findings

### 13. Medium — Doctor directory permits direct requests to unverified doctors

**File paths and lines:** `backend/app/api/v1/connections.py:249-300`, especially `:261-264`.

**Threat description:** The search endpoint filters verified doctors, but the request endpoint accepts any existing `DoctorProfile` by ID without checking `is_pmdc_verified`.

**Impact:** A caller can bypass the UI and create pending relationships with doctors who are not approved. This violates the stated safety boundary and can create confusing or unsafe care-network state.

**Production remediation:** Enforce the same verification predicate in the request command and add a database/service-level invariant.

```python
doctor_profile = await db.scalar(
    select(DoctorProfile).where(
        DoctorProfile.id == data.doctor_id,
        DoctorProfile.is_pmdc_verified.is_(True),
    )
)
if not doctor_profile:
    raise HTTPException(404, "Verified doctor not found")
```

### 14. Medium — Admin and doctor profile responses expose internal storage keys

**File path and lines:** `backend/app/schemas/profiles.py:117-145`, fields `pmdc_certificate_path` and `profile_photo_path` at `:125-129`.

**Threat description:** Response models expose internal object keys that should remain an implementation detail. Although the current routes are authenticated, the fields increase coupling and provide object-key information to clients.

**Impact:** Storage layout can leak into logs, browser caches, or future public responses. If a later download route trusts the returned value, this becomes an object-access risk.

**Production remediation:** Replace path fields in external schemas with opaque asset IDs or dedicated authenticated URLs; keep storage keys in internal ORM/service DTOs only.

```python
class DoctorProfileOut(StrictModel):
    certificate_available: bool
    profile_photo_available: bool
    certificate_url: str | None = None  # generated only for the authorized caller
```

### 15. Medium — Certificate `Content-Disposition` filename is interpolated without RFC-safe encoding

**File paths and lines:** `backend/app/api/v1/users.py:213-232`; `backend/app/api/v1/admin.py:120-137`.

**Threat description:** `profile.pmdc_certificate_name` is inserted directly into `Content-Disposition: inline; filename="..."`. Newline characters are removed during validation, but quotes and header parameters are not encoded.

**Impact:** This can produce malformed headers, confusing download names, and increases risk if future validation changes permit control characters. Certificates are also served inline instead of forcing a safe download disposition.

**Production remediation:** Use Starlette’s safe response helpers or RFC 6266/5987 encoding and a sanitized fallback name.

```python
from urllib.parse import quote
safe_name = sanitize_filename(profile.pmdc_certificate_name or "pmdc-certificate.pdf")
content_disposition = (
    f"attachment; filename=\"certificate.pdf\"; "
    f"filename*=UTF-8''{quote(safe_name)}"
)
```

### 16. Medium — Broad CSP and dynamic third-party script injection weaken XSS containment

**File paths and lines:** `backend/app/middleware/security_headers.py:19-25`; `frontend/src/services/firebase.ts:37-60`; `frontend/public/firebase-messaging-sw.js:6-7`.

**Threat description:** The CSP allows `unsafe-inline` scripts/styles and a CDN. The frontend dynamically injects Firebase compat scripts and the service worker imports them from `gstatic.com` without integrity metadata.

**Impact:** A content injection or compromised trusted third-party script has a wider execution surface. `unsafe-inline` reduces the value of CSP as a mitigation.

**Production remediation:** Self-host pinned Firebase assets where possible, use nonce/hash-based CSP, remove `unsafe-inline` for scripts, and restrict `connect-src`, `img-src`, and `frame-src` explicitly.

```text
default-src 'self';
script-src 'self' 'nonce-{request_nonce}';
style-src 'self' 'nonce-{request_nonce}';
connect-src 'self' https://fcm.googleapis.com https://*.googleapis.com;
img-src 'self' data:;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
```

### 17. Medium — Startup request middleware performs extra database work and silently degrades identity

**File path and lines:** `backend/app/middleware/request_context.py:35-60`.

**Threat description:** Every bearer-token request decodes the token and opens a separate DB session to resolve the user ID before the normal auth dependency executes. All exceptions are swallowed, setting `request.state.user_id` to `None`.

**Impact:** Authenticated traffic incurs extra DB load and connection churn. If the lookup fails, rate limiting may use an anonymous identity and silently weaken controls. The same JWT is decoded twice.

**Production remediation:** Resolve identity once in an authentication dependency and set request context there; do not swallow database failures for security-sensitive identity decisions.

```python
async def get_current_user(...):
    user = ...
    request.state.user_id = user.id
    return user
```

### 18. Medium — Spectrogram generation swallows every exception and may repeat expensive work

**File path and lines:** `backend/app/api/v1/eeg.py:185-209`.

**Threat description:** On-demand generation catches `Exception` and ignores it. A missing model, corrupt upload, storage failure, or parser error all become a generic 404. Repeated requests can retry expensive generation indefinitely.

**Impact:** Operational failures are hidden, incident diagnosis is impaired, and an attacker can induce repeated model/storage work through repeated requests to a missing artifact.

**Production remediation:** Log with request/session IDs, distinguish 404 from 503/422, and persist a generation lock/status.

```python
except StorageError:
    logger.exception("spectrogram_storage_failure", extra={"session_id": session_id})
    raise HTTPException(503, "Spectrogram storage is temporarily unavailable")
except ModelUnavailable:
    raise HTTPException(503, "EEG model is unavailable")
except ValidationError:
    raise HTTPException(422, "EEG session cannot produce a spectrogram")
```

### 19. Medium — Sleep logs allow negative durations

**File paths and lines:** `backend/app/api/v1/lifestyle.py:43-62,112-135`; `backend/app/schemas/lifestyle.py:10-17,119-125`.

`woke_at` is not validated to be after `slept_at`, so negative durations can enter the database and distort sleep-based recommendations. Add a Pydantic model validator and a database check constraint.

```python
@model_validator(mode="after")
def valid_interval(self):
    if self.woke_at <= self.slept_at:
        raise ValueError("woke_at must be after slept_at")
    return self
```

### 20. Low — Dashboard PDF labels stress on a 1–10 scale while input is 1–5

**File path and lines:** `backend/app/api/v1/dashboard.py:293-296`.

The generated report labels average stress as `/10`, while lifestyle schemas constrain stress to 1–5. Correct the label to `/5` and add a snapshot test for PDF summary labels.

### 21. Low — FCM token payload has no size or format bound

**File path and lines:** `backend/app/api/v1/users.py:405-419`.

`FcmTokenUpdate.fcm_token: str` accepts arbitrary size and content. Add `Field(min_length=20, max_length=4096)` and reject control characters. Also clear invalid tokens after provider rejection.

```python
class FcmTokenUpdate(StrictModel):
    fcm_token: str = Field(min_length=20, max_length=4096, pattern=r"^[A-Za-z0-9_:.\-]+$")
```

### 22. Low — RoleChecker writes debug output on every guarded request

**File path and lines:** `backend/app/api/deps.py:107-118`, especially `:112`.

The unconditional `print` leaks role/type information to stdout, bypasses structured logging, and adds noise. Replace it with debug-level structured logging or remove it.

```python
logger.debug("role_check", extra={"role": str(user.role), "allowed_roles": self.allowed_roles})
```

### 23. Low — Frontend lint passes with warnings that should be promoted to CI failures

**File paths and lines:** `frontend/src/components/ui/ConfirmDialog.tsx:48-56`; `frontend/src/features/profile/ProfilePage.tsx:183-194,820`; `frontend/src/providers/UnsavedChangesProvider.tsx:163-172`.

The build and lint commands exit successfully, but lint reports nine warnings, including a changing `handleClose` dependency, ternary expressions used as statements, an unnecessary escape, and Fast Refresh export warnings. Fix the warnings and run lint with warnings treated as errors in CI.

```tsx
const handleClose = React.useCallback(
  () => onClose?.() ?? onCancel?.(),
  [onClose, onCancel],
);
```

### 24. Low — Dependency manifests are broadly unpinned

**File path:** `backend/requirements.txt:1-56`; `frontend/package.json:12-33`.

Most Python and JavaScript dependencies use floating or caret ranges. The attempted network-based npm audit did not complete in the audit environment, so no current CVE claim is made. Generate lockfiles/SBOMs, pin production dependencies, and run `pip-audit`, `npm audit`, and Dependabot/OSV scanning in CI.

## 4. Deprecations & Technical Debt

The backend test suite currently completes successfully, but it emits a `StarletteDeprecationWarning` from the installed `starlette.testclient` integration regarding `httpx`; upgrade the test-client stack according to the supported compatibility path rather than ignoring the warning.

The frontend production build succeeds, but the generated JavaScript bundle is approximately 1.58 MB minified and 439 KB gzip. Vite also reports an ineffective dynamic import related to Firebase. Split the application by role/page, load Firebase only inside push-enabled flows, and analyze the bundle before the next release.

The backend uses a broad `except Exception` pattern in several infrastructure and media paths. Exceptions that affect security identity, emergency delivery, storage, or model readiness must be classified and surfaced rather than silently degraded.

The Docker image correctly creates a non-root user, but the Compose development environment publishes PostgreSQL, backend, and Vite directly and uses fixed development credentials. Keep this file explicitly development-only and provide a separate production Compose/deployment profile.

The current VLM service is a placeholder at `backend/app/services/vlm_report.py:18-65`; the RAG path is also incomplete at `backend/app/services/rag_ingestion.py:16-56` and `backend/app/services/chat.py:141-154`. Neither should be described as clinically production-ready until model inference, provenance, structured validation, refusal behavior, evaluation fixtures, and monitoring exist.

The public EEG model-status route at `backend/app/api/v1/eeg.py:252-267` discloses model readiness and version without authentication. This is not a critical vulnerability, but it should be restricted or generalized behind an operational health endpoint.

The built-in recommender currently emits fixed internal URLs, so the frontend `href={recommendation.action_url}` is not an open redirect in the current rule set. Preserve an allowlist if action URLs ever become database- or admin-authored content.

## 5. Prioritized Remediation Roadmap

### Phase 0 — Immediate safety stop-ship fixes

First, correct SOS status semantics. Remove every synthetic `SENT` fallback, return explicit `NOT_CONFIGURED` or `FAILED` states, and prevent `COMPLETED` unless at least one real channel confirms delivery. Remove sensitive FCM diagnostics from patient-facing responses. Add tests for missing Firebase, Twilio, WhatsApp, and email configuration.

Second, protect authentication. Add OTP and reset rate limits, per-account attempt counters, one-time challenge consumption, and remove plaintext OTP logging. Rotate any credentials that may have appeared in logs. Confirm that no production log sink retains historic OTPs.

Third, close the RAG upload authorization gap and prevent non-doctors from forging prescriber attribution. These are direct authorization and clinical-integrity defects.

### Phase 1 — Session and configuration hardening

Move refresh tokens to HttpOnly Secure cookies or implement server-side refresh-session records with rotation, revocation, reuse detection, issuer/audience checks, and a token version. Add a password-change session revocation policy.

Add production settings validation for JWT secret length, database URL, storage provider, CORS origins, admin diagnostics credentials, email transport, and selected SOS provider. Split `/livez` and `/readyz`; make readiness fail when required dependencies are unavailable. Move Alembic migrations out of the application startup command and into a single deployment step.

### Phase 2 — Input, storage, and observability hardening

Implement magic-byte validation and streaming size limits for every upload. Re-encode images, quarantine documents, restrict inline serving, sanitize Content-Disposition names, and use opaque asset references rather than internal storage keys.

Remove `X-Forwarded-For` trust unless the request originates from a configured trusted proxy. Keep authentication-sensitive rate limits on Redis or fail closed. Resolve request identity once through the auth dependency and attach it to request context.

### Phase 3 — Clinical integrity and AI boundaries

Replace hardcoded chat guidance with a clearly unavailable state until evidence-grounded RAG is implemented. RAG completion requires authenticated ingestion, extraction, cleaning, deterministic chunking, durable embeddings, similarity retrieval, grounded prompts, citations, refusal behavior, prompt-injection defenses, and evaluation fixtures.

VLM completion requires a real model or adapter, validated inputs, structured report schema, persisted provenance, explicit failures, and regression fixtures. No model-generated report should be presented as clinical output until clinician-reviewed evaluation criteria are satisfied.

### Phase 4 — Quality gates and release controls

Fix all frontend lint warnings, pin dependencies, generate SBOMs, run dependency scanning in CI, add security regression tests for every finding above, and require `compileall`, pytest, frontend build, lint-with-zero-warnings, migration dry-run, and `git diff --check` before release.

## Verification Performed

| Check | Result |
|---|---|
| Backend Python compilation | Passed (`compileall -q app`) |
| Backend pytest suite | Passed: all collected tests completed successfully |
| Frontend production build | Passed (`tsc -b && vite build`) |
| Frontend lint | Exit 0 with 9 warnings |
| SQL injection search | No obvious raw SQL interpolation found in targeted backend search |
| Unsafe deserialization search | `allow_pickle=True` confined to trusted model assets/fixtures, not upload paths |
| Local storage traversal review | Provider resolves paths beneath storage root and rejects escapes |
| npm audit | Network-based scan did not complete; no CVE conclusion made |

**Final verdict:** EpiCare is a meaningful and largely implemented application, but it should not be classified as production-ready or 100% complete for medical/emergency deployment until the Critical/High findings are remediated and the RAG/VLM boundaries are implemented and clinically evaluated.
