# EpiCare — API Contract (v1)

Base path: `/api/v1`. Auth: `Authorization: Bearer <access_token>` (except auth + system endpoints).
Error shape everywhere:

```json
{ "error": { "code": "INVALID_EEG_FILE", "message": "The uploaded EEG file could not be read.", "details": null } }
```

## Auth
- `POST /auth/register` → `201` UserOut | `409` duplicate email
- `POST /auth/login` → `200` Token | `401` invalid credentials
- `POST /auth/refresh` → `200` Token
- `POST /auth/logout` → `204`
- `GET /auth/me` → `200` UserOut
- `PATCH /auth/me` → `200` UserOut

## System
- `GET /system/health` → `{ "status": "healthy" }`
- `GET /system/model` → `{ "model": "EpiCareFusion", "version": "v1", "status": "loaded" | "unavailable" }`

## Users / Patient Profile
- `GET /users/me` → `200` UserOut (+ PatientProfile)
- `PATCH /users/me` → `200` UserOut
- `GET /users/me/profile`, `PUT /users/me/profile`

## EEG
- `POST /eeg/upload` (multipart: `file`, optional `metadata`) → `201` { session_id, status: "UPLOADED" }
- `GET /eeg/sessions` → paginated sessions
- `GET /eeg/sessions/{id}` → session detail incl. validation result + status
- `GET /eeg/sessions/{id}/spectrogram` → image
- `POST /eeg/sessions/{id}/analyze` → starts/returns prediction

## Predictions / Reports
- `GET /predictions` → paginated history (date, file, result, confidence, model, status)
- `GET /predictions/{id}` → full detail (window probabilities, aggregate, model version)
- `GET /reports/{prediction_id}` → structured report
- `POST /reports/{prediction_id}/regenerate` → regenerated report

## Chatbot
- `GET /chatbot/sessions` · `POST /chatbot/sessions`
- `GET /chatbot/sessions/{id}/messages` · `POST /chatbot/sessions/{id}/messages` → answer + sources

## Medications
- `GET/POST /medications` · `GET/PATCH/DELETE /medications/{id}`
- `GET/POST /medications/{id}/schedules` · `PATCH /medications/{id}/schedules/{sid}`
- `POST /medications/{id}/logs` (taken/missed) · `GET /medications/adherence` → adherence %

## Lifestyle
- `POST /lifestyle/sleep` · `POST /lifestyle/triggers` · `POST /lifestyle/stress`
- `GET /lifestyle/summary` (recent aggregates)

## Recommendations
- `GET /recommendations` · `POST /recommendations/regenerate`

## Emergency
- `GET/POST /emergency/contacts` (max 3) · `PATCH/DELETE /emergency/contacts/{id}`
- `POST /emergency/sos` → creates event, sends SMS per contact, returns per-contact delivery state
- `GET /emergency/sos-events` → history

## History / Dashboard
- `GET /history/dashboard` → aggregates (analyses, adherence, sleep, recent triggers)
