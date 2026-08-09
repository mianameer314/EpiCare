import pytest
from app.core.config import settings

def test_system_health(client):
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_system_model_status(client):
    response = client.get("/api/v1/system/model")
    assert response.status_code == 200
    assert "status" in response.json()

def test_admin_diagnostics_unauthorized(client):
    response = client.get("/api/v1/admin/health/diagnostics")
    assert response.status_code == 401

def test_admin_diagnostics_authorized(client):
    # Use the hardcoded default from core/config.py
    headers = {"X-Admin-Key": settings.ADMIN_API_KEY}
    response = client.get("/api/v1/admin/health/diagnostics", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "database" in data
