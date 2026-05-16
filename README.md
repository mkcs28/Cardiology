# CardioAI — Full Stack Setup Guide

## Project Layout

```
cardioai/
 ├── api.py                   ← Flask REST API  (backend)
 ├── cardioai_backend.py      ← Original CLI tool  (standalone)
 ├── requirements.txt         ← Python dependencies
 ├── models/                  ← Put your .pth files here
 │    ├── TE_Transformer.pth
 │    ├── GAT_Transformer.pth
 │    └── Proposed.pth
 └── healthcare-ai/           ← React + Vite frontend
      ├── src/
      │    ├── api/
      │    │    ├── client.js   ← fetch wrappers for all endpoints
      │    │    └── useApi.js   ← loading/error hook
      │    ├── components/
      │    │    ├── Navbar.jsx
      │    │    └── ApiStatusBanner.jsx   ← live backend status
      │    └── pages/
      │         ├── CardioCalculator.jsx  ← POST /api/cardio/predict
      │         └── ECGCalculator.jsx    ← POST /api/ecg/analyze
      └── vite.config.js  ← proxies /api → localhost:5000
```

---

## 1 — Install Python dependencies

```bash
pip install -r requirements.txt
```

---

## 2 — Place trained model files

Copy your three `.pth` files into a `models/` folder next to `api.py`:

```
models/
 ├── TE_Transformer.pth
 ├── GAT_Transformer.pth
 └── Proposed.pth
```

Custom folder? Set the environment variable before starting the server:

```bash
export MODELS_DIR=/absolute/path/to/your/models
```

---

## 3 — Start the Flask API

```bash
python api.py
```

The API starts on **http://localhost:5000**. You will see:

```
🫀  CardioAI Flask API
Device     : CPU  (or CUDA)
Models dir : ./models
...
```

---

## 4 — Start the React frontend

```bash
cd healthcare-ai
npm install        # first time only
npm run dev
```

Opens at **http://localhost:5173**  
Vite automatically proxies all `/api/*` requests → `http://localhost:5000`.

---

## API Endpoints

| Method | Path                  | Description                                      |
|--------|-----------------------|--------------------------------------------------|
| GET    | `/api/health`         | Server status, device, loaded models             |
| GET    | `/api/models/status`  | Which `.pth` files exist / are loaded            |
| POST   | `/api/models/load`    | Pre-load a model into memory (JSON: `modelId`)   |
| POST   | `/api/ecg/analyze`    | Upload `.hea` + `.dat`, run inference            |
| GET    | `/api/results/history`| Saved predictions CSV as JSON                    |
| POST   | `/api/cardio/predict` | Cardiovascular risk from patient form JSON       |

### POST /api/ecg/analyze — multipart form

| Field       | Type   | Description                              |
|-------------|--------|------------------------------------------|
| `heaFile`   | File   | WFDB `.hea` header file                  |
| `datFile`   | File   | WFDB `.dat` signal file                  |
| `modelId`   | string | `"te"` \| `"gat"` \| `"proposed"`       |
| `threshold` | float  | Detection threshold, default `0.5`       |

**Response:**

```json
{
  "success": true,
  "record": "00001_lr",
  "model": { "id": "proposed", "name": "Proposed Model", "accuracy": "98.7%" },
  "predictions": [
    { "cls": "NORM", "label": "Normal Sinus Rhythm", "confidence": 0.921, "pct": 92.1, "detected": true },
    ...
  ],
  "detected": [...],
  "signalMetrics": { "heartRate": "72 BPM", "prInterval": "158 ms", ... },
  "waveformData": { "lead0": "0,70 1.5,68 3,30 ...", ... },
  "metrics": { "sensitivity": "98.2%", "specificity": "98.9%", "auc": "0.991" }
}
```

### POST /api/cardio/predict — JSON body

```json
{
  "age": 55, "gender": "male", "bmi": 28.5,
  "systolic": 135, "diastolic": 85, "cholesterol": 215,
  "glucose": 105, "smoking": "former", "hdl": 48, "ldl": 140,
  "physicalActivity": "low", "familyHistory": "yes"
}
```

**Response:**

```json
{
  "success": true,
  "riskPercent": 54,
  "riskCategory": "moderate",
  "confidence": 88,
  "recommendations": ["Consult a physician...", ...],
  "timestamp": "2024-11-15 14:32:10"
}
```

---

## How the connection works

```
Browser (React)
  │
  │  POST /api/ecg/analyze   (multipart: heaFile, datFile, modelId)
  │
  ▼
Vite dev server   →   proxy   →   Flask :5000
                                     │
                            load .hea + .dat via wfdb
                            normalise signal (12, T)
                            run model.forward(tensor)
                            compute signal metrics
                            build SVG waveform points
                            append to CSV
                                     │
                                  JSON response
                                     │
  React ECGCalculator.jsx ◄──────────┘
   • renders real waveform polylines per lead
   • shows all 5 class probability bars
   • displays real signal metrics (HR, PR, QRS, QT)
```

---

## Notes

- Models are **cached in memory** after first load — subsequent requests are fast.
- Results are **appended** to `models/recognition_results.csv` after each analysis.
- The frontend shows a live **backend status banner** at the top of each calculator page.
- If the backend is offline the frontend still renders with a demo ECG waveform.
