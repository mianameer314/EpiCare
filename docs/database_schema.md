# EpiCare — Database Schema

PostgreSQL 15 + pgvector. All tables use `DateTime(timezone=True)`, `created_at` / `updated_at` via `func.now()`.

## Core / Auth
- **users**: id PK, email unique, password_hash, is_active, created_at, updated_at
- **patient_profiles**: id PK, user_id FK unique, full_name, date_of_birth, gender, height_cm, weight_kg, known_triggers JSONB, notes, timezone

## EEG Pipeline
- **eeg_sessions**: id PK, user_id FK, patient_profile_id FK, original_filename, stored_path, file_size_bytes, file_hash, status enum (UPLOADED|VALIDATING|INVALID|PREPROCESSING|INFERENCE_RUNNING|REPORT_GENERATING|COMPLETED|FAILED), validation_result JSONB, error_message, created_at, updated_at
- **predictions**: id PK, session_id FK, user_id FK, model_version_id FK, predicted_class, confidence, threshold, positive_windows, total_windows, max_probability, mean_probability, window_probabilities JSONB, status, error_message, started_at, completed_at
- **ai_reports**: id PK, prediction_id FK unique, report_json JSONB, model_version, status, error_message, created_at

## Medication
- **medications**: id PK, user_id FK, name, dosage, frequency, start_date, notes, is_active
- **medication_schedules**: id PK, medication_id FK, scheduled_time, days_of_week JSONB, reminder_enabled
- **medication_logs**: id PK, schedule_id FK, medication_id FK, user_id FK, taken_at, status (TAKEN|MISSED|SKIPPED), dose_taken

## Lifestyle
- **lifestyle_logs**: id PK, user_id FK, log_type (SLEEP|TRIGGER|STRESS), occurred_at, notes
- **sleep_logs**: id PK, user_id FK, slept_at, woke_at, duration_minutes, quality, notes
- **trigger_logs**: id PK, user_id FK, trigger_name, severity, occurred_at, notes

## Recommendations
- **recommendations**: id PK, user_id FK, category, title, body, rationale, evidence_tags JSONB, created_at, is_dismissed

## Emergency
- **emergency_contacts**: id PK, user_id FK, name, relationship, phone_number, is_primary, verified
- **sos_events**: id PK, user_id FK, triggered_at, latitude, longitude, location_available, status, payload JSONB
- **sos_deliveries**: id PK, sos_event_id FK, contact_id FK, delivery_status, provider_message_id, error_message

## Chat / RAG
- **chat_sessions**: id PK, user_id FK, title, created_at
- **chat_messages**: id PK, session_id FK, user_id FK, role (USER|ASSISTANT), content, sources JSONB, created_at
- **rag_documents**: id PK, title, source_path, checksum, ingested_at, status
- **rag_chunks**: id PK, document_id FK, chunk_index, content, embedding vector(1536), metadata JSONB

## Model / Audit
- **model_versions**: id PK, name, version, framework, path, input_schema JSONB, threshold, accuracy, sensitivity, specificity, f1, auroc, created_at, is_active
- **audit_logs**: id PK, user_id FK, action, entity_type, entity_id, metadata JSONB, created_at

## Key Indexes
- `eeg_sessions(user_id, created_at desc)`, `predictions(session_id)`, `predictions(user_id, completed_at desc)`
- `medication_logs(user_id, taken_at)`, `chat_messages(session_id, created_at)`
- pgvector: HNSW index on `rag_chunks.embedding`
