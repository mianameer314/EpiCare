import pytest
from datetime import datetime, timezone

def test_add_and_list_medications(client, auth_headers):
    headers = auth_headers("patient_meds@example.com")
    
    # Add medication
    payload = {
        "name": "Keppra",
        "dosage": "500mg",
        "frequency": "Daily",
        "start_date": "2026-08-01",
        "instructions": "Take with food",
        "is_active": True
    }
    
    response = client.post("/api/v1/medications", json=payload, headers=headers)
    assert response.status_code == 201, response.text
    med_id = response.json()["id"]
    
    # List medications
    response = client.get("/api/v1/medications", headers=headers)
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Keppra"

def test_add_medication_schedule(client, auth_headers):
    headers = auth_headers("patient_meds_sch@example.com")
    
    # Add medication
    payload = {
        "name": "Lamictal",
        "dosage": "100mg",
        "frequency": "Daily",
        "start_date": "2026-08-01",
        "is_active": True
    }
    med_res = client.post("/api/v1/medications", json=payload, headers=headers)
    med_id = med_res.json()["id"]
    
    # Add schedule
    sch_payload = {
        "scheduled_time": "08:00:00",
        "reminder_enabled": True
    }
    response = client.post(f"/api/v1/medications/{med_id}/schedules", json=sch_payload, headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()["scheduled_time"] == "08:00:00"

def test_log_medication_dose(client, auth_headers):
    headers = auth_headers("patient_meds_log@example.com")
    
    # Add medication
    payload = {
        "name": "Depakote",
        "dosage": "250mg",
        "frequency": "Daily",
        "start_date": "2026-08-01",
        "is_active": True
    }
    med_res = client.post("/api/v1/medications", json=payload, headers=headers)
    med_id = med_res.json()["id"]
    
    # Add schedule
    sch_payload = {
        "scheduled_time": "08:00:00"
    }
    sch_res = client.post(f"/api/v1/medications/{med_id}/schedules", json=sch_payload, headers=headers)
    sch_id = sch_res.json()["id"]
    
    # Log dose
    log_payload = {
        "schedule_id": sch_id,
        "scheduled_time": datetime.now(timezone.utc).isoformat(),
        "status": "TAKEN"
    }
    response = client.post(f"/api/v1/medications/{med_id}/log", json=log_payload, headers=headers)
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "TAKEN"
