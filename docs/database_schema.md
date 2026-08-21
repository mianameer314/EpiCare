# EpiCare Database Schema

> **Status note — 21 August 2026:** This is a maintained schema reference, not an automatically generated snapshot. The live SQLAlchemy models, Alembic migrations, and current database are the source of truth. The doctor profile now also includes gender, certificate metadata, profile-photo metadata, experience, fee, day/time ranges, languages, biography, and consultation types; shared user profile-photo columns are also present. See [`implementation_status.md`](implementation_status.md) for the verified audit and update this document whenever the models or migrations change.

## Table: `users`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| email | VARCHAR(255) | False | False | None |  |
| password_hash | VARCHAR(255) | False | False | None |  |
| phone_number | VARCHAR(30) | False | True | None |  |
| fcm_token | VARCHAR(255) | False | True | None |  |
| full_name | VARCHAR(150) | False | False | None |  |
| role | VARCHAR(9) | False | False | UserRole.PATIENT |  |
| is_active | BOOLEAN | False | False | True |  |
| is_email_verified | BOOLEAN | False | False | False |  |
| is_phone_verified | BOOLEAN | False | False | False |  |
| otp_secret_hash | VARCHAR(255) | False | True | None |  |
| otp_expires_at | DATETIME | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `patient_profiles`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| date_of_birth | DATE | False | False | None |  |
| gender | VARCHAR(30) | False | True | None |  |
| blood_type | VARCHAR(10) | False | True | None |  |
| city | VARCHAR(100) | False | True | None |  |
| primary_diagnosis | VARCHAR(100) | False | True | None |  |
| emergency_contact_name | VARCHAR(150) | False | True | None |  |
| emergency_contact_relation | VARCHAR(100) | False | True | None |  |
| emergency_contact_phone | VARCHAR(30) | False | True | None |  |
| known_triggers | JSONB | False | True | None |  |
| notes | TEXT | False | True | None |  |
| timezone | VARCHAR(64) | False | False | UTC |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `doctor_profiles`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| pmdc_number | VARCHAR(50) | False | False | None |  |
| specialty | VARCHAR(100) | False | False | Neurologist |  |
| hospital_affiliation | VARCHAR(200) | False | True | None |  |
| license_image_url | VARCHAR(500) | False | True | None |  |
| is_pmdc_verified | BOOLEAN | False | False | False |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `caretaker_profiles`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| relationship_to_patient | VARCHAR(100) | False | True | None |  |
| crisis_phone_number | VARCHAR(30) | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `patient_doctor_networks`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| patient_id | INTEGER | False | False | None | patient_profiles.id |
| doctor_id | INTEGER | False | False | None | doctor_profiles.id |
| relationship_status | VARCHAR(7) | False | False | ConnectionStatus.PENDING |  |
| date_linked | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `patient_caretaker_networks`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| patient_id | INTEGER | False | False | None | patient_profiles.id |
| caretaker_id | INTEGER | False | False | None | caretaker_profiles.id |
| relationship_status | VARCHAR(7) | False | False | ConnectionStatus.PENDING |  |
| date_linked | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `eeg_sessions`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| original_filename | VARCHAR(255) | False | False | None |  |
| stored_path | VARCHAR(500) | False | False | None |  |
| file_size_bytes | BIGINT | False | False | None |  |
| file_hash | VARCHAR(64) | False | False | None |  |
| status | VARCHAR(30) | False | False | UPLOADED |  |
| validation_result | JSONB | False | True | None |  |
| error_message | TEXT | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `predictions`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| session_id | INTEGER | False | False | None | eeg_sessions.id |
| user_id | INTEGER | False | False | None | users.id |
| model_version_id | INTEGER | False | True | None | model_versions.id |
| predicted_class | VARCHAR(20) | False | False | None |  |
| confidence | FLOAT | False | False | None |  |
| threshold | FLOAT | False | False | None |  |
| positive_windows | INTEGER | False | False | 0 |  |
| total_windows | INTEGER | False | False | 0 |  |
| max_probability | FLOAT | False | False | None |  |
| mean_probability | FLOAT | False | False | None |  |
| window_probabilities | JSONB | False | True | None |  |
| status | VARCHAR(30) | False | False | COMPLETED |  |
| error_message | TEXT | False | True | None |  |
| started_at | DATETIME | False | False | None |  |
| completed_at | DATETIME | False | True | None |  |
| created_at | DATETIME | False | False | None |  |

## Table: `ai_reports`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| prediction_id | INTEGER | False | False | None | predictions.id |
| report_json | JSONB | False | False | None |  |
| model_version | VARCHAR(50) | False | False | None |  |
| status | VARCHAR(30) | False | False | COMPLETED |  |
| error_message | TEXT | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `medications`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| name | VARCHAR(150) | False | False | None |  |
| dosage | VARCHAR(100) | False | False | None |  |
| frequency | VARCHAR(50) | False | False | None |  |
| start_date | DATE | False | False | None |  |
| notes | TEXT | False | True | None |  |
| is_active | BOOLEAN | False | False | True |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `medication_schedules`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| medication_id | INTEGER | False | False | None | medications.id |
| scheduled_time | TIME | False | False | None |  |
| days_of_week | JSONB | False | True | None |  |
| reminder_enabled | BOOLEAN | False | False | True |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `medication_logs`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| schedule_id | INTEGER | False | True | None | medication_schedules.id |
| medication_id | INTEGER | False | False | None | medications.id |
| user_id | INTEGER | False | False | None | users.id |
| taken_at | DATETIME | False | False | None |  |
| status | VARCHAR(20) | False | False | TAKEN |  |
| dose_taken | VARCHAR(100) | False | True | None |  |

## Table: `lifestyle_logs`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| log_type | VARCHAR(20) | False | False | None |  |
| occurred_at | DATETIME | False | False | None |  |
| metadata_dict | JSONB | False | True | None |  |
| notes | TEXT | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `sleep_logs`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| slept_at | DATETIME | False | False | None |  |
| woke_at | DATETIME | False | False | None |  |
| duration_minutes | INTEGER | False | False | None |  |
| quality | INTEGER | False | True | None |  |
| notes | TEXT | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `trigger_logs`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| trigger_name | VARCHAR(100) | False | False | None |  |
| severity | INTEGER | False | False | 1 |  |
| occurred_at | DATETIME | False | False | None |  |
| notes | TEXT | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `recommendations`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| category | VARCHAR(50) | False | False | None |  |
| title | VARCHAR(200) | False | False | None |  |
| body | TEXT | False | False | None |  |
| rationale | TEXT | False | True | None |  |
| evidence_tags | JSONB | False | True | None |  |
| is_dismissed | BOOLEAN | False | False | False |  |
| created_at | DATETIME | False | False | None |  |

## Table: `emergency_contacts`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| name | VARCHAR(150) | False | False | None |  |
| relationship | VARCHAR(100) | False | False | None |  |
| phone_number | VARCHAR(30) | False | False | None |  |
| is_primary | BOOLEAN | False | False | False |  |
| verified | BOOLEAN | False | False | False |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `sos_events`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| triggered_at | DATETIME | False | False | None |  |
| latitude | FLOAT | False | True | None |  |
| longitude | FLOAT | False | True | None |  |
| location_available | BOOLEAN | False | False | False |  |
| status | VARCHAR(30) | False | False | SENDING |  |
| payload | JSONB | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `sos_deliveries`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| sos_event_id | INTEGER | False | False | None | sos_events.id |
| contact_id | INTEGER | False | False | None | emergency_contacts.id |
| delivery_status | VARCHAR(30) | False | False | PENDING |  |
| provider_message_id | VARCHAR(100) | False | True | None |  |
| error_message | TEXT | False | True | None |  |
| created_at | DATETIME | False | False | None |  |

## Table: `chat_sessions`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| title | VARCHAR(200) | False | False | New chat |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `chat_messages`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| session_id | INTEGER | False | False | None | chat_sessions.id |
| user_id | INTEGER | False | False | None | users.id |
| role | VARCHAR(20) | False | False | None |  |
| content | TEXT | False | False | None |  |
| sources | JSONB | False | True | None |  |
| created_at | DATETIME | False | False | None |  |

## Table: `rag_documents`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| title | VARCHAR(300) | False | False | None |  |
| source_path | VARCHAR(500) | False | False | None |  |
| checksum | VARCHAR(64) | False | False | None |  |
| status | VARCHAR(30) | False | False | INGESTED |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

## Table: `rag_chunks`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| document_id | INTEGER | False | False | None | rag_documents.id |
| chunk_index | INTEGER | False | False | None |  |
| content | VARCHAR | False | False | None |  |
| embedding | VECTOR(1536) | False | True | None |  |
| metadata | JSONB | False | True | None |  |
| created_at | DATETIME | False | False | None |  |

## Table: `model_versions`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| name | VARCHAR(100) | False | False | None |  |
| version | VARCHAR(20) | False | False | None |  |
| framework | VARCHAR(50) | False | False | onnx |  |
| path | VARCHAR(500) | False | False | None |  |
| input_schema | JSONB | False | True | None |  |
| threshold | FLOAT | False | False | 0.5 |  |
| accuracy | FLOAT | False | True | None |  |
| sensitivity | FLOAT | False | True | None |  |
| specificity | FLOAT | False | True | None |  |
| f1 | FLOAT | False | True | None |  |
| auroc | FLOAT | False | True | None |  |
| is_active | BOOLEAN | False | False | True |  |
| created_at | DATETIME | False | False | None |  |

## Table: `audit_logs`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | True | None | users.id |
| action | VARCHAR(100) | False | False | None |  |
| entity_type | VARCHAR(50) | False | False | None |  |
| entity_id | INTEGER | False | True | None |  |
| metadata | JSONB | False | True | None |  |
| created_at | DATETIME | False | False | None |  |

## Table: `manual_seizure_logs`

| Column | Type | Primary Key | Nullable | Default | Foreign Keys |
|---|---|---|---|---|---|
| id | INTEGER | True | False | None |  |
| user_id | INTEGER | False | False | None | users.id |
| occurred_at | DATETIME | False | False | None |  |
| duration_seconds | INTEGER | False | False | None |  |
| seizure_type | VARCHAR(100) | False | True | None |  |
| auras_felt | TEXT | False | True | None |  |
| post_ictal_symptoms | TEXT | False | True | None |  |
| notes | TEXT | False | True | None |  |
| created_at | DATETIME | False | False | None |  |
| updated_at | DATETIME | False | False | None |  |

