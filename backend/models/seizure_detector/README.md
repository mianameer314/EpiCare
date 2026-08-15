# AI Seizure Classification Model Directory

This directory stores the trained deep learning neural network models for EEG seizure detection.

## Where to place your trained model:

You can place your trained model in either of the following paths:

### Option A: Standard Direct File (Easiest)
Place your `.onnx` model file directly here:
```
backend/models/seizure_detector/model.onnx
```

### Option B: Versioned Package
```
backend/models/seizure_detector/
├── current.json                 --> {"active_version": "v1"}
└── versions/
    └── v1/
        ├── model.onnx
        ├── model_config.json    --> {"threshold": 0.5}
        └── preprocessing.json
```

## Hot-Reload Auto-Detection:
Once `model.onnx` is placed in this directory:
- The backend automatically detects and loads the model into memory.
- The UI status changes from **"Model Training in Progress"** to **"● Online & Ready"**.
- Clicking **"Run AI Analysis"** on any uploaded EEG recording will immediately execute full inference and output seizure classification reports without needing any server restart!
