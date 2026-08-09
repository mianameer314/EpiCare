import pytest
from datetime import datetime, timezone

def test_log_manual_seizure_success(client, auth_headers):
    headers = auth_headers("patient_seizure@example.com")
    
    payload = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": 120,
        "seizure_type": "Focal",
        "auras_felt": "Deja vu, visual distortions",
        "post_ictal_symptoms": "Confusion, fatigue",
        "notes": "Happened at the grocery store."
    }
    
    response = client.post("/api/v1/seizures/manual", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["duration_seconds"] == 120
    assert data["seizure_type"] == "Focal"
    assert data["auras_felt"] == "Deja vu, visual distortions"
    assert "id" in data

def test_get_manual_seizures_list(client, auth_headers):
    headers = auth_headers("patient_seizure_list@example.com")
    
    # Log two seizures
    client.post(
        "/api/v1/seizures/manual", 
        json={
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": 60,
            "seizure_type": "Tonic-clonic"
        }, 
        headers=headers
    )
    client.post(
        "/api/v1/seizures/manual", 
        json={
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": 90,
            "seizure_type": "Absence"
        }, 
        headers=headers
    )
    
    # Retrieve the list
    response = client.get("/api/v1/seizures/manual", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data) == 2
