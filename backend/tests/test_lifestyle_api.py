import pytest
from datetime import datetime, timezone

def test_log_menstruation(client, auth_headers):
    headers = auth_headers("patient_lifestyle1@example.com")
    
    payload = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "flow_intensity": "Medium",
        "notes": "Feeling fine"
    }
    
    response = client.post("/api/v1/lifestyle/menstruation", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["log_type"] == "MENSTRUATION"
    assert data["metadata_dict"]["flow_intensity"] == "Medium"

def test_log_diet(client, auth_headers):
    headers = auth_headers("patient_lifestyle2@example.com")
    
    payload = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "keto_compliant": True,
        "alcohol_units": 0
    }
    
    response = client.post("/api/v1/lifestyle/diet", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["log_type"] == "DIET"
    assert data["metadata_dict"]["keto_compliant"] is True
    assert data["metadata_dict"]["alcohol_units"] == 0

def test_log_illness(client, auth_headers):
    headers = auth_headers("patient_lifestyle3@example.com")
    
    payload = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "temperature_f": 101.5,
        "illness_type": "Flu"
    }
    
    response = client.post("/api/v1/lifestyle/illness", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["log_type"] == "ILLNESS"
    assert data["metadata_dict"]["temperature_f"] == 101.5

def test_log_med_side_effect(client, auth_headers):
    headers = auth_headers("patient_lifestyle4@example.com")
    
    payload = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "medication_name": "Keppra",
        "severity": 3,
        "symptom": "Dizziness"
    }
    
    response = client.post("/api/v1/lifestyle/med-side-effects", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["log_type"] == "MED_SIDE_EFFECT"
    assert data["metadata_dict"]["medication_name"] == "Keppra"

def test_log_screen_time(client, auth_headers):
    headers = auth_headers("patient_lifestyle5@example.com")
    
    payload = {
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "duration_hours": 2,
        "duration_minutes": 30,
        "device_type": "Phone"
    }
    
    response = client.post("/api/v1/lifestyle/screen-time", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["log_type"] == "SCREEN_TIME"
    assert data["metadata_dict"]["duration_hours"] == 2
    assert data["metadata_dict"]["total_duration_minutes"] == 150
