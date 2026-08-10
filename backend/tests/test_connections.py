import uuid
from fastapi.testclient import TestClient

def _create_user(client: TestClient, role: str, email_prefix: str) -> dict:
    import asyncio
    from app.db.session import TestSessionLocal
    from app.models.user import User
    from app.models.doctor_profile import DoctorProfile
    from sqlalchemy import select
    
    unique_phone = f"+923{str(uuid.uuid4().int)[:9]}"
    email = f"{email_prefix}@example.com"
    
    payload = {
        "email": email,
        "password": "supersecret123",
        "full_name": f"Test {role}",
        "phone_number": unique_phone,
        "role": role
    }
    
    if role == "DOCTOR":
        payload["pmdc_number"] = f"PMDC-{str(uuid.uuid4().int)[:6]}"
        
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    
    async def verify_and_get():
        async with TestSessionLocal() as session:
            result = await session.execute(select(User).where(User.email == email))
            user = result.scalar_one()
            user.is_email_verified = True
            
            if role == "DOCTOR":
                # Verify doctor profile too
                prof_result = await session.execute(select(DoctorProfile).where(DoctorProfile.user_id == user.id))
                prof = prof_result.scalar_one()
                prof.is_pmdc_verified = True
                
            await session.commit()
            
    asyncio.run(verify_and_get())
    
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "supersecret123"})
    assert login.status_code == 200
    token = login.json()["access_token"]
    
    return {
        "headers": {"Authorization": f"Bearer {token}"},
        "email": email,
        "pmdc_number": payload.get("pmdc_number")
    }


def test_doctor_search_and_request_connection(client: TestClient) -> None:
    # 1. Create a Doctor and a Patient
    doctor_data = _create_user(client, "DOCTOR", "conn_dr1")
    patient_data = _create_user(client, "PATIENT", "conn_pt1")
    
    pmdc = doctor_data["pmdc_number"]
    patient_headers = patient_data["headers"]
    
    # 2. Search for the Doctor
    search_response = client.get(
        f"/api/v1/connections/doctors/search?pmdc_number={pmdc}",
        headers=patient_headers
    )
    assert search_response.status_code == 200
    results = search_response.json()["items"]
    assert len(results) == 1
    doctor_id = results[0]["doctor_id"]
    
    # 3. Request Connection
    req_response = client.post(
        "/api/v1/connections/doctors/request",
        headers=patient_headers,
        json={"doctor_id": doctor_id}
    )
    assert req_response.status_code == 200
    conn = req_response.json()
    assert conn["relationship_status"] == "PENDING"
    conn_id = conn["id"]
    
    # 4. Duplicate Connection Request should fail (400)
    req2_response = client.post(
        "/api/v1/connections/doctors/request",
        headers=patient_headers,
        json={"doctor_id": doctor_id}
    )
    assert req2_response.status_code == 400
    assert "already exists" in req2_response.json()["error"]["message"]
    
    # 5. Doctor approves connection
    doctor_headers = doctor_data["headers"]
    app_response = client.post(
        f"/api/v1/connections/doctors/approve/{conn_id}",
        headers=doctor_headers
    )
    assert app_response.status_code == 200, app_response.text
    assert app_response.json()["relationship_status"] == "ACTIVE"
