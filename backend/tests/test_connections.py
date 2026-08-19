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
            from app.models.pending_registration import PendingRegistration
            from app.models.patient_profile import PatientProfile
            from app.models.caretaker_profile import CaretakerProfile
            from app.models.enums import UserRole
            from datetime import datetime, timezone

            res = await session.execute(select(PendingRegistration).where(PendingRegistration.email == email))
            pending = res.scalar_one_or_none()
            if pending:
                user = User(
                    email=pending.email,
                    password_hash=pending.password_hash,
                    phone_number=pending.phone_number,
                    full_name=pending.full_name,
                    role=UserRole(role),
                    is_active=True,
                    is_email_verified=True,
                    is_phone_verified=False,
                )
                session.add(user)
                await session.flush()
                if user.role == UserRole.PATIENT:
                    session.add(PatientProfile(user_id=user.id, date_of_birth=datetime.now(timezone.utc).date()))
                elif user.role == UserRole.DOCTOR:
                    session.add(DoctorProfile(user_id=user.id, pmdc_number=pending.pmdc_number, specialty="Neurologist", is_pmdc_verified=True))
                elif user.role == UserRole.CARETAKER:
                    session.add(CaretakerProfile(user_id=user.id))
                await session.delete(pending)
            else:
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one()
                user.is_email_verified = True
                
                if role == "DOCTOR":
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


def test_patient_and_doctor_view_connections(client: TestClient) -> None:
    # Create doctor and patient
    doctor_data = _create_user(client, "DOCTOR", "view_dr1")
    patient_data = _create_user(client, "PATIENT", "view_pt1")
    
    doctor_headers = doctor_data["headers"]
    patient_headers = patient_data["headers"]
    
    # Patient searches and requests doctor
    search_res = client.get(f"/api/v1/connections/doctors/search?pmdc_number={doctor_data['pmdc_number']}", headers=patient_headers)
    doctor_id = search_res.json()["items"][0]["doctor_id"]
    
    req_res = client.post("/api/v1/connections/doctors/request", headers=patient_headers, json={"doctor_id": doctor_id})
    conn_id = req_res.json()["id"]
    
    # 1. Patient should see the pending doctor connection
    pt_docs_res = client.get("/api/v1/connections/patient/doctors", headers=patient_headers)
    assert pt_docs_res.status_code == 200
    pt_docs = pt_docs_res.json()["items"]
    assert len(pt_docs) == 1
    assert pt_docs[0]["relationship_status"] == "PENDING"
    assert pt_docs[0]["doctor"]["full_name"] == "Test DOCTOR"
    assert "pmdc_number" in pt_docs[0]
    
    # 2. Doctor should see pending request with patient details
    dr_pending_res = client.get("/api/v1/connections/doctors/pending", headers=doctor_headers)
    assert dr_pending_res.status_code == 200
    dr_pending = dr_pending_res.json()["items"]
    assert len(dr_pending) == 1
    assert dr_pending[0]["patient"]["full_name"] == "Test PATIENT"
    assert "date_of_birth" in dr_pending[0]
    
    # 3. Doctor approves connection
    client.post(f"/api/v1/connections/doctors/approve/{conn_id}", headers=doctor_headers)
    
    # 4. Doctor should now see the patient in active patients list
    dr_active_res = client.get("/api/v1/connections/doctor/patients", headers=doctor_headers)
    assert dr_active_res.status_code == 200
    dr_active = dr_active_res.json()["items"]
    assert len(dr_active) == 1
    assert dr_active[0]["relationship_status"] == "ACTIVE"
    assert dr_active[0]["patient"]["email"] == "view_pt1@example.com"


def test_patient_and_caretaker_view_connections(client: TestClient) -> None:
    caretaker_data = _create_user(client, "CARETAKER", "view_ct1")
    patient_data = _create_user(client, "PATIENT", "view_pt2")
    
    caretaker_headers = caretaker_data["headers"]
    patient_headers = patient_data["headers"]
    
    # Patient requests caretaker
    req_res = client.post("/api/v1/connections/caretakers/request", headers=patient_headers, json={"caretaker_email": "view_ct1@example.com"})
    conn_id = req_res.json()["id"]
    
    # Patient should see caretaker pending
    pt_cts_res = client.get("/api/v1/connections/patient/caretakers", headers=patient_headers)
    assert pt_cts_res.status_code == 200
    pt_cts = pt_cts_res.json()["items"]
    assert len(pt_cts) == 1
    assert pt_cts[0]["caretaker"]["full_name"] == "Test CARETAKER"
    assert pt_cts[0]["relationship_status"] == "PENDING"
    
    # Caretaker sees pending request
    ct_pending_res = client.get("/api/v1/connections/caretakers/pending", headers=caretaker_headers)
    assert ct_pending_res.status_code == 200
    assert len(ct_pending_res.json()["items"]) == 1
    
    # Caretaker approves
    client.post(f"/api/v1/connections/caretakers/approve/{conn_id}", headers=caretaker_headers)
    
    # Caretaker sees active patient
    ct_active_res = client.get("/api/v1/connections/caretaker/patients", headers=caretaker_headers)
    assert ct_active_res.status_code == 200
    ct_active = ct_active_res.json()["items"]
    assert len(ct_active) == 1
    assert ct_active[0]["patient"]["email"] == "view_pt2@example.com"
    assert ct_active[0]["can_proxy"] is False
    
    # Patient toggles proxy
    client.put(f"/api/v1/connections/caretakers/{conn_id}/proxy", headers=patient_headers, json={"can_proxy": True})
    
    # Caretaker active patient updates
    ct_active_res2 = client.get("/api/v1/connections/caretaker/patients", headers=caretaker_headers)
    assert ct_active_res2.json()["items"][0]["can_proxy"] is True

