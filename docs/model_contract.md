# EpiCare — Model Contract

## Input Contract (frozen)
- Sampling rate: 256 Hz
- Window: 10 seconds (2560 samples)
- Channels: fixed canonical ordered list (see `backend/app/services/channel_mapper.py`)
- Raw input: float32 tensor shape `[batch, channels, 2560]`
- Spectrogram input: float32 tensor shape `[batch, channels, freq_bins, time_bins]`
- Normalization: z-score per channel (training and inference identical)

## Output Contract
- Probability: float in [0.0, 1.0]
- Classes: `0 = no seizure`, `1 = seizure`
- Aggregation rule: session-level seizure = true when ≥ 2 adjacent windows exceed threshold (validated in evaluation; stored in `model_config.json`)

## Model Version Package (models/seizure_detector/versions/vN/)
- `model.onnx` — exported artifact
- `model_config.json` — architecture name, input/output names + shapes, threshold, aggregation
- `preprocessing.json` — filters, notch, normalization, window, STFT params (single source of truth)
- `metrics.json` — accuracy, sensitivity, specificity, f1, auroc, false_alarms_per_hour
- `checksum.txt` — sha256 of `model.onnx`

## Activation Flow
1. Copy new version dir → `versions/v3/`
2. Validate: file exists → ONNX loads → input name/shape matches → output shape matches → dummy inference → finite output → probability in [0,1]
3. Update `models/seizure_detector/current.json` → `{"active_version": "v3"}`
4. Reload inference service (or restart) — no DB/API/frontend changes

## Guardrails
- Preprocessing used at inference MUST equal training preprocessing (no training-serving skew).
- Channel mapping is explicit; never silently reorder/drop channels.
- Missing channels: small set → fallback/interpolation strategy + warning; many missing → reject file.
- Sampling rate ≠ 256 Hz: resample from validated rates only; unsupported → reject with readable error.
