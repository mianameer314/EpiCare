import pytest

def test_get_patient_dashboard(client, auth_headers):
    headers = auth_headers("patient_dash@example.com")
    
    response = client.get("/api/v1/dashboard", headers=headers)
    assert response.status_code == 200, response.text
    
    data = response.json()
    assert "seizures_past_30_days" in data
    assert "avg_sleep_hours" in data
    assert "medication_adherence_percent" in data
    assert "recommendations" in data
