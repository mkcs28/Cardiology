# CardioAI — AI-Based Cardiovascular & ECG Risk Prediction Platform

A full-stack healthcare AI platform with a React + Vite frontend and a Python Flask backend serving real PyTorch ECG models.

---

## Live Demo (Frontend Only — Demo Mode)

Deploy the frontend to **Vercel** in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/mkcs28/Cardiology)

In **Demo Mode** (no backend), the app runs fully in the browser using a deterministic mock engine — all predictions are simulated locally, no server needed.

---

## Architecture

```
Browser (React + Vite)
    │
    │  /api/*  →  Flask :5000  (dev proxy)
    │          →  VITE_API_BASE  (production)
    │
    └── Smart client.js
            ├── Tries real backend first
            └── Falls back to mock engine if offline
```

---

## Quickstart — Local Development

### 1. Frontend

```bash
npm install
npm run dev
# → http://localhost:5173  (Demo Mode, no backend needed)
```

### 2. Backend (for real model inference)

```bash
pip install -r requirements.txt
python api.py
# → http://localhost:5000
```

Place your `.pth` files in `./models/`:
- `TE_Transformer.pth`
- `GAT_Transformer.pth`
- `Proposed.pth`

---

## Deployment

### Option A — Frontend only (Vercel or Netlify) · Free

The easiest path. The app works in Demo Mode with no backend.

**Vercel:**
1. Push repo to GitHub
2. Import repo at vercel.com → framework: **Vite** → Deploy
3. Done. Routes are handled by `vercel.json`.

**Netlify:**
1. Push repo to GitHub
2. Import at netlify.com → build command: `npm run build` → publish: `dist`
3. Done. Routes are handled by `public/_redirects`.

### Option B — Full stack (Frontend + Backend) · Recommended for real predictions

**Step 1 — Deploy backend to Render:**
1. Go to render.com → New Web Service → connect your GitHub repo
2. Build command: `pip install -r requirements.txt`
3. Start command: `gunicorn api:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
4. Add env var: `MODELS_DIR=./models`
5. Note your live URL, e.g. `https://cardioai-api.onrender.com`

**Step 2 — Deploy frontend to Vercel:**
1. Import repo at vercel.com
2. Add environment variable:
   ```
   VITE_API_BASE = https://cardioai-api.onrender.com/api
   ```
3. Deploy

**Step 3 — Done.** The frontend will now call your live Flask backend for real AI predictions.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE` | No | Full URL to Flask backend. If unset, app uses Demo Mode. |
| `MODELS_DIR` | No | Path to `.pth` files (default: `./models`) |
| `PORT` | No | Backend port (Render sets this automatically) |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Server status + device info |
| `GET` | `/api/models/status` | Which models are loaded |
| `POST` | `/api/models/load` | Load a model into memory |
| `POST` | `/api/ecg/analyze` | Upload `.hea` + `.dat`, get prediction |
| `GET` | `/api/results/history` | Past predictions from CSV |
| `POST` | `/api/cardio/predict` | Cardiovascular risk from form data |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Pure CSS |
| Backend | Python, Flask, Flask-CORS |
| AI Models | PyTorch, TE Transformer, GAT Transformer |
| ECG I/O | WFDB (MIT-BIH / PhysioNet format) |
| Deployment | Vercel (frontend), Render (backend) |

---

## Disclaimer

For research and educational purposes only. Not a substitute for professional medical advice.
