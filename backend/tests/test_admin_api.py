import pytest
import asyncio
from app.models.enums import UserRole
from app.models.user import User
from app.core.security import hash_password
from app.db.session import TestSessionLocal

@pytest.fixture
def admin_headers(client):
    """Creates an admin user directly in the database and logs them in."""
    email = "admin_test@example.com"
    
    async def create_admin():
        async with TestSessionLocal() as session:
            from sqlalchemy import select
            result = await session.execute(select(User).where(User.email == email))
            existing_user = result.scalar_one_or_none()
            if existing_user:
                return
                
            admin_user = User(
                email=email,
                password_hash=hash_password("adminpass123"),
                phone_number="+923000000999",
                full_name="Admin Test",
                role=UserRole.ADMIN,
                is_active=True,
                is_email_verified=True,
                is_phone_verified=True,
            )
            session.add(admin_user)
            await session.commit()
            
    asyncio.run(create_admin())
    
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "adminpass123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def patient_user(auth_headers):
    """Creates a normal patient and returns their headers, for testing admin interactions."""
    import uuid
    email = f"target_patient_{uuid.uuid4().hex[:8]}@example.com"
    return auth_headers(email), email


def test_admin_metrics(client, admin_headers):
    response = client.get("/api/v1/admin/dashboard/metrics", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_users" in data
    assert "total_patients" in data


def test_admin_list_users(client, admin_headers, patient_user):
    # patient_user fixture already creates a user
    response = client.get("/api/v1/admin/users", headers=admin_headers)
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 2  # At least the admin and the patient


def test_admin_update_user_status(client, admin_headers, patient_user):
    target_headers, target_email = patient_user
    
    # First find the user ID
    users_resp = client.get("/api/v1/admin/users", headers=admin_headers)
    target_id = None
    for u in users_resp.json():
        if u["email"] == target_email:
            target_id = u["id"]
            break
            
    assert target_id is not None

    # Deactivate the user
    response = client.patch(
        f"/api/v1/admin/users/{target_id}/status",
        headers=admin_headers,
        json={"is_active": False}
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # Try to access a protected route as the deactivated patient
    patient_me = client.get("/api/v1/auth/me", headers=target_headers)
    assert patient_me.status_code == 403


def test_admin_unauthorized_access(client, patient_user):
    """Test that a non-admin cannot access admin routes."""
    target_headers, _ = patient_user
    response = client.get("/api/v1/admin/dashboard/metrics", headers=target_headers)
    assert response.status_code == 403
