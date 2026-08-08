# EpiCare — System Scope (Frozen)

## MVP (Core — In Scope)
- Authentication (register/login/refresh/logout, JWT access + refresh, bcrypt)
- Patient profile (name, DOB, gender, height, weight, known triggers, notes, timezone)
- EEG upload (EDF, optionally CSV) with strict validation
- EEG preprocessing (bandpass 0.5–70 Hz, 50/60 Hz notch, z-score, 10 s windows, STFT)
- Seizure / No-seizure binary classification with confidence
- Spectrogram display
- AI-generated structured report (grounded, no free-form diagnosis)
- Prediction history
- RAG medical chatbot (trusted corpus, guardrails, sources)
- Medication tracker (schedules, logs, adherence %)
- Lifestyle / trigger / sleep logging
- Recommendations (rules + ML, cold-start safe, non-medical advice only)
- Emergency contacts (max 3) + SOS alert (browser geolocation + Twilio SMS simulation)
- Patient dashboard (last analysis, adherence, sleep, triggers, quick actions)

## Explicitly Out of Scope (Future)
- Doctor portal, community features, wearable EEG, hospital integration
- Pre-ictal / seizure forecasting
- MRI/fMRI analysis
- Real emergency dispatch integration (SMS is simulated for FYP)
- Mobile app

## Non-Negotiable Product Rules
1. Binary classifier never claims seizure location, type, or diagnosis.
2. Report failure must not destroy the prediction result (fallback).
3. RAG answers must be grounded; refuses diagnosis, dosages, and self-diagnosis requests.
4. Recommender stays within lifestyle/education; dosage belongs to clinicians.
5. Training ≠ application: backend consumes versioned ONNX artifacts only.
