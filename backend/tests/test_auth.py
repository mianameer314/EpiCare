"""
Auth endpoint tests — register, login, refresh, me (async stack via TestClient).
"""
from fastapi.testclient import TestClient


import uuid

def _register(client: TestClient, email: str = "auth@example.com") -> dict:
    unique_phone = f"+923{str(uuid.uuid4().int)[:9]}"
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret123", "full_name": "Auth User", "phone_number": unique_phone, "role": "PATIENT"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_register_creates_user(client: TestClient) -> None:
    payload = _register(client)
    assert payload["email"] == "auth@example.com"
    assert payload["full_name"] == "Auth User"
    assert "password_hash" not in payload
    assert payload["is_active"] is True


def _verify_email(email: str):
    import asyncio
    from app.db.session import TestSessionLocal
    from app.models.user import User
    from app.models.pending_registration import PendingRegistration
    from app.models.enums import UserRole
    from app.models.patient_profile import PatientProfile
    from app.models.doctor_profile import DoctorProfile
    from app.models.caretaker_profile import CaretakerProfile
    from datetime import datetime, timezone
    from sqlalchemy import select

    async def _do_verify():
        async with TestSessionLocal() as session:
            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user:
                user.is_email_verified = True
                user.is_phone_verified = True
                await session.commit()
                return

            res = await session.execute(select(PendingRegistration).where(PendingRegistration.email == email))
            pending = res.scalar_one_or_none()
            if pending:
                user = User(
                    email=pending.email,
                    password_hash=pending.password_hash,
                    phone_number=pending.phone_number,
                    full_name=pending.full_name,
                    role=pending.role,
                    is_active=True,
                    is_email_verified=True,
                    is_phone_verified=True,
                )
                session.add(user)
                await session.flush()
                if user.role == UserRole.PATIENT:
                    session.add(PatientProfile(user_id=user.id, date_of_birth=datetime.now(timezone.utc).date()))
                elif user.role == UserRole.DOCTOR:
                    session.add(DoctorProfile(user_id=user.id, pmdc_number=pending.pmdc_number, specialty="Neurologist", is_pmdc_verified=True))
                elif user.role == UserRole.CARETAKER:
                    session.add(CaretakerProfile(user_id=user.id))
                await session.delete(pending)
                await session.commit()

    asyncio.run(_do_verify())


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    _register(client, "dupe_email@example.com")
    _verify_email("dupe_email@example.com")

    response = client.post(
        "/api/v1/auth/register",
        json={"email": "dupe_email@example.com", "password": "supersecret123", "full_name": "Dupe Email", "phone_number": "+923000000010", "role": "PATIENT"},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


def test_register_allows_unverified_email_retry(client: TestClient) -> None:
    # User registers initially but doesn't verify OTP
    _register(client, "unverified_retry@example.com")
    
    # Submitting again with the same unverified email should succeed and refresh OTP
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "unverified_retry@example.com", "password": "newpassword123", "full_name": "Updated Name", "phone_number": "+923000000099", "role": "PATIENT"},
    )
    assert response.status_code == 201
    assert response.json()["full_name"] == "Updated Name"


def test_register_rejects_duplicate_phone(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"email": "phone1@example.com", "password": "supersecret123", "full_name": "Phone One", "phone_number": "+923001234567", "role": "PATIENT"},
    )
    _verify_email("phone1@example.com")

    response = client.post(
        "/api/v1/auth/register",
        json={"email": "phone2@example.com", "password": "supersecret123", "full_name": "Phone Two", "phone_number": "+923001234567", "role": "PATIENT"},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "PHONE_ALREADY_REGISTERED"


def test_register_rejects_duplicate_pmdc(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr1@example.com",
            "password": "supersecret123",
            "full_name": "Dr One",
            "phone_number": "+923009876541",
            "role": "DOCTOR",
            "pmdc_number": "PMDC-DUPE-999"
        },
    )
    _verify_email("dr1@example.com")

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr2@example.com",
            "password": "supersecret123",
            "full_name": "Dr Two",
            "phone_number": "+923009876542",
            "role": "DOCTOR",
            "pmdc_number": "PMDC-DUPE-999"
        },
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "PMDC_ALREADY_REGISTERED"


def test_register_handles_unexpected_integrity_error(client: TestClient, monkeypatch) -> None:
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.ext.asyncio import AsyncSession

    async def mock_commit(self):
        raise IntegrityError("statement", "params", Exception("unknown_unexpected_db_constraint"))

    monkeypatch.setattr(AsyncSession, "commit", mock_commit)

    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "unexpected@example.com",
            "password": "supersecret123",
            "full_name": "Unexpected Error",
            "phone_number": "+923009999999",
            "role": "PATIENT"
        },
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "ALREADY_REGISTERED"


def test_register_validates_password_length(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "short", "full_name": "Short", "phone_number": "+923000000003", "role": "PATIENT"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_returns_tokens(client: TestClient) -> None:
    _register(client, "login@example.com")
    _verify_email("login@example.com")
    
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "supersecret123"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient) -> None:
    _register(client, "wrong@example.com")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "not-the-password"},
    )
    assert response.status_code == 401


def test_me_returns_profile(client: TestClient) -> None:
    _register(client, "me@example.com")
    _verify_email("me@example.com")
    
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "me@example.com", "password": "supersecret123"},
    )
    token = login.json()["access_token"]
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "me@example.com"


def test_me_requires_auth(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code in (401, 403)


def test_login_requires_verified_email(client: TestClient) -> None:
    _register(client, "unverified@example.com")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "unverified@example.com", "password": "supersecret123"},
    )
    assert response.status_code == 403
    assert "Email is not verified" in response.json()["error"]["message"]


def test_doctor_registration_requires_pmdc(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr_nopmdc@example.com", 
            "password": "supersecret123", 
            "full_name": "Dr No PMDC",
            "phone_number": "+923000000004",
            "role": "DOCTOR"
        },
    )
    assert response.status_code == 400
    assert "PMDC number is required" in response.json()["error"]["message"]


def test_doctor_login_requires_pmdc_verification(client: TestClient) -> None:
    # 1. Register a doctor with a PMDC number
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dr_pmdc@example.com", 
            "password": "supersecret123", 
            "full_name": "Dr PMDC",
            "phone_number": "+923000000005",
            "role": "DOCTOR",
            "pmdc_number": "12345-A"
        },
    )
    assert response.status_code == 201
    
    # 2. Manually verify their email (but NOT their PMDC number)
    import asyncio
    from app.db.session import TestSessionLocal
    from app.models.user import User
    from app.models.pending_registration import PendingRegistration
    from app.models.doctor_profile import DoctorProfile
    from sqlalchemy import select
    
    async def verify_user():
        async with TestSessionLocal() as session:
            res = await session.execute(select(PendingRegistration).where(PendingRegistration.email == "dr_pmdc@example.com"))
            pending = res.scalar_one_or_none()
            if pending:
                user = User(
                    email=pending.email,
                    password_hash=pending.password_hash,
                    phone_number=pending.phone_number,
                    full_name=pending.full_name,
                    role=pending.role,
                    is_active=True,
                    is_email_verified=True,
                    is_phone_verified=False,
                )
                session.add(user)
                await session.flush()
                session.add(DoctorProfile(user_id=user.id, pmdc_number=pending.pmdc_number, specialty="Neurologist", is_pmdc_verified=False))
                await session.delete(pending)
                await session.commit()
            else:
                result = await session.execute(select(User).where(User.email == "dr_pmdc@example.com"))
                user = result.scalar_one()
                user.is_email_verified = True
                await session.commit()
            
    asyncio.run(verify_user())
    
    # 3. Attempt to login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "dr_pmdc@example.com", "password": "supersecret123"},
    )
    
    assert login_response.status_code == 403
    assert "pending PMDC verification" in login_response.json()["error"]["message"]


def test_verify_otp(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "otp_test@example.com", 
            "password": "supersecret123", 
            "full_name": "OTP Test",
            "phone_number": "+923000000006",
            "role": "PATIENT"
        },
    )
    assert response.status_code == 201
    
    # Get the OTP from the database
    import asyncio
    from app.db.session import TestSessionLocal
    from app.models.user import User
    from app.models.pending_registration import PendingRegistration
    from sqlalchemy import select
    from app.core.security import hash_password
    
    otp = "123456"
    async def get_otp():
        async with TestSessionLocal() as session:
            res = await session.execute(select(PendingRegistration).where(PendingRegistration.email == "otp_test@example.com"))
            pending = res.scalar_one_or_none()
            if pending:
                pending.otp_secret_hash = hash_password(otp)
            else:
                result = await session.execute(select(User).where(User.email == "otp_test@example.com"))
                user = result.scalar_one()
                user.otp_secret_hash = hash_password(otp)
            await session.commit()
            
    asyncio.run(get_otp())
    
    # Verify the OTP
    verify_response = client.post(
        "/api/v1/auth/verify-email",
        json={"email": "otp_test@example.com", "otp": otp},
    )
    assert verify_response.status_code == 200
    assert "verified successfully" in verify_response.json()["message"]
