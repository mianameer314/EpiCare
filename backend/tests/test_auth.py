"""
Auth endpoint tests — register, login, refresh, me (async stack via TestClient).
"""
from fastapi.testclient import TestClient


def _register(client: TestClient, email: str = "auth@example.com") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret123", "full_name": "Auth User"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_register_creates_user(client: TestClient) -> None:
    payload = _register(client)
    assert payload["email"] == "auth@example.com"
    assert payload["full_name"] == "Auth User"
    assert "password_hash" not in payload
    assert payload["is_active"] is True


def test_register_rejects_duplicate_email(client: TestClient) -> None:
    _register(client, "dupe@example.com")
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "dupe@example.com", "password": "supersecret123", "full_name": "Dupe"},
    )
    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


def test_register_validates_password_length(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "short@example.com", "password": "short", "full_name": "Short"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_login_returns_tokens(client: TestClient) -> None:
    _register(client, "login@example.com")
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
