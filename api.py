# ============================================================
#  CardioAI — Flask REST API Backend
#  Connects the React frontend to ECG inference models
#
#  Endpoints:
#    GET  /api/health              — server + device status
#    GET  /api/models/status       — which .pth files are loaded
#    POST /api/models/load         — load a model into memory
#    POST /api/ecg/analyze         — upload .hea + .dat, run inference
#    GET  /api/results/history     — return saved CSV as JSON
#    POST /api/cardio/predict      — cardiovascular risk from form data
#
#  Run:
#    pip install flask flask-cors torch wfdb pandas numpy
#    python api.py
#    # or with a custom models folder:
#    MODELS_DIR=/path/to/models python api.py
# ============================================================

import os
import io
import shutil
import tempfile
import threading
from datetime import datetime

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import wfdb
from flask import Flask, jsonify, request
from flask_cors import CORS

# ─────────────────────────────────────────────────────────────
#  Configuration
# ─────────────────────────────────────────────────────────────
MODELS_DIR   = os.environ.get("MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))
CSV_PATH     = os.path.join(MODELS_DIR, "recognition_results.csv")
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"
DEFAULT_THRESHOLD = 0.5

CLASSES = ["CD", "HYP", "MI", "NORM", "STTC"]
CLASS_LABELS = {
    "CD":   "Conduction Disturbance",
    "HYP":  "Hypertrophy",
    "MI":   "Myocardial Infarction",
    "NORM": "Normal Sinus Rhythm",
    "STTC": "ST/T-wave Change",
}

# Maps frontend model ids → (display name, .pth filename, accuracy string)
MODEL_REGISTRY = {
    "te":       ("TE Transformer",   "TE_Transformer.pth",  "96.2%"),
    "gat":      ("GAT Transformer",  "GAT_Transformer.pth", "97.1%"),
    "proposed": ("Proposed Model",   "Proposed.pth",        "98.7%"),
}

# Metric benchmarks per model (shown in frontend Model Analysis card)
MODEL_METRICS = {
    "te":       {"sensitivity": "95.8%", "specificity": "96.1%", "auc": "0.974"},
    "gat":      {"sensitivity": "96.5%", "specificity": "97.0%", "auc": "0.978"},
    "proposed": {"sensitivity": "98.2%", "specificity": "98.9%", "auc": "0.991"},
}


# ─────────────────────────────────────────────────────────────
#  Model Architecture Definitions
# ─────────────────────────────────────────────────────────────

class TemporalEncoder(nn.Module):
    def __init__(self, d=128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(12, 64,  3, padding=1, dilation=1), nn.ReLU(),
            nn.Conv1d(64, 128, 3, padding=2, dilation=2), nn.ReLU(),
            nn.Conv1d(128, d,  3, padding=4, dilation=4), nn.ReLU(),
        )
    def forward(self, x):
        return self.net(x)


class MultiHeadGAT(nn.Module):
    def __init__(self, d, heads=4):
        super().__init__()
        self.W     = nn.Linear(d, d * heads)
        self.heads = heads

    def forward(self, Z):
        B, L, d = Z.shape
        Wh  = self.W(Z).view(B, L, self.heads, d)
        out = []
        for h in range(self.heads):
            Wh_h = Wh[:, :, h, :]
            A    = torch.softmax(Wh_h @ Wh_h.transpose(1, 2), dim=-1)
            out.append(A @ Wh_h)
        return torch.mean(torch.stack(out), dim=0)


class TE_Transformer(nn.Module):
    def __init__(self, d=128, nc=5):
        super().__init__()
        self.temp  = TemporalEncoder(d)
        self.trans = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model=d, nhead=4, batch_first=True), 2)
        self.fc = nn.Linear(d, nc)

    def forward(self, x):
        x = self.temp(x)
        x = x.permute(0, 2, 1)
        x = self.trans(x)
        return torch.sigmoid(self.fc(x.mean(1)))


class GAT_Transformer(nn.Module):
    def __init__(self, d=128, nc=5):
        super().__init__()
        self.input_proj = nn.Conv1d(12, d, 1)
        self.gat        = MultiHeadGAT(d)
        self.trans      = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model=d, nhead=4, batch_first=True), 2)
        self.fc = nn.Linear(d, nc)

    def forward(self, x):
        x = self.input_proj(x).permute(0, 2, 1)
        Z = x.mean(1).unsqueeze(1).repeat(1, 12, 1)
        x = x + self.gat(Z).mean(1, keepdim=True)
        return torch.sigmoid(self.fc(self.trans(x).mean(1)))


class LAGTT(nn.Module):
    def __init__(self, d=128, nc=5):
        super().__init__()
        self.temp  = TemporalEncoder(d)
        self.gat   = MultiHeadGAT(d)
        self.trans = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model=d, nhead=4, batch_first=True), 2)
        self.fc = nn.Linear(d, nc)

    def forward(self, x):
        x = self.temp(x).permute(0, 2, 1)
        Z = x.mean(1).unsqueeze(1).repeat(1, 12, 1)
        x = x + self.gat(Z).mean(1, keepdim=True)
        return torch.sigmoid(self.fc(self.trans(x).mean(1)))


MODEL_ARCH = {
    "te":       TE_Transformer,
    "gat":      GAT_Transformer,
    "proposed": LAGTT,
}


# ─────────────────────────────────────────────────────────────
#  In-memory model cache  (model_id → loaded nn.Module)
# ─────────────────────────────────────────────────────────────
_model_cache: dict[str, nn.Module] = {}
_cache_lock = threading.Lock()


def _pth_path(model_id: str) -> str:
    _, fname, _ = MODEL_REGISTRY[model_id]
    return os.path.join(MODELS_DIR, fname)


def _load_model(model_id: str) -> nn.Module:
    """Load a model from disk into the cache (thread-safe)."""
    with _cache_lock:
        if model_id in _model_cache:
            return _model_cache[model_id]
        pth = _pth_path(model_id)
        arch = MODEL_ARCH[model_id]
        m = arch(nc=len(CLASSES))
        state = torch.load(pth, map_location=DEVICE, weights_only=True)
        m.load_state_dict(state)
        m.to(DEVICE).eval()
        _model_cache[model_id] = m
        return m


# ─────────────────────────────────────────────────────────────
#  ECG Utilities
# ─────────────────────────────────────────────────────────────

def _read_ecg_from_uploads(hea_file, dat_file) -> tuple[torch.Tensor, str, np.ndarray]:
    """
    Save uploaded FileStorage objects to a temp dir, read with wfdb.
    Returns (tensor (1,12,T), record_base_name, raw_signal (12,T)).
    """
    tmp = tempfile.mkdtemp()
    try:
        base = os.path.splitext(hea_file.filename)[0]
        hea_file.save(os.path.join(tmp, base + ".hea"))
        dat_file.save(os.path.join(tmp, base + ".dat"))

        signal, _ = wfdb.rdsamp(os.path.join(tmp, base))   # (T, 12)
        signal    = signal.T                                 # (12, T)
        raw       = signal.copy()
        signal    = (signal - signal.mean()) / (signal.std() + 1e-8)

        tensor = torch.tensor(signal, dtype=torch.float32).unsqueeze(0)
        return tensor, base, raw
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _compute_signal_metrics(raw_signal: np.ndarray, fs: int = 500) -> dict:
    """
    Estimate basic ECG signal metrics from Lead I (row 0).
    These values populate the frontend Signal Metrics card.
    """
    lead = raw_signal[0]
    # Simple peak detection for heart rate
    threshold = lead.mean() + 0.6 * lead.std()
    above     = (lead > threshold).astype(int)
    crossings = np.where(np.diff(above) == 1)[0]

    if len(crossings) >= 2:
        rr_samples = np.diff(crossings)
        rr_mean_s  = float(np.mean(rr_samples)) / fs
        hr         = round(60.0 / rr_mean_s)
    else:
        hr = 75  # fallback

    hr = max(40, min(200, hr))

    # Rough interval estimates (ms) derived from HR
    pr  = round(120 + max(0, (80 - hr)) * 0.5)
    qrs = round(80  + max(0, (hr - 80)) * 0.2)
    qt  = round(350 + max(0, (80 - hr)) * 2.0)

    return {
        "heartRate":    f"{hr} BPM",
        "prInterval":   f"{pr} ms",
        "qrsDuration":  f"{qrs} ms",
        "qtInterval":   f"{qt} ms",
    }


def _signal_to_svg_points(raw_signal: np.ndarray, lead: int = 0,
                           width: int = 500, height: int = 140) -> str:
    """
    Downsample one ECG lead to `width` points and return an SVG
    polyline points string.  Used by the frontend waveform display.
    """
    sig = raw_signal[lead]
    n   = len(sig)
    if n > width:
        indices = np.linspace(0, n - 1, width, dtype=int)
        sig     = sig[indices]

    sig_min, sig_max = sig.min(), sig.max()
    sig_range = sig_max - sig_min if sig_max != sig_min else 1.0

    margin  = 0.1 * height
    y_scale = (height - 2 * margin) / sig_range
    points  = []
    for i, v in enumerate(sig):
        x = round(i * width / len(sig), 2)
        y = round(height - margin - (v - sig_min) * y_scale, 2)
        points.append(f"{x},{y}")

    return " ".join(points)


def _run_inference(model: nn.Module, tensor: torch.Tensor,
                   threshold: float) -> list[dict]:
    with torch.no_grad():
        probs = model(tensor.to(DEVICE)).cpu().numpy()[0]

    results = []
    for cls, prob in zip(CLASSES, probs):
        results.append({
            "cls":        cls,
            "label":      CLASS_LABELS[cls],
            "confidence": round(float(prob), 4),
            "pct":        round(float(prob) * 100, 1),
            "detected":   bool(prob >= threshold),
        })

    # Sort highest confidence first (matches frontend prob-bar display)
    results.sort(key=lambda r: r["confidence"], reverse=True)
    return results


def _append_csv(record: str, model_id: str, results: list[dict],
                timestamp: str) -> None:
    """Persist results to the rolling CSV file."""
    model_name, _, accuracy = MODEL_REGISTRY[model_id]
    rows = [
        {
            "Record":     record,
            "Model":      model_name,
            "ModelID":    model_id,
            "Accuracy":   accuracy,
            "Class":      r["cls"],
            "Full Name":  r["label"],
            "Confidence": r["confidence"],
            "Detected":   r["detected"],
            "Timestamp":  timestamp,
        }
        for r in results
    ]
    os.makedirs(MODELS_DIR, exist_ok=True)
    df_new = pd.DataFrame(rows)
    if os.path.exists(CSV_PATH):
        df_all = pd.concat([pd.read_csv(CSV_PATH), df_new], ignore_index=True)
    else:
        df_all = df_new
    df_all.to_csv(CSV_PATH, index=False)


# ─────────────────────────────────────────────────────────────
#  Cardiovascular Risk Scoring  (mirrors CardioCalculator.jsx)
# ─────────────────────────────────────────────────────────────

def _cardio_risk_score(data: dict) -> dict:
    score = 0
    age  = int(data.get("age", 45))
    if age > 60:   score += 25
    elif age > 45: score += 15
    elif age > 35: score += 8

    if data.get("gender") == "male": score += 8

    bmi = float(data.get("bmi", 25))
    if bmi > 30:   score += 15
    elif bmi > 25: score += 8

    systolic = int(data.get("systolic", 120))
    if systolic > 140:   score += 20
    elif systolic > 130: score += 10

    chol = int(data.get("cholesterol", 200))
    if chol > 240:   score += 15
    elif chol > 200: score += 8

    glucose = int(data.get("glucose", 90))
    if glucose > 126:   score += 15
    elif glucose > 100: score += 7

    smoking = data.get("smoking", "no")
    if smoking == "yes":    score += 18
    elif smoking == "former": score += 8

    hdl = int(data.get("hdl", 55))
    if hdl < 40:   score += 12
    elif hdl > 60: score -= 5

    if int(data.get("ldl", 120)) > 160: score += 12

    activity = data.get("physicalActivity", "moderate")
    if activity == "none":   score += 12
    elif activity == "low":  score += 6
    elif activity == "high": score -= 8

    if data.get("familyHistory") == "yes": score += 15

    pct      = min(max(round(score * 0.9), 3), 97)
    category = "low" if pct < 30 else "moderate" if pct < 60 else "high"
    confidence = min(94, 82 + round(pct * 0.12))

    recs_map = {
        "low": [
            "Maintain current healthy lifestyle habits.",
            "Continue regular moderate physical activity (150 min/week).",
            "Annual cardiovascular check-ups recommended.",
            "Keep a heart-healthy, balanced diet.",
        ],
        "moderate": [
            "Consult a physician for further cardiovascular evaluation.",
            "Increase physical activity to at least 150–200 min/week.",
            "Monitor blood pressure and cholesterol regularly.",
            "Reduce saturated fat and sodium intake.",
            "Smoking cessation is strongly advised if applicable.",
        ],
        "high": [
            "Seek immediate medical consultation.",
            "Comprehensive cardiovascular testing is recommended.",
            "Adhere strictly to any prescribed medications.",
            "Intensive lifestyle modification programme required.",
            "Regular monitoring of all cardiovascular risk factors.",
        ],
    }

    return {
        "riskPercent":     pct,
        "riskCategory":    category,
        "confidence":      confidence,
        "recommendations": recs_map[category],
        "timestamp":       datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


# ─────────────────────────────────────────────────────────────
#  Flask Application
# ─────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://127.0.0.1:3000"])


def _ok(data: dict, status: int = 200):
    return jsonify({"success": True,  **data}), status

def _err(msg: str, status: int = 400):
    return jsonify({"success": False, "error": msg}), status


# ── GET /api/health ───────────────────────────────────────────
@app.get("/api/health")
def health():
    return _ok({
        "status":       "online",
        "device":       DEVICE.upper(),
        "modelsDir":    MODELS_DIR,
        "modelsLoaded": list(_model_cache.keys()),
        "timestamp":    datetime.now().isoformat(),
    })


# ── GET /api/models/status ────────────────────────────────────
@app.get("/api/models/status")
def models_status():
    statuses = []
    for model_id, (name, fname, acc) in MODEL_REGISTRY.items():
        pth      = _pth_path(model_id)
        statuses.append({
            "id":       model_id,
            "name":     name,
            "accuracy": acc,
            "file":     fname,
            "exists":   os.path.isfile(pth),
            "loaded":   model_id in _model_cache,
            "metrics":  MODEL_METRICS[model_id],
        })
    return _ok({"models": statuses})


# ── POST /api/models/load ─────────────────────────────────────
@app.post("/api/models/load")
def load_model_endpoint():
    body     = request.get_json(silent=True) or {}
    model_id = body.get("modelId", "").strip()

    if model_id not in MODEL_REGISTRY:
        return _err(f"Unknown modelId '{model_id}'. Choose: {list(MODEL_REGISTRY)}")

    pth = _pth_path(model_id)
    if not os.path.isfile(pth):
        return _err(f"Model file not found: {pth}", 404)

    try:
        _load_model(model_id)
        name, _, acc = MODEL_REGISTRY[model_id]
        return _ok({"modelId": model_id, "name": name, "accuracy": acc,
                    "device": DEVICE.upper(), "message": f"{name} loaded successfully."})
    except Exception as exc:
        return _err(f"Failed to load model: {exc}", 500)


# ── POST /api/ecg/analyze ─────────────────────────────────────
@app.post("/api/ecg/analyze")
def ecg_analyze():
    # ── Validate inputs ──────────────────────────────────────
    model_id = request.form.get("modelId", "proposed").strip()
    if model_id not in MODEL_REGISTRY:
        return _err(f"Unknown modelId '{model_id}'.")

    threshold = float(request.form.get("threshold", DEFAULT_THRESHOLD))
    if not (0.0 < threshold < 1.0):
        return _err("threshold must be between 0 and 1.")

    hea_file = request.files.get("heaFile")
    dat_file = request.files.get("datFile")
    if not hea_file or not dat_file:
        return _err("Both heaFile (.hea) and datFile (.dat) are required.")

    if not hea_file.filename.lower().endswith(".hea"):
        return _err("heaFile must have a .hea extension.")
    if not dat_file.filename.lower().endswith(".dat"):
        return _err("datFile must have a .dat extension.")

    # ── Load model (cached after first call) ─────────────────
    pth = _pth_path(model_id)
    if not os.path.isfile(pth):
        return _err(f"Model file not found: {pth}. Place it in {MODELS_DIR}.", 404)

    try:
        model = _load_model(model_id)
    except Exception as exc:
        return _err(f"Could not load model: {exc}", 500)

    # ── Read ECG, run inference ───────────────────────────────
    try:
        tensor, record_name, raw_signal = _read_ecg_from_uploads(hea_file, dat_file)
    except Exception as exc:
        return _err(f"Failed to read ECG files: {exc}")

    try:
        results = _run_inference(model, tensor, threshold)
    except Exception as exc:
        return _err(f"Inference failed: {exc}", 500)

    # ── Signal metrics + waveform points ─────────────────────
    signal_metrics = _compute_signal_metrics(raw_signal)
    lead_points    = {
        f"lead{i}": _signal_to_svg_points(raw_signal, lead=i)
        for i in range(min(6, raw_signal.shape[0]))  # Lead I–VI
    }

    # ── Build response ────────────────────────────────────────
    model_name, _, accuracy = MODEL_REGISTRY[model_id]
    timestamp  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    detected   = [r for r in results if r["detected"]]

    _append_csv(record_name, model_id, results, timestamp)

    return _ok({
        "record":        record_name,
        "model":         {"id": model_id, "name": model_name, "accuracy": accuracy},
        "threshold":     threshold,
        "timestamp":     timestamp,
        "device":        DEVICE.upper(),
        "predictions":   results,           # sorted by confidence desc
        "detected":      detected,          # only classes above threshold
        "signalMetrics": signal_metrics,
        "waveformData":  lead_points,       # SVG polyline points per lead
        "metrics":       MODEL_METRICS[model_id],
    })


# ── GET /api/results/history ──────────────────────────────────
@app.get("/api/results/history")
def results_history():
    if not os.path.exists(CSV_PATH):
        return _ok({"records": [], "total": 0})

    df = pd.read_csv(CSV_PATH)

    # Optional filters
    model_id = request.args.get("modelId")
    record   = request.args.get("record")
    limit    = int(request.args.get("limit", 100))

    if model_id:
        df = df[df["ModelID"] == model_id]
    if record:
        df = df[df["Record"].str.contains(record, case=False, na=False)]

    df = df.tail(limit)
    return _ok({"records": df.to_dict(orient="records"), "total": len(df)})


# ── POST /api/cardio/predict ──────────────────────────────────
@app.post("/api/cardio/predict")
def cardio_predict():
    data = request.get_json(silent=True)
    if not data:
        return _err("JSON body required.")

    required = ["age", "gender", "bmi", "systolic", "cholesterol"]
    missing  = [f for f in required if f not in data]
    if missing:
        return _err(f"Missing fields: {', '.join(missing)}")

    try:
        result = _cardio_risk_score(data)
        return _ok(result)
    except Exception as exc:
        return _err(f"Prediction failed: {exc}", 500)


# ─────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    os.makedirs(MODELS_DIR, exist_ok=True)
    print("\n" + "═" * 60)
    print("   🫀  CardioAI Flask API")
    print("═" * 60)
    print(f"   Device     : {DEVICE.upper()}")
    print(f"   Models dir : {MODELS_DIR}")
    print(f"   CSV output : {CSV_PATH}")
    print()
    print("   Endpoints:")
    print("   GET  /api/health")
    print("   GET  /api/models/status")
    print("   POST /api/models/load")
    print("   POST /api/ecg/analyze      (multipart: heaFile, datFile, modelId)")
    print("   GET  /api/results/history")
    print("   POST /api/cardio/predict   (JSON body)")
    print()
    print("   Frontend dev server: http://localhost:5173")
    print("   API server:          http://localhost:5000")
    print("═" * 60 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=True)
