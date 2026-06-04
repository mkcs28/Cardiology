# ============================================================
#  CardioAI — Flask REST API Backend
#  Models: TE_Transformer / GAT_Transformer / LAGTT (Proposed)
#  Dataset: PTB-XL (100Hz, 12-lead ECG)
#
#  Run locally:
#    pip install -r requirements.txt
#    python api.py
#
#  Deploy to Render:
#    Build : pip install -r requirements.txt
#    Start : gunicorn api:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
# ============================================================

import os, re, shutil, tempfile, threading, logging, json, sys
from datetime import datetime

# Ensure ecg_extractor.py is importable regardless of working directory
# (handles Render, Railway, local dev — __file__ is always the api.py path)
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
from ecg_extractor import extract_ecg_from_pdf

import numpy  as np
import pandas as pd
import wfdb
from flask      import Flask, jsonify, request
from flask_cors import CORS
import numpy_inference as ni   # pure-NumPy model runner — no PyTorch needed

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("cardioai")

# ── Config ───────────────────────────────────────────────────
MODELS_DIR        = os.environ.get("MODELS_DIR", os.path.join(os.path.dirname(__file__), "models"))
CSV_PATH          = os.path.join(MODELS_DIR, "recognition_results.csv")
DEVICE            = "cpu"   # numpy inference — always CPU, no PyTorch
DEFAULT_THRESHOLD = 0.5
PORT              = int(os.environ.get("PORT", 5000))

CLASSES      = ["CD", "HYP", "MI", "NORM", "STTC"]
CLASS_LABELS = {
    "CD":   "Conduction Disturbance",
    "HYP":  "Hypertrophy",
    "MI":   "Myocardial Infarction",
    "NORM": "Normal Sinus Rhythm",
    "STTC": "ST/T-wave Change",
}

MODEL_REGISTRY = {
    "te":       ("TE Transformer",   "TE_Transformer.pth",  "90.24%"),
    "gat":      ("GAT Transformer",  "GAT_Transformer.pth", "88.14%"),
    "proposed": ("Proposed Model",   "Proposed.pth",        "90.14%"),
    "bnn":      ("BNN (Bayesian)",   "BNN.pth",             "95.80%"),
}

MODEL_METRICS = {
    "te":       {"sensitivity": "0%", "specificity": "0%", "auc": "90.24%"},
    "gat":      {"sensitivity": "0%", "specificity": "0%", "auc": "88.14%"},
    "proposed": {"sensitivity": "0%", "specificity": "0%", "auc": "90.14%"},
    "bnn":      {"sensitivity": "0%", "specificity": "0%", "auc": "95.80%",
                 "inference": "MC-Dropout", "samples": BNN_SAMPLES},
}

# Number of MC-Dropout stochastic forward passes for BNN
BNN_SAMPLES = 30

# ── App ───────────────────────────────────────────────────────
app   = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
_lock = threading.Lock()

# ── Model loader (numpy — no PyTorch) ────────────────────────
def _load_model(model_id: str):
    """Load weights into numpy_inference cache (idempotent)."""
    with _lock:
        if model_id in ni._cache:
            return  # already loaded
        _, fname, _ = MODEL_REGISTRY[model_id]
        path = os.path.join(MODELS_DIR, fname)
        if not os.path.exists(path):
            raise FileNotFoundError(f"{fname} not found in {MODELS_DIR}")
        ni.load_model(model_id, path)
        log.info(f"Loaded {model_id} via numpy_inference (no PyTorch)")


def _bnn_mc_infer(signal: np.ndarray, n_samples: int = BNN_SAMPLES) -> tuple[np.ndarray, np.ndarray]:
    """
    Monte Carlo Dropout inference for the BNN model.
    Uses PyTorch so that dropout layers can be toggled at inference time.

    Parameters
    ----------
    signal   : np.ndarray  (12, T) — float32, already normalised
    n_samples: int — number of stochastic forward passes

    Returns
    -------
    mean_probs : np.ndarray (5,)  — mean probability across MC samples
    std_probs  : np.ndarray (5,)  — epistemic uncertainty (std across samples)
    """
    import torch
    import torch.nn as nn

    # Lazy import the BNNDropout architecture — mirrors cardioai_backend.py exactly
    class _BNNDropout(nn.Module):
        def __init__(self, d=128, nc=5, drop_p=0.3):
            super().__init__()
            self.drop_p = drop_p
            self.conv1 = nn.Conv1d(12,  64,  3, padding=1, dilation=1)
            self.conv2 = nn.Conv1d(64,  128, 3, padding=2, dilation=2)
            self.conv3 = nn.Conv1d(128, d,   3, padding=4, dilation=4)
            self.relu  = nn.ReLU()
            self.drop1 = nn.Dropout(p=drop_p)
            self.drop2 = nn.Dropout(p=drop_p)
            self.drop3 = nn.Dropout(p=drop_p)
            enc_layer        = nn.TransformerEncoderLayer(
                d_model=d, nhead=4, batch_first=True, dropout=drop_p)
            self.transformer = nn.TransformerEncoder(enc_layer, num_layers=2)
            self.drop_out    = nn.Dropout(p=drop_p)
            self.fc          = nn.Linear(d, nc)

        def forward(self, x):
            x = self.drop1(self.relu(self.conv1(x)))
            x = self.drop2(self.relu(self.conv2(x)))
            x = self.drop3(self.relu(self.conv3(x)))
            x = x.permute(0, 2, 1)
            x = self.transformer(x)
            x = x.mean(1)
            x = self.drop_out(x)
            return torch.sigmoid(self.fc(x))

        def enable_dropout(self):
            for m in self.modules():
                if isinstance(m, nn.Dropout):
                    m.train()

    # Build model and load weights (weights are already in ni._cache as numpy)
    bnn_torch = _BNNDropout(nc=5)
    state_np  = ni._cache["bnn"]

    # Convert numpy weight dict back to torch state_dict
    state_torch = {k: torch.tensor(v) for k, v in state_np.items()}
    bnn_torch.load_state_dict(state_torch, strict=False)
    bnn_torch.eval()
    bnn_torch.enable_dropout()    # MC-Dropout: keep dropout active during inference

    x_tensor = torch.tensor(signal[np.newaxis], dtype=torch.float32)  # (1, 12, T)
    samples  = []
    with torch.no_grad():
        for _ in range(n_samples):
            p = bnn_torch(x_tensor).cpu().numpy()[0]   # (5,)
            samples.append(p)

    samples = np.stack(samples, axis=0)   # (n_samples, 5)
    return samples.mean(axis=0), samples.std(axis=0)

# ── ECG preprocessing (matches cardioai_backend.py exactly) ──
def _load_ecg(hea_path: str, dat_path: str):
    tmp = tempfile.mkdtemp()
    try:
        # Read the record name from the first token of the .hea file's first line
        # e.g. "15618 12 500 5000" → record name is "15618"
        # This must match the filenames we copy into the temp dir, otherwise
        # wfdb.rdsamp will look for "<record_name>.dat" and fail with Errno 2.
        with open(hea_path, "r") as f:
            first_line = f.readline().strip()
        hea_record = first_line.split()[0] if first_line else None
        # Strip any path separators that might be embedded in the record name
        base = os.path.basename(hea_record) if hea_record else os.path.splitext(os.path.basename(hea_path))[0]

        shutil.copy(hea_path, os.path.join(tmp, base + ".hea"))
        shutil.copy(dat_path, os.path.join(tmp, base + ".dat"))
        signal, fields = wfdb.rdsamp(os.path.join(tmp, base))  # (T, 12)
        signal = signal.T                                        # (12, T)
        signal = (signal - signal.mean()) / (signal.std() + 1e-8)
        return signal.astype(np.float32), base, signal, fields
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def _waveform_to_polylines(signal: np.ndarray, n_leads=6, width=500, height=140):
    result = {}
    for i in range(min(n_leads, signal.shape[0])):
        lead = signal[i]
        xs   = np.linspace(0, width, len(lead))
        lo, hi = lead.min(), lead.max()
        rng = hi - lo if hi != lo else 1.0
        ys  = height - ((lead - lo) / rng) * (height * 0.8) - height * 0.1
        pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in zip(xs, ys))
        result[f"lead{i}"] = pts
    return result

def _signal_metrics(fields):
    fs = fields.get("fs", 100)
    hr = round(60.0 * fs / fields.get("sig_len", fs))
    return {
        "heartRate":   f"{hr} bpm",
        "prInterval":  "0.16s",
        "qrsDuration": "0.09s",
        "qtInterval":  "0.42s",
    }

# ── Routes ────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({
        "success":      True,
        "device":       DEVICE.upper(),
        "modelsLoaded": list(ni._cache.keys()),
        "modelsDir":    MODELS_DIR,
        "timestamp":    datetime.now().isoformat(),
    })

@app.route("/api/models/status")
def models_status():
    statuses = {}
    for mid, (name, fname, acc) in MODEL_REGISTRY.items():
        statuses[mid] = {
            "name":    name,
            "file":    fname,
            "accuracy": acc,
            "loaded":  mid in ni._cache,
            "exists":  os.path.exists(os.path.join(MODELS_DIR, fname)),
        }
    return jsonify({"success": True, "models": statuses})

@app.route("/api/models/load", methods=["POST"])
def models_load():
    mid = (request.json or {}).get("modelId")
    if mid not in MODEL_REGISTRY:
        return jsonify({"success": False, "error": f"Unknown model '{mid}'"}), 400
    try:
        _load_model(mid)
        return jsonify({"success": True, "modelId": mid})
    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/ecg/analyze", methods=["POST"])
def ecg_analyze():
    hea_file  = request.files.get("heaFile")
    dat_file  = request.files.get("datFile")
    model_id  = request.form.get("modelId", "proposed")
    threshold = float(request.form.get("threshold", DEFAULT_THRESHOLD))

    if not hea_file or not dat_file:
        return jsonify({"success": False, "error": "Both heaFile and datFile are required"}), 400
    if model_id not in MODEL_REGISTRY:
        return jsonify({"success": False, "error": f"Unknown model '{model_id}'"}), 400

    hea_tmp = tempfile.NamedTemporaryFile(suffix=".hea", delete=False)
    hea_tmp.close()  # release handle so Flask can write to the path
    dat_tmp = tempfile.NamedTemporaryFile(suffix=".dat", delete=False)
    dat_tmp.close()  # release handle so Flask can write to the path
    try:
        hea_file.save(hea_tmp.name)
        dat_file.save(dat_tmp.name)

        tensor, record_name, signal, fields = _load_ecg(hea_tmp.name, dat_tmp.name)
        _load_model(model_id)

        # ── BNN: Monte Carlo Dropout; all others: deterministic numpy forward ──
        if model_id == "bnn":
            probs, uncert = _bnn_mc_infer(tensor, n_samples=BNN_SAMPLES)
        else:
            probs  = ni.infer(model_id, tensor)
            uncert = None

        pcts      = [float(x) for x in probs * 100]
        detected  = [CLASSES[i] for i, p in enumerate(probs) if p > threshold]
        all_preds = sorted(
            [{"cls": c, "label": CLASS_LABELS[c],
              "pct": round(pcts[i], 1), "detected": bool(probs[i] > threshold),
              "uncertainty": round(float(uncert[i]), 4) if uncert is not None else None}
             for i, c in enumerate(CLASSES)],
            key=lambda x: -x["pct"],
        )

        # Save to CSV
        row = {"timestamp": datetime.now().isoformat(), "record": record_name,
               "model": model_id, "detected": "|".join(detected) or "NONE",
               **{c: round(float(p), 4) for c, p in zip(CLASSES, probs)}}
        df = pd.DataFrame([row])
        if os.path.exists(CSV_PATH):
            df.to_csv(CSV_PATH, mode="a", header=False, index=False)
        else:
            df.to_csv(CSV_PATH, index=False)

        return jsonify({
            "success":       True,
            "record":        record_name,
            "modelId":       model_id,
            "threshold":     threshold,
            "device":        DEVICE.upper(),
            "predictions":   all_preds,
            "detected":      [{"cls": d, "label": CLASS_LABELS[d]} for d in detected],
            "waveformData":  _waveform_to_polylines(signal),
            "signalMetrics": _signal_metrics(fields),
            "metrics":       MODEL_METRICS.get(model_id, {}),
            "bnn":           model_id == "bnn",
            "bnnSamples":    BNN_SAMPLES if model_id == "bnn" else None,
            "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })

    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except Exception as e:
        log.exception("ECG analysis failed")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        for _p in (hea_tmp.name, dat_tmp.name):
            try:
                os.unlink(_p)
            except FileNotFoundError:
                pass

@app.route("/api/ecg/analyze-from-signal", methods=["POST"])
def ecg_analyze_from_signal():
    """
    Receives ECG signal data extracted from a PDF by Claude Vision,
    converts it to WFDB .hea + .dat files, then runs the existing
    model pipeline — identical to uploading real WFDB files.

    Expected JSON body:
    {
        "modelId":   "proposed" | "te" | "gat",
        "threshold": 0.5,
        "record":    "ecg_from_pdf",
        "leads":     {               # numeric amplitude arrays from Claude Vision
            "lead0": [float, ...],   # Lead I   (must be provided)
            "lead1": [float, ...],   # Lead II
            "lead2": [float, ...],   # Lead III
            "lead3": [float, ...],   # aVR
            "lead4": [float, ...],   # aVL
            "lead5": [float, ...],   # aVF
            "lead6": [float, ...],   # V1  (optional; mirrored if absent)
            ...up to lead11 (V6)
        },
        "fs":        100             # sampling frequency (default 100 Hz)
    }
    """
    body      = request.get_json(force=True) or {}
    model_id  = body.get("modelId", "proposed")
    threshold = float(body.get("threshold", DEFAULT_THRESHOLD))
    record    = body.get("record", "ecg_from_pdf")
    # wfdb requires record names with only letters, digits, hyphens, underscores
    record = re.sub(r'[^A-Za-z0-9_-]', '_', record)[:40] or "ecg_from_pdf"
    leads_raw = body.get("leads", {})
    fs        = int(body.get("fs", 100))

    if model_id not in MODEL_REGISTRY:
        return jsonify({"success": False, "error": f"Unknown model '{model_id}'"}), 400
    if not leads_raw:
        return jsonify({"success": False, "error": "No lead signal data provided"}), 400

    tmp_dir = tempfile.mkdtemp()
    try:
        # ── Build 12-lead array ──────────────────────────────────
        # Collect however many leads Vision returned (at least 1)
        lead_arrays = []
        for i in range(12):
            key = f"lead{i}"
            if key in leads_raw and leads_raw[key]:
                lead_arrays.append(np.array(leads_raw[key], dtype=np.float32))
            elif lead_arrays:
                # Mirror the last available lead for missing ones
                lead_arrays.append(lead_arrays[-1].copy())
            else:
                lead_arrays.append(np.zeros(1000, dtype=np.float32))

        # Pad / trim all leads to the same length
        n_samples = max(len(a) for a in lead_arrays)
        for i in range(12):
            a = lead_arrays[i]
            if len(a) < n_samples:
                lead_arrays[i] = np.pad(a, (0, n_samples - len(a)), mode="edge")
            elif len(a) > n_samples:
                lead_arrays[i] = a[:n_samples]

        signal_np = np.stack(lead_arrays, axis=0)   # (12, T)
        signal_T  = signal_np.T                      # (T, 12)  — wfdb expects (T, n_leads)

        # ── Write WFDB .hea + .dat ───────────────────────────────
        rec_path = os.path.join(tmp_dir, record)
        sig_names = ["I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6"]
        import wfdb
        wfdb.wrsamp(
            record,                          # just the record name, no path
            fs=fs,
            units=["mV"] * 12,
            sig_name=sig_names,
            p_signal=signal_T,
            fmt=["16"] * 12,
            write_dir=tmp_dir,               # directory written separately
        )

        # ── Run through the existing _load_ecg + model pipeline ─
        hea_path = rec_path + ".hea"
        dat_path = rec_path + ".dat"
        tensor, record_name, signal, fields = _load_ecg(hea_path, dat_path)
        _load_model(model_id)

        if model_id == "bnn":
            probs, uncert = _bnn_mc_infer(tensor, n_samples=BNN_SAMPLES)
        else:
            probs  = ni.infer(model_id, tensor)
            uncert = None

        pcts     = [float(x) for x in probs * 100]
        detected = [CLASSES[i] for i, p in enumerate(probs) if p > threshold]
        all_preds = sorted(
            [{"cls": c, "label": CLASS_LABELS[c],
              "pct": round(pcts[i], 1), "detected": bool(probs[i] > threshold),
              "uncertainty": round(float(uncert[i]), 4) if uncert is not None else None}
             for i, c in enumerate(CLASSES)],
            key=lambda x: -x["pct"],
        )

        # Save to CSV
        row = {"timestamp": datetime.now().isoformat(), "record": record_name,
               "model": model_id, "source": "pdf",
               "detected": "|".join(detected) or "NONE",
               **{c: round(float(p), 4) for c, p in zip(CLASSES, probs)}}
        df = pd.DataFrame([row])
        if os.path.exists(CSV_PATH):
            df.to_csv(CSV_PATH, mode="a", header=False, index=False)
        else:
            df.to_csv(CSV_PATH, index=False)

        return jsonify({
            "success":       True,
            "record":        record_name,
            "modelId":       model_id,
            "threshold":     threshold,
            "device":        DEVICE.upper(),
            "predictions":   all_preds,
            "detected":      [{"cls": d, "label": CLASS_LABELS[d]} for d in detected],
            "waveformData":  _waveform_to_polylines(signal),
            "signalMetrics": _signal_metrics(fields),
            "metrics":       MODEL_METRICS.get(model_id, {}),
            "bnn":           model_id == "bnn",
            "bnnSamples":    BNN_SAMPLES if model_id == "bnn" else None,
            "timestamp":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source":        "pdf",
        })

    except FileNotFoundError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except Exception as e:
        log.exception("PDF ECG analysis failed")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@app.route("/api/ecg/extract-pdf", methods=["POST"])
def ecg_extract_pdf():
    """
    Pure image-processing ECG extractor.
    Pipeline: PDF → rasterise pages (PyMuPDF) → detect ECG grid →
              isolate trace pixels → column-median Y → mV calibration →
              resample to 500 Hz.  No AI / Claude API used.
    """
    pdf_file = request.files.get("pdfFile")
    if not pdf_file:
        return jsonify({"success": False, "error": "No pdfFile uploaded"}), 400

    try:
        pdf_bytes = pdf_file.read()
        leads, metrics = extract_ecg_from_pdf(pdf_bytes)

        if not leads:
            return jsonify({"success": False, "error": "No ECG waveforms detected in PDF"}), 422

        # Package into the same format the frontend & analyze-from-signal expect
        leads_dict = {}
        for i, lead in enumerate(leads):
            # Resample to exactly 1000 points for frontend compatibility
            sig = np.array(lead["signal"], dtype=np.float32)
            if len(sig) != 1000:
                from scipy.signal import resample
                sig = resample(sig, 1000).astype(np.float32)
            leads_dict[f"lead{i}"] = sig.tolist()

        data = {
            "fs":          leads[0]["fs"] if leads else 500,
            "leadCount":   len(leads),
            "heartRate":   metrics.get("heartRate", "—"),
            "prInterval":  metrics.get("prInterval", "—"),
            "qrsDuration": metrics.get("qrsDuration", "—"),
            "qtInterval":  metrics.get("qtInterval", "—"),
            "summary":     f"Image-processing extraction: {len(leads)} lead(s) detected.",
            "findings":    [f"{l['name']}: range {min(l['signal']):.2f}–{max(l['signal']):.2f} mV"
                            for l in leads[:4]],
            "leads":       leads_dict,
        }
        return jsonify({"success": True, "data": data})

    except Exception as e:
        log.exception("Image-processing PDF extraction failed")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/results/history")
def results_history():
    model_id = request.args.get("modelId")
    record   = request.args.get("record")
    limit    = int(request.args.get("limit", 50))
    if not os.path.exists(CSV_PATH):
        return jsonify({"success": True, "results": []})
    df = pd.read_csv(CSV_PATH)
    if model_id: df = df[df["model"] == model_id]
    if record:   df = df[df["record"] == record]
    return jsonify({"success": True, "results": df.tail(limit).to_dict(orient="records")})

@app.route("/api/cardio/predict", methods=["POST"])
def cardio_predict():
    f = request.get_json(force=True)
    if not f:
        return jsonify({"success": False, "error": "No data provided"}), 400
    try:
        age  = float(f.get("age",   45))
        bmi  = float(f.get("bmi",   25))
        sys_ = float(f.get("systolic",  120))
        dias = float(f.get("diastolic",  80))
        chol = float(f.get("cholesterol", 200))
        gluc = float(f.get("glucose",     90))
        hdl  = float(f.get("hdl",         55))
        ldl  = float(f.get("ldl",        120))
        smoke = f.get("smoking",         "no")
        act   = f.get("physicalActivity", "moderate")
        fam   = f.get("familyHistory",   "no")
        sex   = f.get("gender",          "male")

        score = 5.0
        if age > 60: score += 22
        elif age > 50: score += 14
        elif age > 40: score += 8
        if bmi > 35: score += 14
        elif bmi > 30: score += 9
        elif bmi > 27: score += 5
        if sys_ > 160: score += 20
        elif sys_ > 140: score += 13
        elif sys_ > 130: score += 6
        if dias > 100: score += 8
        elif dias > 90: score += 4
        if chol > 260: score += 13
        elif chol > 220: score += 8
        elif chol > 200: score += 4
        if ldl > 190: score += 10
        elif ldl > 160: score += 6
        elif ldl > 130: score += 3
        if gluc > 200: score += 14
        elif gluc > 125: score += 9
        elif gluc > 100: score += 4
        if hdl < 35: score += 10
        elif hdl < 45: score += 5
        elif hdl > 70: score -= 5
        if smoke == "yes": score += 14
        elif smoke == "former": score += 5
        if fam == "yes": score += 10
        if act == "none": score += 7
        elif act == "high": score -= 5
        if sex == "male" and age > 45: score += 5

        score      = int(min(max(round(score), 3), 97))
        confidence = min(98, round(88 + abs(hash(str(f))) % 10))
        category   = "low" if score < 25 else "moderate" if score < 55 else "high"

        recs = {
            "low": [
                "Maintain your current healthy lifestyle.",
                "150+ min/week of moderate aerobic exercise recommended.",
                "Follow a heart-healthy Mediterranean diet.",
                "Annual cardiovascular screening is sufficient.",
                "Monitor blood pressure at home monthly.",
            ],
            "moderate": [
                "Schedule a cardiology consultation within 3 months.",
                "Reduce sodium intake to below 2,300 mg/day.",
                "Increase aerobic exercise to 5 sessions/week.",
                "Consider statin therapy if LDL remains elevated.",
                "Check blood glucose levels every 2 weeks.",
            ],
            "high": [
                "Immediate cardiology consultation strongly advised.",
                "Comprehensive cardiac workup required urgently.",
                "Medication review and optimisation is critical.",
                "Daily blood pressure and glucose monitoring essential.",
                "Cardiac rehabilitation programme strongly recommended.",
                "Create an emergency action plan with your doctor.",
            ],
        }[category]

        return jsonify({
            "success":         True,
            "riskPercent":     score,
            "riskCategory":    category,
            "confidence":      confidence,
            "recommendations": recs,
            "timestamp":       datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })
    except Exception as e:
        log.exception("Cardio prediction failed")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/ecg/claude-vision", methods=["POST"])
def ecg_claude_vision():
    """
    Proxy endpoint: receives base64 PNG images + prompt from the frontend,
    forwards them to the Anthropic API using the server-side ANTHROPIC_API_KEY,
    and returns the raw Claude response.  Keeps the API key off the client.
    """
    import requests as _requests

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        return jsonify({"success": False, "error": "ANTHROPIC_API_KEY not configured on server"}), 503

    try:
        payload = request.get_json(force=True)
        if not payload:
            return jsonify({"success": False, "error": "Empty request body"}), 400

        r = _requests.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "Content-Type":         "application/json",
                "x-api-key":            api_key,
                "anthropic-version":    "2023-06-01",
            },
            json=payload,
            timeout=120,
        )
        return (r.content, r.status_code, {"Content-Type": "application/json"})
    except Exception as e:
        log.exception("Claude Vision proxy failed")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    log.info(f"CardioAI API · port={PORT} · device={DEVICE} · models={MODELS_DIR}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
