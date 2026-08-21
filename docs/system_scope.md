# EpiCare — System Scope and Verified Status

> **Audit date:** 21 August 2026. The repository’s canonical completion matrix is [`implementation_status.md`](implementation_status.md).

## Implemented Product Scope

EpiCare currently contains a full-stack React/Vite and FastAPI platform for epilepsy care workflows. The implemented scope includes authentication and OTP verification, patient/doctor/caretaker/admin roles, profile management, PMDC verification, doctor discovery and connection workflows, EEG upload and preprocessing, frozen ONNX seizure-model serving, prediction history, medication tracking, lifestyle and seizure logging, recommendations, emergency contacts and SOS orchestration, dashboards, admin operations, shared profile photos, staged file uploads, local/S3 storage abstractions, database migrations, and protected role-based frontend routes.

The frontend is a live application rather than a skeleton. The route tree in `frontend/src/App.tsx` includes landing/auth screens, role-based dashboards, EEG, medications, lifestyle, emergency, care network, insights, chat, profile, doctor, caretaker, and admin workspaces.

## AI Work Remaining for the Future

### RAG medical assistant

The RAG database models, pgvector warm-up, upload route, and chat persistence exist, but production document ingestion, extraction, cleaning, chunking, embedding, similarity retrieval, citations, prompt grounding, injection safety, and evaluation are not implemented yet. The current chat response path is a deterministic clinical knowledge fallback.

### VLM report generation

The VLM service boundary is connected to EEG analysis as a non-blocking optional step, but the actual model/inference adapter, model artifact, structured report generation, validation, and regression fixtures remain future work. Until then, VLM reports must be treated as unavailable or placeholder output.

## Operational Qualifications

The frozen seizure detector has a real serving package and model artifact, but the package explicitly makes no clinical-readiness claim. SOS provider classes exist, but Firebase, WhatsApp, and Twilio branches may simulate success when credentials are absent. Email and S3 behavior similarly depends on valid deployment configuration.

The current backend test suite is not clean: four tests fail in channel mapping, preprocessing, and medication authorization. The frontend production build passes, while frontend lint still reports warnings. These issues are release-hardening work rather than new product modules.

## Explicitly Out of Scope

The following remain outside the current product scope unless separately approved:

- Pre-ictal seizure forecasting and seizure-type/location diagnosis.
- MRI/fMRI analysis, wearable EEG, hospital/EHR integration, and community/social features.
- Native mobile applications.
- Real emergency-dispatch integration beyond configured provider delivery; no system may imply guaranteed emergency response.
- Clinical diagnosis, medication prescribing recommendations from AI, dosage changes, or clinician replacement.

## Non-Negotiable Product Rules

1. The seizure classifier remains binary and must not claim seizure type, location, or diagnosis.
2. Prediction results must survive report-generation failure.
3. Future RAG answers must be grounded in trusted sources, cite evidence, refuse diagnosis and dosage changes, and defend against prompt injection.
4. Recommendations remain lifestyle and education oriented; prescription authority belongs to clinicians.
5. Training and application serving remain separate; the backend consumes versioned model artifacts only.
6. Missing external credentials must produce explicit unavailable/configuration states, not misleading successful-delivery claims, before production release.
