# CardioAI — Backend Setup Guide

## Why "Backend offline — model probabilities are simulated"?

This message means the frontend **cannot reach your Flask API**. Your actual `.pth` models
(`TE_Transformer.pth`, `GAT_Transformer.pth`, `Proposed.pth`, `BNN.pth`) live on the Flask
server and run via `numpy_inference.py`. Without the backend, PDF analysis falls back to
a deterministic mock — **not your trained models**.

---

## Option A — Local Development (recommended for testing)

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Start the Flask backend (port 5000)
python api.py

# 3. In a separate terminal, start the frontend
npm install
npm run dev
```

Your `.env` file should contain:
```
VITE_API_BASE=http://localhost:5000/api
```

The frontend will hit `http://localhost:5000/api` and your actual models will run.

---

## Option B — Render.com Deployment

### The cold-start problem
Render **free-tier** services spin down after 15 minutes of inactivity.
Cold-start takes **40–60 seconds**. The app now handles this by:
- Retrying up to **5 times** with **8-second gaps** (was 3 × 5s)
- Showing a **"Wake backend"** button in the status bar
- Polling every 30s to auto-update the banner when the backend comes alive

### Steps
1. Deploy both services via `render.yaml`
2. Make sure your Render backend URL in `.env` matches:
   ```
   VITE_API_BASE=https://cardioai-api-6vrf.onrender.com/api
   ```
   (replace `cardioai-api-6vrf` with your actual Render service name)
3. After deploying, **visit the backend URL directly first** to wake it:
   ```
   https://cardioai-api-6vrf.onrender.com/api/health
   ```
   You should see: `{"success": true, "device": "CPU", ...}`

### Verify models are loaded
```
https://cardioai-api-6vrf.onrender.com/api/models/status
```
Each model should show `"exists": true`. If `"exists": false`, the `.pth` files
are not being found — check that `MODELS_DIR=./models` is set in Render env vars
and that `models/` is **committed to git** (not in `.gitignore`).

---

## The PDF Analysis Pipeline (when backend is online)

```
User uploads PDF
    ↓
/api/ecg/extract-pdf          ← ecg_extractor.py (OpenCV)
    PDF → rasterise at 300 DPI (PyMuPDF)
    → remove ECG grid (HSV masking)
    → isolate trace pixels
    → per-column Y centroid → mV values
    → resample to 500 Hz
    Returns: { leads: { lead0: [...], lead1: [...], ... }, fs, heartRate, ... }
    ↓
/api/ecg/analyze-from-signal  ← api.py + numpy_inference.py
    Writes leads → WFDB .hea + .dat
    Loads your selected .pth model
    Runs forward pass (or MC-Dropout for BNN)
    Returns: { predictions: [...], detected: [...], waveformData: {...} }
    ↓
UI shows real model probabilities (not mock)
```

---

## Checking if it's working

Open browser DevTools → Network tab → upload a PDF → look for:
- `POST /api/ecg/extract-pdf` → should return `200` with lead arrays
- `POST /api/ecg/analyze-from-signal` → should return `200` with predictions

If you see `ERR_CONNECTION_REFUSED` → backend not running  
If you see `504 Gateway Timeout` → Render cold-start, click "Wake backend"  
If you see `404` → wrong `VITE_API_BASE` URL
