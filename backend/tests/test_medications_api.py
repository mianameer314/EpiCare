import pytest
import uuid
from datetime import datetime, timezone
from fastapi.testclient import TestClient

def _setup_doctor_and_patient(client: TestClient, prefix: str):
    import asyncio
    from app.db.session import TestSessionLocal
    from app.models.user import User
    from app.models.doctor_profile import DoctorProfile
    from sqlalchemy import select
    
    # 1. Register Patient
    pt_email = f"pt_{prefix}@example.com"
    pt_phone = f"+923{str(uuid.uuid4().int)[:9]}"
    client.post("/api/v1/auth/register", json={
        "email": pt_email, "password": "supersecret123", "full_name": "Patient", "phone_number": pt_phone, "role": "PATIENT"
    })
    
    # 2. Register Doctor
    dr_email = f"dr_{prefix}@example.com"
    dr_phone = f"+923{str(uuid.uuid4().int)[:9]}"
    client.post("/api/v1/auth/register", json={
        "email": dr_email, "password": "supersecret123", "full_name": "Doctor", "phone_number": dr_phone, "role": "DOCTOR", "pmdc_number": f"P-{prefix}"
    })
    
    # Verify emails and PMDC
    async def verify_users():
        async with TestSessionLocal() as session:
            from app.models.pending_registration import PendingRegistration
            from app.models.patient_profile import PatientProfile
            from app.models.enums import UserRole
            from datetime import datetime, timezone

            # Patient
            res_pt = await session.execute(select(PendingRegistration).where(PendingRegistration.email == pt_email))
            pending_pt = res_pt.scalar_one_or_none()
            if pending_pt:
                pt = User(
                    email=pending_pt.email,
                    password_hash=pending_pt.password_hash,
                    phone_number=pending_pt.phone_number,
                    full_name=pending_pt.full_name,
                    role=UserRole.PATIENT,
                    is_active=True,
                    is_email_verified=True,
                    is_phone_verified=False,
                )
                session.add(pt)
                await session.flush()
                session.add(PatientProfile(user_id=pt.id, date_of_birth=datetime.now(timezone.utc).date()))
                await session.delete(pending_pt)
            else:
                pt = (await session.execute(select(User).where(User.email == pt_email))).scalar_one()
                pt.is_email_verified = True
            
            # Doctor
            res_dr = await session.execute(select(PendingRegistration).where(PendingRegistration.email == dr_email))
            pending_dr = res_dr.scalar_one_or_none()
            if pending_dr:
                dr = User(
                    email=pending_dr.email,
                    password_hash=pending_dr.password_hash,
                    phone_number=pending_dr.phone_number,
                    full_name=pending_dr.full_name,
                    role=UserRole.DOCTOR,
                    is_active=True,
                    is_email_verified=True,
                    is_phone_verified=False,
                )
                session.add(dr)
                await session.flush()
                session.add(DoctorProfile(user_id=dr.id, pmdc_number=pending_dr.pmdc_number, specialty="Neurologist", is_pmdc_verified=True))
                await session.delete(pending_dr)
            else:
                dr = (await session.execute(select(User).where(User.email == dr_email))).scalar_one()
                dr.is_email_verified = True
                prof = (await session.execute(select(DoctorProfile).where(DoctorProfile.user_id == dr.id))).scalar_one()
                prof.is_pmdc_verified = True
            
            await session.commit()
            return pt.id, dr.id
            
    pt_id, dr_id = asyncio.run(verify_users())
    
    # Logins
    pt_token = client.post("/api/v1/auth/login", json={"email": pt_email, "password": "supersecret123"}).json()["access_token"]
    dr_token = client.post("/api/v1/auth/login", json={"email": dr_email, "password": "supersecret123"}).json()["access_token"]
    pt_headers = {"Authorization": f"Bearer {pt_token}"}
    dr_headers = {"Authorization": f"Bearer {dr_token}"}
    
    # Create Connection
    # Patient requests
    search = client.get(f"/api/v1/connections/doctors/search?pmdc_number=P-{prefix}", headers=pt_headers).json()["items"][0]
    req = client.post("/api/v1/connections/doctors/request", headers=pt_headers, json={"doctor_id": search["doctor_id"]}).json()
    # Doctor approves
    client.post(f"/api/v1/connections/doctors/approve/{req['id']}", headers=dr_headers)
    
    return pt_headers, dr_headers, pt_id


def test_patient_cannot_prescribe(client):
    pt_headers, dr_headers, pt_id = _setup_doctor_and_patient(client, "test1")
    
    payload = {
        "name": "Keppra", "dosage": "500mg", "frequency": "Daily", "start_date": "2026-08-01", "is_active": True
    }
    
    # Patient tries to prescribe -> should fail
    response = client.post(f"/api/v1/medications?patient_user_id={pt_id}", json=payload, headers=pt_headers)
    assert response.status_code == 403
    assert "cannot prescribe" in response.text


def test_doctor_can_prescribe(client):
    pt_headers, dr_headers, pt_id = _setup_doctor_and_patient(client, "test2")
    
    payload = {
        "name": "Keppra", "dosage": "500mg", "frequency": "Daily", "start_date": "2026-08-01", "is_active": True
    }
    
    # Doctor prescribes
    response = client.post(f"/api/v1/medications?patient_user_id={pt_id}", json=payload, headers=dr_headers)
    assert response.status_code == 201, response.text
    
    # Patient can list it
    list_res = client.get("/api/v1/medications", headers=pt_headers)
    assert len(list_res.json()["items"]) == 1
    assert list_res.json()["items"][0]["name"] == "Keppra"


def test_doctor_creates_schedule_patient_logs_dose(client):
    pt_headers, dr_headers, pt_id = _setup_doctor_and_patient(client, "test3")
    
    # Doctor prescribes
    med_payload = {"name": "Depakote", "dosage": "250mg", "frequency": "Daily", "start_date": "2026-08-01", "is_active": True}
    med_res = client.post(f"/api/v1/medications?patient_user_id={pt_id}", json=med_payload, headers=dr_headers)
    med_id = med_res.json()["id"]
    
    # Doctor adds schedule
    sch_payload = {"scheduled_time": "08:00:00"}
    sch_res = client.post(f"/api/v1/medications/{med_id}/schedules?patient_user_id={pt_id}", json=sch_payload, headers=dr_headers)
    assert sch_res.status_code == 201
    
    # Patient adds schedule -> should fail
    pt_sch_res = client.post(f"/api/v1/medications/{med_id}/schedules?patient_user_id={pt_id}", json=sch_payload, headers=pt_headers)
    assert pt_sch_res.status_code == 403
    
    # Doctor logs dose -> should fail
    log_payload = {"status": "TAKEN"}
    dr_log_res = client.post(f"/api/v1/medications/{med_id}/log?patient_user_id={pt_id}", json=log_payload, headers=dr_headers)
    assert dr_log_res.status_code == 403
    
    # Patient logs dose -> succeeds
    pt_log_res = client.post(f"/api/v1/medications/{med_id}/log", json=log_payload, headers=pt_headers)
    assert pt_log_res.status_code == 201
    assert pt_log_res.json()["status"] == "TAKEN"
