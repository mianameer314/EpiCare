import pytest
from unittest.mock import patch
from datetime import datetime, timezone

def test_add_and_get_emergency_contacts(client, auth_headers):
    headers = auth_headers("patient_emerg@example.com")
    
    # Add contact 1
    payload1 = {
        "name": "Mom",
        "relationship": "Mother",
        "phone_number": "+1234567890",
        "is_primary": True
    }
    res1 = client.post("/api/v1/emergency/contacts", json=payload1, headers=headers)
    assert res1.status_code == 201, res1.text
    
    # Add contact 2
    payload2 = {
        "name": "Dad",
        "relationship": "Father",
        "phone_number": "+0987654321",
        "is_primary": False
    }
    client.post("/api/v1/emergency/contacts", json=payload2, headers=headers)
    
    # Add contact 3
    payload3 = {
        "name": "Sister",
        "relationship": "Sister",
        "phone_number": "+1122334455",
        "is_primary": False
    }
    client.post("/api/v1/emergency/contacts", json=payload3, headers=headers)
    
    # Add contact 4 (should fail)
    payload4 = {
        "name": "Friend",
        "relationship": "Friend",
        "phone_number": "+5544332211",
        "is_primary": False
    }
    res4 = client.post("/api/v1/emergency/contacts", json=payload4, headers=headers)
    assert res4.status_code == 400
    assert "Maximum of 3" in res4.text
    
    # Get contacts
    get_res = client.get("/api/v1/emergency/contacts", headers=headers)
    assert get_res.status_code == 200, get_res.text
    assert len(get_res.json()) == 3


@patch("app.api.v1.emergency.get_sos_provider")
def test_trigger_sos_event(mock_get_sos_provider, client, auth_headers):
    headers = auth_headers("patient_sos@example.com")
    
    # Mock the SOS provider to return a success dict
    class MockProvider:
        async def send_sos(self, contacts, event):
            return {c.id: "DELIVERED" for c in contacts}
            
    mock_get_sos_provider.return_value = MockProvider()
    
    # Add a contact first
    client.post("/api/v1/emergency/contacts", json={
        "name": "Mom",
        "relationship": "Mother",
        "phone_number": "+1234567890",
        "is_primary": True
    }, headers=headers)
    
    # Trigger SOS
    payload = {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "location_available": True
    }
    response = client.post("/api/v1/emergency/sos/trigger", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "event_id" in data
    assert data["status"] in ["SENDING", "COMPLETED"]
