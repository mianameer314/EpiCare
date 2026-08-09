"""
EEG API endpoint tests — upload + analyze routing with the service layer
mocked at the boundary (mirrors BRANDING-SYSTEM test strategy).

The heavy pipeline (parse/validate/preprocess/inference) is exercised in
tests/test_eeg_session_service.py; here we verify HTTP contract, auth, and
error wiring.
"""
from fastapi.testclient import TestClient


def _auth(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "eeg-user@example.com", "password": "supersecret123", "full_name": "EEG User"},
    )
    assert response.status_code == 201, response.text
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "eeg-user@example.com", "password": "supersecret123"},
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_upload_requires_auth(client: TestClient) -> None:
    response = client.post(
        "/api/v1/eeg/upload",
        files={"file": ("test.csv", b"1,2,3\n4,5,6\n", "text/csv")},
    )
    assert response.status_code in (401, 403)


def test_upload_rejects_bad_extension(client: TestClient) -> None:
    headers = _auth(client)
    response = client.post(
        "/api/v1/eeg/upload",
        headers=headers,
        files={"file": ("malware.exe", b"MZ...", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "HTTP_ERROR"


def test_upload_creates_session(client: TestClient) -> None:
    headers = _auth(client)
    csv_bytes = b"Fp1,Fp2\n1,2\n3,4\n"
    response = client.post(
        "/api/v1/eeg/upload",
        headers=headers,
        files={"file": ("recording.csv", csv_bytes, "text/csv")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["status"] == "UPLOADED"
    assert body["original_filename"] == "recording.csv"
    assert body["file_size_bytes"] == len(csv_bytes)


def test_list_sessions_empty(client: TestClient) -> None:
    headers = _auth(client)
    response = client.get("/api/v1/eeg/sessions", headers=headers)
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["total"] == 0


def test_analyze_routes_to_service(client: TestClient, monkeypatch) -> None:
    """The analyze endpoint must pass session_id + user and return the prediction."""
    headers = _auth(client)

    async def fake_analyze(db, user, session_id):
        return {
            "id": 1,
            "session_id": session_id,
            "user_id": user.id,
            "predicted_class": "no_seizure",
            "confidence": 0.9,
            "threshold": 0.5,
            "positive_windows": 0,
            "total_windows": 5,
            "max_probability": 0.1,
            "mean_probability": 0.05,
            "window_probabilities": [0.1, 0.05, 0.08, 0.12, 0.09],
            "status": "COMPLETED",
            "model_version": "v1",
            "started_at": "2026-08-08T00:00:00+00:00",
            "completed_at": "2026-08-08T00:00:01+00:00",
            "created_at": "2026-08-08T00:00:00+00:00",
        }

    monkeypatch.setattr("app.api.v1.eeg.session_service.analyze_session", fake_analyze)
    response = client.post("/api/v1/eeg/sessions/1/analyze", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["predicted_class"] == "no_seizure"
