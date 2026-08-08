# Model artifact placeholder

Drop the exported ONNX artifact here as `model.onnx` (gitignored on purpose):

    models/seizure_detector/versions/v1/model.onnx

The backend registry (`app/ml/model_registry.py`) requires:
- model.onnx
- model_config.json
- preprocessing.json

until then `/api/v1/system/model` reports `unavailable` and EEG inference
returns 503 — by design (server stays up without an artifact).
