import pytest
from datetime import datetime, timezone

def test_regenerate_recommendations(client, auth_headers):
    headers = auth_headers("patient_rec@example.com")
    
    # 1. Regenerate
    response = client.post("/api/v1/recommendations/regenerate", headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    
    # Should generate EMERGENCY_NO_CONTACTS by default if no contacts
    assert len(data) > 0
    rec_id = data[0]["id"]
    
    # 2. Get active recommendations
    response = client.get("/api/v1/recommendations/", headers=headers)
    assert response.status_code == 200, response.text
    active_recs = response.json()
    assert len(active_recs) == len(data)
    
    # 3. Mark as read
    response = client.patch(f"/api/v1/recommendations/{rec_id}/read", headers=headers)
    assert response.status_code == 200, response.text
    
    # 4. Submit feedback
    response = client.post(
        f"/api/v1/recommendations/{rec_id}/feedback", 
        json={"event_type": "HELPFUL", "feedback_text": "Good tip!"}, 
        headers=headers
    )
    assert response.status_code == 200, response.text
    
    # 5. Dismiss recommendation
    response = client.patch(f"/api/v1/recommendations/{rec_id}/dismiss", headers=headers)
    assert response.status_code == 200, response.text
    
    # 6. Check active recommendations (should be 1 less since one is dismissed)
    response = client.get("/api/v1/recommendations/", headers=headers)
    assert response.status_code == 200, response.text
    assert len(response.json()) == len(active_recs) - 1
    
    # 7. Check history
    response = client.get("/api/v1/recommendations/history", headers=headers)
    assert response.status_code == 200, response.text
    history = response.json()
    assert len(history) == len(data)
    
    # 8. Check why shown
    response = client.get(f"/api/v1/recommendations/{rec_id}/why-this-was-shown", headers=headers)
    assert response.status_code == 200, response.text
    why_data = response.json()
    assert "rule_id" in why_data
    assert "condition_description" in why_data
    
    # 9. Analytics
    response = client.get("/api/v1/recommendations/stats/analytics", headers=headers)
    assert response.status_code == 200, response.text
    stats = response.json()
    assert stats["total_generated"] >= len(data)
    assert stats["total_read"] >= 1
    assert stats["total_dismissed"] >= 1
    assert stats["total_helpful"] >= 1
