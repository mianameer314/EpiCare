# EpiCare API Contract

This document is 100% matched to the FastAPI codebase.

## System health & status

### GET /api/v1/system/health
**Summary:** General system health check

**Responses:**
- **200**: Successful Response - System is healthy or degraded -> HealthOut

### GET /api/v1/system/model
**Summary:** AI Model readiness check

**Responses:**
- **200**: Successful Response - Returns model status -> ModelStatusOut

## Authentication

### POST /api/v1/auth/register
**Summary:** Register a new user

**Request Body (JSON):** UserRegister

**Responses:**
- **201**: Successful Response -> UserOut
- **400**: Bad Request - Validation error or email already registered
- **429**: Too Many Requests - Rate limit exceeded
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/auth/login
**Summary:** Login user

**Request Body (JSON):** LoginRequest

**Responses:**
- **200**: Successful Response -> Token
- **400**: Bad Request
- **401**: Unauthorized - Invalid email or password
- **403**: Forbidden - Account deactivated, unverified email, or unverified PMDC
- **429**: Too Many Requests - Login rate limit exceeded
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/auth/verify-email
**Summary:** Verify user email

**Request Body (JSON):** VerifyOTPRequest

**Responses:**
- **200**: Successful Response
- **400**: Bad Request - Invalid or expired OTP
- **404**: Not Found - User not found
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/auth/resend-otp
**Summary:** Resend OTP

**Request Body (JSON):** ResendOTPRequest

**Responses:**
- **200**: Successful Response
- **400**: Bad Request - Email is already verified
- **429**: Too Many Requests - Rate limit exceeded
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/auth/refresh
**Summary:** Refresh auth tokens

**Responses:**
- **200**: Successful Response -> Token
- **401**: Unauthorized - Invalid or expired refresh token
- **429**: Too Many Requests

### POST /api/v1/auth/logout
**Summary:** Logout user

**Responses:**
- **204**: Successful Response
- **401**: Unauthorized

### GET /api/v1/auth/me
**Summary:** Get current user details

**Responses:**
- **200**: Successful Response -> UserOut
- **401**: Unauthorized

### PATCH /api/v1/auth/me
**Summary:** Update user details

**Request Body (JSON):** UserProfileUpdate

**Responses:**
- **200**: Successful Response -> UserOut
- **400**: Bad Request - Validation error
- **401**: Unauthorized
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/auth/change-password
**Summary:** Change account password

**Request Body (JSON):** ChangePasswordRequest

**Responses:**
- **204**: Successful Response
- **400**: Bad Request - Validation error
- **401**: Unauthorized - Incorrect current password
- **422**: Validation Error -> HTTPValidationError

## Patient management

### GET /api/v1/users/me/patient-profile
**Summary:** Get patient profile

**Responses:**
- **200**: Successful Response -> PatientProfileOut
- **401**: Unauthorized - Missing or invalid token
- **404**: Patient profile not found for this user

### PUT /api/v1/users/me/patient-profile
**Summary:** Update patient profile

**Request Body (JSON):** PatientProfileUpdate

**Responses:**
- **200**: Successful Response -> PatientProfileOut
- **400**: Bad Request - Validation error
- **401**: Unauthorized - Missing or invalid token
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/users/me/patient-profile
**Summary:** Delete patient profile

**Responses:**
- **204**: Successful Response
- **401**: Unauthorized - Missing or invalid token
- **404**: Patient profile not found

## Doctor management

### GET /api/v1/users/me/doctor-profile
**Summary:** Get doctor profile

**Responses:**
- **200**: Successful Response -> DoctorProfileOut
- **401**: Unauthorized - Missing or invalid token
- **404**: Doctor profile not found for this user

### PUT /api/v1/users/me/doctor-profile
**Summary:** Update doctor profile

**Request Body (JSON):** DoctorProfileUpdate

**Responses:**
- **200**: Successful Response -> DoctorProfileOut
- **400**: Bad Request - Validation error
- **401**: Unauthorized - Missing or invalid token
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/users/me/doctor-profile
**Summary:** Delete doctor profile

**Responses:**
- **204**: Successful Response
- **401**: Unauthorized - Missing or invalid token
- **404**: Doctor profile not found

## Caretaker management

### GET /api/v1/users/me/caretaker-profile
**Summary:** Get caretaker profile

**Responses:**
- **200**: Successful Response -> CaretakerProfileOut
- **401**: Unauthorized - Missing or invalid token
- **404**: Caretaker profile not found for this user

### PUT /api/v1/users/me/caretaker-profile
**Summary:** Update caretaker profile

**Request Body (JSON):** CaretakerProfileUpdate

**Responses:**
- **200**: Successful Response -> CaretakerProfileOut
- **400**: Bad Request - Validation error
- **401**: Unauthorized - Missing or invalid token
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/users/me/caretaker-profile
**Summary:** Delete caretaker profile

**Responses:**
- **204**: Successful Response
- **401**: Unauthorized - Missing or invalid token
- **404**: Caretaker profile not found

## Eeg analysis

### POST /api/v1/eeg/upload
**Summary:** Upload EEG recording

**Request Body (Form/Multipart):** File Upload

**Responses:**
- **201**: Successful Response -> EegSessionOut
- **400**: Bad Request - Invalid file format or file too large
- **401**: Unauthorized
- **429**: Too Many Requests - Upload rate limit exceeded
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/eeg/sessions
**Summary:** List EEG sessions

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| page | query | False | integer |
| per_page | query | False | integer |

**Responses:**
- **200**: Successful Response -> EegSessionList
- **401**: Unauthorized
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/eeg/sessions/{session_id}
**Summary:** Get session details

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| session_id | path | True | integer |

**Responses:**
- **200**: Successful Response -> EegSessionOut
- **401**: Unauthorized
- **404**: Not Found - Session does not exist or belongs to another user
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/eeg/sessions/{session_id}/analyze
**Summary:** Analyze EEG session

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| session_id | path | True | integer |

**Responses:**
- **200**: Successful Response -> PredictionOut
- **400**: Bad Request - Session already analyzed, or file invalid
- **401**: Unauthorized
- **404**: Not Found - Session does not exist or belongs to another user
- **500**: Internal Server Error - ML pipeline failed
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/eeg/sessions/{session_id}/spectrogram
**Summary:** Get session spectrogram

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| session_id | path | True | integer |

**Responses:**
- **200**: Successful Response - Returns an image/png file
- **401**: Unauthorized
- **404**: Not Found - Session or spectrogram does not exist
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/eeg/sessions/{session_id}/prediction
**Summary:** Get session prediction

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| session_id | path | True | integer |

**Responses:**
- **200**: Successful Response -> PredictionOut
- **401**: Unauthorized
- **404**: Not Found - Session or prediction does not exist
- **422**: Validation Error -> HTTPValidationError

## Admin

### GET /api/v1/admin/dashboard/metrics
**Summary:** Get platform metrics

**Responses:**
- **200**: Successful Response -> AdminDashboardMetricsOut

### GET /api/v1/admin/users
**Summary:** List all users

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| skip | query | False | integer |
| limit | query | False | integer |
| role | query | False | string |

**Responses:**
- **200**: Successful Response
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/admin/users/{user_id}
**Summary:** Get user details

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| user_id | path | True | integer |

**Responses:**
- **200**: Successful Response -> UserOut
- **422**: Validation Error -> HTTPValidationError

### PATCH /api/v1/admin/users/{user_id}/status
**Summary:** Activate or Deactivate User

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| user_id | path | True | integer |

**Request Body (JSON):** UserStatusUpdate

**Responses:**
- **200**: Successful Response -> UserOut
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/admin/doctors/pending
**Summary:** List pending doctors

**Responses:**
- **200**: Successful Response

### PATCH /api/v1/admin/doctors/{user_id}/verify
**Summary:** Verify Doctor PMDC

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| user_id | path | True | integer |

**Request Body (JSON):** DoctorVerificationUpdate

**Responses:**
- **200**: Successful Response -> DoctorProfileOut
- **422**: Validation Error -> HTTPValidationError

## Admin diagnostics

### GET /api/v1/admin/health/diagnostics
**Summary:** System Diagnostics

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| x-admin-key | header | False | string |

**Responses:**
- **200**: Successful Response
- **422**: Validation Error -> HTTPValidationError

## Connections

### GET /api/v1/connections/doctors/search
**Summary:** Search verified doctors

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| pmdc_number | query | True | string |

**Responses:**
- **200**: Successful Response
- **401**: Unauthorized
- **403**: Forbidden - Only patients can search for doctors
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/connections/doctors/request
**Summary:** Request doctor connection

**Request Body (JSON):** ConnectionRequest

**Responses:**
- **200**: Successful Response -> ConnectionResponse
- **400**: Bad Request - Connection already exists or is pending
- **401**: Unauthorized
- **403**: Forbidden - Only patients can request doctor connections
- **404**: Not Found - Patient profile or doctor not found
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/connections/doctors/approve/{connection_id}
**Summary:** Approve connection request

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| connection_id | path | True | integer |

**Responses:**
- **200**: Successful Response -> ConnectionResponse
- **400**: Bad Request - Connection is not in pending status
- **401**: Unauthorized
- **403**: Forbidden - Only verified doctors can approve connections
- **404**: Not Found - Connection request not found
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/connections/doctors/{connection_id}
**Summary:** Revoke doctor connection

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| connection_id | path | True | integer |

**Responses:**
- **204**: Successful Response
- **401**: Unauthorized
- **403**: Forbidden - Only patients can revoke doctor connections
- **404**: Not Found - Connection request not found
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/connections/caretakers/request
**Summary:** Request caretaker connection

**Request Body (JSON):** CaretakerConnectionRequest

**Responses:**
- **200**: Successful Response -> ConnectionResponse
- **400**: Bad Request - Connection already exists or is pending
- **401**: Unauthorized
- **403**: Forbidden - Only patients can request connections
- **404**: Not Found - Patient profile or caretaker not found
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/connections/caretakers/pending
**Summary:** List pending requests

**Responses:**
- **200**: Successful Response

### POST /api/v1/connections/caretakers/approve/{connection_id}
**Summary:** Approve connection request

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| connection_id | path | True | integer |

**Responses:**
- **200**: Successful Response -> ConnectionResponse
- **400**: Bad Request - Connection is not in pending status
- **404**: Not Found - Connection request not found
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/connections/caretakers/{connection_id}
**Summary:** Revoke caretaker connection

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| connection_id | path | True | integer |

**Responses:**
- **204**: Successful Response
- **401**: Unauthorized
- **403**: Forbidden - Only patients can revoke caretaker connections
- **404**: Not Found - Connection request not found
- **422**: Validation Error -> HTTPValidationError

## Emergency sos

### GET /api/v1/emergency/contacts
**Summary:** List Emergency Contacts

**Responses:**
- **200**: A list of emergency contact objects.

### POST /api/v1/emergency/contacts
**Summary:** Add Emergency Contact

**Request Body (JSON):** EmergencyContactCreate

**Responses:**
- **201**: The newly created emergency contact object. -> EmergencyContactOut
- **422**: Validation Error -> HTTPValidationError

### PUT /api/v1/emergency/contacts/{contact_id}
**Summary:** Update Emergency Contact

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| contact_id | path | True | integer |

**Request Body (JSON):** EmergencyContactUpdate

**Responses:**
- **200**: Successful Response -> EmergencyContactOut
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/emergency/contacts/{contact_id}
**Summary:** Delete Emergency Contact

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| contact_id | path | True | integer |

**Responses:**
- **204**: Successful Response
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/emergency/sos/trigger
**Summary:** Trigger Emergency SOS

**Request Body (JSON):** SosTriggerRequest

**Responses:**
- **200**: An object acknowledging the trigger with the SOS event ID. -> SosEventCreateResponse
- **422**: Validation Error -> HTTPValidationError

## Medications

### GET /api/v1/medications
**Summary:** List Patient Medications

**Responses:**
- **200**: A list of medication objects.

### POST /api/v1/medications
**Summary:** Create Medication Prescription

**Request Body (JSON):** MedicationCreate

**Responses:**
- **201**: The newly registered medication prescription. -> MedicationOut
- **422**: Validation Error -> HTTPValidationError

### PUT /api/v1/medications/{med_id}
**Summary:** Update Medication Prescription

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| med_id | path | True | integer |

**Request Body (JSON):** MedicationUpdate

**Responses:**
- **200**: Successful Response -> MedicationOut
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/medications/{med_id}
**Summary:** Delete Medication (Soft)

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| med_id | path | True | integer |

**Responses:**
- **204**: Successful Response
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/medications/{med_id}/schedules
**Summary:** List Medication Schedules

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| med_id | path | True | integer |

**Responses:**
- **200**: A list of medication schedules.
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/medications/{med_id}/schedules
**Summary:** Add Medication Schedule

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| med_id | path | True | integer |

**Request Body (JSON):** MedicationScheduleCreate

**Responses:**
- **201**: The newly created schedule object. -> MedicationScheduleOut
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/medications/{med_id}/log
**Summary:** Log Medication Intake

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| med_id | path | True | integer |

**Request Body (JSON):** MedicationLogCreate

**Responses:**
- **201**: The medication log entry. -> MedicationLogOut
- **422**: Validation Error -> HTTPValidationError

## Lifestyle & diary

### GET /api/v1/lifestyle/sleep
**Summary:** List Sleep Logs

**Responses:**
- **200**: A list of sleep log entries.

### POST /api/v1/lifestyle/sleep
**Summary:** Log Daily Sleep

**Request Body (JSON):** SleepLogCreate

**Responses:**
- **201**: The newly created sleep log object. -> SleepLogOut
- **422**: Validation Error -> HTTPValidationError

### GET /api/v1/lifestyle/triggers
**Summary:** List Trigger Logs

**Responses:**
- **200**: A list of trigger logs.

### POST /api/v1/lifestyle/triggers
**Summary:** Log Seizure Trigger

**Request Body (JSON):** TriggerLogCreate

**Responses:**
- **201**: The recorded trigger log entry. -> TriggerLogOut
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/lifestyle/stress
**Summary:** Log Daily Stress Level

**Request Body (JSON):** StressLogCreate

**Responses:**
- **201**: The generated lifestyle log representing stress. -> LifestyleLogOut
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/lifestyle/menstruation
**Summary:** Log Menstruation Cycle

**Request Body (JSON):** MenstruationLogCreate

**Responses:**
- **201**: The generated lifestyle log representing menstruation. -> LifestyleLogOut
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/lifestyle/diet
**Summary:** Log Diet & Alcohol

**Request Body (JSON):** DietLogCreate

**Responses:**
- **201**: The generated lifestyle log representing diet/alcohol. -> LifestyleLogOut
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/lifestyle/illness
**Summary:** Log Illness & Fever

**Request Body (JSON):** IllnessLogCreate

**Responses:**
- **201**: The generated lifestyle log representing illness. -> LifestyleLogOut
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/lifestyle/med-side-effects
**Summary:** Log Medication Side Effects

**Request Body (JSON):** MedSideEffectLogCreate

**Responses:**
- **201**: The generated lifestyle log representing a medication side effect. -> LifestyleLogOut
- **422**: Validation Error -> HTTPValidationError

### POST /api/v1/lifestyle/screen-time
**Summary:** Log Screen Time

**Request Body (JSON):** ScreenTimeLogCreate

**Responses:**
- **201**: The generated lifestyle log representing screen time. -> LifestyleLogOut
- **422**: Validation Error -> HTTPValidationError

## Patient dashboard

### GET /api/v1/dashboard
**Summary:** Get Patient Dashboard Analytics

**Responses:**
- **200**: A JSON object containing the dashboard statistics and recommendations. -> DashboardStatsOut

## Manual seizure logs

### GET /api/v1/seizures/manual
**Summary:** List Manual Seizures

**Responses:**
- **200**: A list of manual seizure logs.

### POST /api/v1/seizures/manual
**Summary:** Log Manual Seizure

**Request Body (JSON):** ManualSeizureLogCreate

**Responses:**
- **201**: The newly created manual seizure log. -> ManualSeizureLogOut
- **422**: Validation Error -> HTTPValidationError

### PUT /api/v1/seizures/manual/{log_id}
**Summary:** Update Manual Seizure Log

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| log_id | path | True | integer |

**Request Body (JSON):** ManualSeizureLogUpdate

**Responses:**
- **200**: Successful Response -> ManualSeizureLogOut
- **422**: Validation Error -> HTTPValidationError

### DELETE /api/v1/seizures/manual/{log_id}
**Summary:** Delete Manual Seizure Log

**Parameters:**
| Name | In | Required | Type |
|---|---|---|---|
| log_id | path | True | integer |

**Responses:**
- **204**: Successful Response
- **422**: Validation Error -> HTTPValidationError

## Schemas

### AdminDashboardMetricsOut
| Property | Type | Description |
|---|---|---|
| total_users | integer |  |
| total_patients | integer |  |
| total_doctors | integer |  |
| total_caretakers | integer |  |
| total_admins | integer |  |
| pending_doctors | integer |  |
| total_seizures_logged | integer |  |
| total_medications_logged | integer |  |
| total_lifestyle_logs | integer |  |
| total_eegs_processed | integer |  |

### Body_upload_eeg_api_v1_eeg_upload_post
| Property | Type | Description |
|---|---|---|
| file | string |  |
| metadata | string, null |  |

### CaretakerConnectionRequest
| Property | Type | Description |
|---|---|---|
| caretaker_email | string |  |

### CaretakerProfileOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| relationship_to_patient | string, null |  |
| crisis_phone_number | string, null |  |
| created_at | string |  |
| updated_at | string |  |

### CaretakerProfileUpdate
| Property | Type | Description |
|---|---|---|
| relationship_to_patient | string, null |  |
| crisis_phone_number | string, null |  |

### ChangePasswordRequest
| Property | Type | Description |
|---|---|---|
| current_password | string |  |
| new_password | string |  |

### ConnectionRequest
| Property | Type | Description |
|---|---|---|
| doctor_id | integer |  |

### ConnectionResponse
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| patient_id | integer |  |
| doctor_id | integer, null |  |
| caretaker_id | integer, null |  |
| relationship_status | any |  |

### ConnectionStatus

### DashboardStatsOut
| Property | Type | Description |
|---|---|---|
| seizures_past_30_days | integer |  |
| avg_sleep_hours | number |  |
| medication_adherence_percent | number |  |
| recommendations | array |  |

### DietLogCreate
| Property | Type | Description |
|---|---|---|
| occurred_at | string |  |
| keto_compliant | boolean, null |  |
| alcohol_units | integer, null |  |
| notes | string, null |  |

### DoctorProfileOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| pmdc_number | string |  |
| specialty | string |  |
| hospital_affiliation | string, null |  |
| license_image_url | string, null |  |
| is_pmdc_verified | boolean |  |
| created_at | string |  |
| updated_at | string |  |

### DoctorProfileUpdate
| Property | Type | Description |
|---|---|---|
| specialty | string, null |  |
| hospital_affiliation | string, null |  |
| license_image_url | string, null |  |

### DoctorSearchResponse
| Property | Type | Description |
|---|---|---|
| doctor_id | integer |  |
| full_name | string |  |
| pmdc_number | string |  |
| specialty | string |  |
| hospital_affiliation | string, null |  |

### DoctorVerificationUpdate
| Property | Type | Description |
|---|---|---|
| is_verified | boolean | Set to true to verify the doctor, false to reject. |

### EegSessionList
| Property | Type | Description |
|---|---|---|
| items | array |  |
| total | integer |  |
| page | integer |  |
| per_page | integer |  |

### EegSessionOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| original_filename | string |  |
| file_size_bytes | integer |  |
| status | any |  |
| validation_result | , null |  |
| error_message | string, null |  |
| created_at | string |  |
| updated_at | string |  |

### EegSessionStatus

### EegValidationResult
| Property | Type | Description |
|---|---|---|
| valid | boolean |  |
| sampling_rate | number, null |  |
| duration_seconds | number, null |  |
| channels_found | integer, null |  |
| channels_used | integer, null |  |
| warnings | array |  |

### EmergencyContactCreate
| Property | Type | Description |
|---|---|---|
| name | string |  |
| relationship | string |  |
| phone_number | string |  |
| is_primary | boolean |  |

### EmergencyContactOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| name | string |  |
| relationship | string |  |
| phone_number | string |  |
| is_primary | boolean |  |
| verified | boolean |  |
| created_at | string |  |
| updated_at | string |  |

### EmergencyContactUpdate
| Property | Type | Description |
|---|---|---|
| name | string, null |  |
| relationship | string, null |  |
| phone_number | string, null |  |
| is_primary | boolean, null |  |

### HTTPValidationError
| Property | Type | Description |
|---|---|---|
| detail | array |  |

### HealthOut
| Property | Type | Description |
|---|---|---|
| status | string |  |
| version | string |  |
| environment | string |  |
| database_status | string |  |
| redis_status | string |  |
| timestamp | string |  |

### IllnessLogCreate
| Property | Type | Description |
|---|---|---|
| occurred_at | string |  |
| temperature_f | number, null | Body temperature in Fahrenheit |
| illness_type | string, null | e.g., Flu, Cold, Infection |
| notes | string, null |  |

### LifestyleLogOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| log_type | string |  |
| occurred_at | string |  |
| metadata_dict | object, null |  |
| notes | string, null |  |
| created_at | string |  |
| updated_at | string |  |

### LoginRequest
| Property | Type | Description |
|---|---|---|
| email | string |  |
| password | string |  |

### ManualSeizureLogCreate
| Property | Type | Description |
|---|---|---|
| occurred_at | string |  |
| duration_seconds | integer |  |
| seizure_type | string, null |  |
| auras_felt | string, null |  |
| post_ictal_symptoms | string, null |  |
| notes | string, null |  |

### ManualSeizureLogOut
| Property | Type | Description |
|---|---|---|
| occurred_at | string |  |
| duration_seconds | integer |  |
| seizure_type | string, null |  |
| auras_felt | string, null |  |
| post_ictal_symptoms | string, null |  |
| notes | string, null |  |
| id | integer |  |
| user_id | integer |  |

### ManualSeizureLogUpdate
| Property | Type | Description |
|---|---|---|
| occurred_at | string, null |  |
| duration_seconds | integer, null |  |
| seizure_type | string, null |  |
| auras_felt | string, null |  |
| post_ictal_symptoms | string, null |  |
| notes | string, null |  |

### MedSideEffectLogCreate
| Property | Type | Description |
|---|---|---|
| occurred_at | string |  |
| medication_name | string |  |
| severity | integer |  |
| symptom | string | e.g., Dizziness, Fatigue, Nausea |
| notes | string, null |  |

### MedicationCreate
| Property | Type | Description |
|---|---|---|
| name | string |  |
| dosage | string |  |
| frequency | string |  |
| start_date | string |  |
| notes | string, null |  |
| is_active | boolean |  |

### MedicationLogCreate
| Property | Type | Description |
|---|---|---|
| status | string |  |
| dose_taken | string, null |  |

### MedicationLogOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| medication_id | integer |  |
| taken_at | string |  |
| status | string |  |
| dose_taken | string, null |  |

### MedicationOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| name | string |  |
| dosage | string |  |
| frequency | string |  |
| start_date | string |  |
| notes | string, null |  |
| is_active | boolean |  |
| created_at | string |  |
| updated_at | string |  |

### MedicationScheduleCreate
| Property | Type | Description |
|---|---|---|
| scheduled_time | string |  |
| days_of_week | array, null |  |
| reminder_enabled | boolean |  |

### MedicationScheduleOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| medication_id | integer |  |
| scheduled_time | string |  |
| days_of_week | array, null |  |
| reminder_enabled | boolean |  |

### MedicationUpdate
| Property | Type | Description |
|---|---|---|
| name | string, null |  |
| dosage | string, null |  |
| frequency | string, null |  |
| start_date | string, null |  |
| notes | string, null |  |
| is_active | boolean, null |  |

### MenstruationLogCreate
| Property | Type | Description |
|---|---|---|
| occurred_at | string |  |
| flow_intensity | string | e.g., Light, Medium, Heavy |
| notes | string, null |  |

### ModelStatusOut
| Property | Type | Description |
|---|---|---|
| model | string |  |
| version | string, null |  |
| status | string |  |

### PatientProfileOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| date_of_birth | string |  |
| gender | string, null |  |
| blood_type | string, null |  |
| city | string, null |  |
| primary_diagnosis | string, null |  |
| emergency_contact_name | string, null |  |
| emergency_contact_relation | string, null |  |
| emergency_contact_phone | string, null |  |
| known_triggers | array, null |  |
| notes | string, null |  |
| timezone | string |  |
| created_at | string |  |
| updated_at | string |  |

### PatientProfileUpdate
| Property | Type | Description |
|---|---|---|
| date_of_birth | string, null |  |
| gender | string, null |  |
| blood_type | string, null |  |
| city | string, null |  |
| primary_diagnosis | string, null |  |
| emergency_contact_name | string, null |  |
| emergency_contact_relation | string, null |  |
| emergency_contact_phone | string, null |  |
| known_triggers | array, null |  |
| notes | string, null |  |
| timezone | string, null |  |

### PredictionOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| session_id | integer |  |
| user_id | integer |  |
| model_version | string, null |  |
| predicted_class | string |  |
| confidence | number |  |
| threshold | number |  |
| positive_windows | integer |  |
| total_windows | integer |  |
| max_probability | number |  |
| mean_probability | number |  |
| window_probabilities | array, null |  |
| status | string |  |
| started_at | string |  |
| completed_at | string, null |  |
| created_at | string |  |

### ResendOTPRequest
| Property | Type | Description |
|---|---|---|
| email | string |  |

### ScreenTimeLogCreate
| Property | Type | Description |
|---|---|---|
| occurred_at | string |  |
| duration_hours | integer | Hours of screen time |
| duration_minutes | integer | Minutes of screen time |
| device_type | string, null | e.g., Phone, Computer, TV |
| notes | string, null |  |

### SleepLogCreate
| Property | Type | Description |
|---|---|---|
| slept_at | string |  |
| woke_at | string |  |
| quality | integer, null |  |
| notes | string, null |  |

### SleepLogOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| slept_at | string |  |
| woke_at | string |  |
| duration_minutes | integer |  |
| quality | integer, null |  |
| notes | string, null |  |
| created_at | string |  |
| updated_at | string |  |

### SosEventCreateResponse
| Property | Type | Description |
|---|---|---|
| event_id | integer |  |
| status | string |  |
| message | string |  |

### SosTriggerRequest
| Property | Type | Description |
|---|---|---|
| latitude | number, null |  |
| longitude | number, null |  |
| location_available | boolean |  |

### StressLogCreate
| Property | Type | Description |
|---|---|---|
| severity | integer |  |
| occurred_at | string |  |
| notes | string, null |  |

### Token
| Property | Type | Description |
|---|---|---|
| access_token | string |  |
| refresh_token | string |  |
| token_type | string |  |

### TriggerLogCreate
| Property | Type | Description |
|---|---|---|
| trigger_name | string |  |
| severity | integer |  |
| occurred_at | string |  |
| notes | string, null |  |

### TriggerLogOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| user_id | integer |  |
| trigger_name | string |  |
| severity | integer |  |
| occurred_at | string |  |
| notes | string, null |  |
| created_at | string |  |
| updated_at | string |  |

### UserOut
| Property | Type | Description |
|---|---|---|
| id | integer |  |
| email | string |  |
| phone_number | string, null |  |
| full_name | string |  |
| role | any |  |
| is_active | boolean |  |
| is_email_verified | boolean |  |
| is_phone_verified | boolean |  |
| created_at | string |  |
| updated_at | string |  |

### UserProfileUpdate
| Property | Type | Description |
|---|---|---|
| full_name | string, null |  |
| phone_number | string, null |  |

### UserRegister
| Property | Type | Description |
|---|---|---|
| email | string |  |
| password | string |  |
| phone_number | string |  |
| full_name | string |  |
| role | string |  |
| pmdc_number | string, null | Required if role is DOCTOR |

### UserRole

### UserStatusUpdate
| Property | Type | Description |
|---|---|---|
| is_active | boolean | Set to false to suspend the user account. |

### ValidationError
| Property | Type | Description |
|---|---|---|
| loc | array |  |
| msg | string |  |
| type | string |  |
| input | any |  |
| ctx | object |  |

### VerifyOTPRequest
| Property | Type | Description |
|---|---|---|
| email | string |  |
| otp | string |  |

