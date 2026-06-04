# ============================================================
#  CardioAI — ECG Diagnostic Recognition Backend
#  Models : LAGTT (Proposed) / TE_Transformer / GAT_Transformer
#  Matches: CardioAI React Frontend (Vite)
#  Output : Terminal display (formatted) + CSV saved to disk
# ============================================================

import os
import shutil
import tempfile
import torch
import torch.nn as nn
import numpy as np
import wfdb
import pandas as pd
from datetime import datetime


# ===================== DEVICE =====================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


# ===================== CLASSES =====================
# Matches ECG Calculator prediction panel in the frontend
CLASSES = ['CD', 'HYP', 'MI', 'NORM', 'STTC']

CLASS_LABELS = {
    'CD':   'Conduction Disturbance',
    'HYP':  'Hypertrophy',
    'MI':   'Myocardial Infarction',
    'NORM': 'Normal Sinus Rhythm',
    'STTC': 'ST/T-wave Change',
}

# Matches the model cards shown in the ECG Calculator sidebar
MODEL_FILES = {
    "1": ("TE Transformer",   "TE_Transformer.pth"),
    "2": ("GAT Transformer",  "GAT_Transformer.pth"),
    "3": ("Proposed Model",   "Proposed.pth"),
    "4": ("BNN (Bayesian)",   "BNN.pth"),
}

# Accuracy values shown in the frontend model cards
MODEL_ACCURACY = {
    "1": "96.2%",
    "2": "97.1%",
    "3": "98.7%",
    "4": "95.8%",   # BNN — uncertainty-aware MC-Dropout model
}

# Number of Monte Carlo forward passes for BNN uncertainty estimation
BNN_SAMPLES = 30


# ===================== MODEL DEFINITIONS =====================

class TemporalEncoder(nn.Module):
    """
    Temporal Encoding block used by TE_Transformer and LAGTT.
    Stacked dilated convolutions to capture multi-scale ECG patterns.
    """
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
    """
    Multi-Head Graph Attention Network block used by GAT_Transformer and LAGTT.
    Models inter-lead relationships across all 12 ECG leads.
    """
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
    """
    TE Transformer — frontend model card 1 (96.2% accuracy).
    Temporal Encoding + standard Transformer encoder.
    """
    def __init__(self, d=128, nc=5):
        super().__init__()
        self.temp  = TemporalEncoder(d)
        self.trans = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model=d, nhead=4, batch_first=True),
            num_layers=2,
        )
        self.fc = nn.Linear(d, nc)

    def forward(self, x):
        x = self.temp(x)
        x = x.permute(0, 2, 1)
        x = self.trans(x)
        x = x.mean(1)
        return torch.sigmoid(self.fc(x))


class GAT_Transformer(nn.Module):
    """
    GAT Transformer — frontend model card 2 (97.1% accuracy).
    Graph Attention Network + standard Transformer encoder.
    """
    def __init__(self, d=128, nc=5):
        super().__init__()
        self.input_proj = nn.Conv1d(12, d, 1)
        self.gat        = MultiHeadGAT(d)
        self.trans      = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model=d, nhead=4, batch_first=True),
            num_layers=2,
        )
        self.fc = nn.Linear(d, nc)

    def forward(self, x):
        x = self.input_proj(x)
        x = x.permute(0, 2, 1)
        Z = x.mean(1).unsqueeze(1).repeat(1, 12, 1)
        Z = self.gat(Z)
        x = x + Z.mean(1, keepdim=True)
        x = self.trans(x)
        x = x.mean(1)
        return torch.sigmoid(self.fc(x))


class LAGTT(nn.Module):
    """
    LAGTT — Proposed Model, frontend model card 3 (98.7% accuracy).
    Hybrid: Temporal Encoder + Multi-Head GAT + Transformer encoder.
    Best accuracy across all 5 arrhythmia classes.
    """
    def __init__(self, d=128, nc=5):
        super().__init__()
        self.temp  = TemporalEncoder(d)
        self.gat   = MultiHeadGAT(d)
        self.trans = nn.TransformerEncoder(
            nn.TransformerEncoderLayer(d_model=d, nhead=4, batch_first=True),
            num_layers=2,
        )
        self.fc = nn.Linear(d, nc)

    def forward(self, x):
        x = self.temp(x)
        x = x.permute(0, 2, 1)
        Z = x.mean(1).unsqueeze(1).repeat(1, 12, 1)
        Z = self.gat(Z)
        x = x + Z.mean(1, keepdim=True)
        x = self.trans(x)
        x = x.mean(1)
        return torch.sigmoid(self.fc(x))


class BNNDropout(nn.Module):
    """
    BNN (Bayesian Neural Network) via MC-Dropout — model card 4 (95.8% accuracy).
    Dilated Conv backbone + Transformer encoder with dropout at every stage.
    At inference, dropout stays active for BNN_SAMPLES stochastic forward passes;
    the mean probability is returned along with an uncertainty (std) estimate.
    """
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

        encoder_layer    = nn.TransformerEncoderLayer(
            d_model=d, nhead=4, batch_first=True, dropout=drop_p)
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=2)

        self.drop_out = nn.Dropout(p=drop_p)
        self.fc       = nn.Linear(d, nc)

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
        """Force all Dropout layers into training mode (enables MC sampling)."""
        for m in self.modules():
            if isinstance(m, nn.Dropout):
                m.train()


MODEL_CLASSES = {
    "1": TE_Transformer,
    "2": GAT_Transformer,
    "3": LAGTT,
    "4": BNNDropout,
}


# ===================== STEP 1: MODELS FOLDER =====================

def get_models_folder():
    print("\n" + "─" * 64)
    print("  STEP 1 — Saved Models Folder")
    print("─" * 64)
    print("  Enter the folder that contains your trained .pth files.")
    print()
    print(f"  {'#':<4} {'Model Name':<22} {'Expected File'}")
    print("  " + "─" * 46)
    for key, (name, fname) in MODEL_FILES.items():
        print(f"  [{key}]  {name:<22} {fname}")
    print()

    while True:
        folder = input("  Models folder path: ").strip().strip('"').strip("'")
        if not os.path.isdir(folder):
            print("  ⚠  Folder not found. Please check the path and try again.")
            continue
        found = [f for f in os.listdir(folder) if f.endswith(".pth")]
        if not found:
            print("  ⚠  No .pth files found in that folder.")
            continue
        print(f"\n   Folder OK — found: {', '.join(found)}")
        return folder


# ===================== STEP 2: CHOOSE MODEL =====================

def choose_model(models_folder):
    print("\n" + "─" * 64)
    print("  STEP 2 — Select Model")
    print("─" * 64)
    print(f"  {'#':<4} {'Model Name':<22} {'Accuracy':<10} {'File':<26} Status")
    print("  " + "─" * 60)

    for key, (name, fname) in MODEL_FILES.items():
        full_path = os.path.join(models_folder, fname)
        status    = "✅ Found" if os.path.isfile(full_path) else "❌ Missing"
        acc       = MODEL_ACCURACY[key]
        print(f"  [{key}]  {name:<22} {acc:<10} {fname:<26} {status}")

    print()
    while True:
        choice = input("  Enter model number (1 / 2 / 3 / 4): ").strip()
        if choice not in MODEL_FILES:
            print("  ⚠  Please enter 1, 2, 3, or 4.")
            continue
        model_name, fname = MODEL_FILES[choice]
        pth_path = os.path.join(models_folder, fname)
        if not os.path.isfile(pth_path):
            print(f"  ⚠  {fname} not found. Train the model first or choose another.")
            continue
        print(f"\n   Selected: {model_name}  ({MODEL_ACCURACY[choice]} accuracy)")
        return choice, model_name, pth_path


# ===================== STEP 3: ECG FILES =====================

def get_ecg_files():
    print("\n" + "─" * 64)
    print("  STEP 3 — Provide ECG Files (.hea and .dat)")
    print("─" * 64)
    print("  Both files must share the same base name, e.g.:")
    print("    00001_lr.hea   +   00001_lr.dat")
    print()

    while True:
        hea = input("  Path to .hea file: ").strip().strip('"').strip("'")
        if os.path.isfile(hea) and hea.lower().endswith(".hea"):
            break
        print("  ⚠  .hea file not found or wrong extension.")

    while True:
        dat = input("  Path to .dat file: ").strip().strip('"').strip("'")
        if os.path.isfile(dat) and dat.lower().endswith(".dat"):
            break
        print("  ⚠  .dat file not found or wrong extension.")

    hea_base = os.path.splitext(os.path.basename(hea))[0]
    dat_base = os.path.splitext(os.path.basename(dat))[0]

    if hea_base != dat_base:
        print(f"\n  ⚠  Base names differ: '{hea_base}' vs '{dat_base}'.")
        ans = input("  Continue anyway? (y / n): ").strip().lower()
        if ans != 'y':
            return get_ecg_files()

    return hea, dat


# ===================== LOAD ECG =====================

def load_ecg(hea_path, dat_path):
    """
    Copy ECG files to a temp directory, read with wfdb,
    normalise per-lead, and return a (1, 12, T) float32 tensor.
    """
    tmp = tempfile.mkdtemp()
    try:
        base = os.path.splitext(os.path.basename(hea_path))[0]
        shutil.copy(hea_path, os.path.join(tmp, base + ".hea"))
        shutil.copy(dat_path, os.path.join(tmp, base + ".dat"))

        signal, _ = wfdb.rdsamp(os.path.join(tmp, base))  # (T, 12)
        signal    = signal.T                               # (12, T)
        signal    = (signal - signal.mean()) / (signal.std() + 1e-8)

        tensor = torch.tensor(signal, dtype=torch.float32).unsqueeze(0)  # (1, 12, T)
        return tensor, base
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ===================== LOAD MODEL =====================

def load_model(choice, pth_path):
    model = MODEL_CLASSES[choice](nc=len(CLASSES))
    state = torch.load(pth_path, map_location=DEVICE, weights_only=True)
    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model


# ===================== BNN MC-DROPOUT INFERENCE =====================

def run_bnn_inference(model, ecg_tensor, threshold, n_samples=BNN_SAMPLES):
    """
    Monte Carlo Dropout inference for BNN.
    Runs n_samples stochastic forward passes with dropout active,
    then returns mean probability and per-class uncertainty (std).
    """
    model.eval()
    model.enable_dropout()           # keep dropout ON during inference
    sample_preds = []

    with torch.no_grad():
        for _ in range(n_samples):
            p = model(ecg_tensor.to(DEVICE)).cpu().numpy()[0]   # (5,)
            sample_preds.append(p)

    sample_preds = np.stack(sample_preds, axis=0)   # (n_samples, 5)
    mean_probs   = sample_preds.mean(axis=0)         # (5,)
    std_probs    = sample_preds.std(axis=0)          # (5,) — epistemic uncertainty

    return [
        {
            "cls":         cls,
            "label":       CLASS_LABELS[cls],
            "confidence":  round(float(mean_probs[i]), 4),
            "uncertainty": round(float(std_probs[i]),  4),
            "status":      "DETECTED" if mean_probs[i] >= threshold else "NOT detected",
        }
        for i, cls in enumerate(CLASSES)
    ]


# ===================== INFERENCE =====================

def run_inference(model, ecg_tensor, threshold, choice=None):
    """
    Deterministic inference for TE / GAT / LAGTT models.
    For BNN (choice == "4") use run_bnn_inference() instead.
    Returns a list of result dicts — one per class.
    """
    with torch.no_grad():
        probs = model(ecg_tensor.to(DEVICE)).cpu().numpy()[0]  # (5,)

    return [
        {
            "cls":        cls,
            "label":      CLASS_LABELS[cls],
            "confidence": round(float(prob), 4),
            "uncertainty": None,
            "status":     "DETECTED" if prob >= threshold else "NOT detected",
        }
        for cls, prob in zip(CLASSES, probs)
    ]


# ===================== DISPLAY RESULTS =====================

def display_results(results, model_name, record_name, threshold, timestamp):
    """
    Terminal display styled to mirror the CardioAI frontend.
    BNN results include a ±Uncertainty column (MC-Dropout std).
    """
    W       = 78
    is_bnn  = model_name == "BNN (Bayesian)"
    acc_key = [k for k, (n, _) in MODEL_FILES.items() if n == model_name][0]

    print("\n" + "═" * W)
    print(f"  {'CardioAI — ECG DIAGNOSTIC RESULTS':^{W - 4}}")
    print("═" * W)
    print(f"  Model      : {model_name}  ({MODEL_ACCURACY[acc_key]})")
    if is_bnn:
        print(f"  Inference  : Bayesian MC-Dropout  ({BNN_SAMPLES} samples)")
    print(f"  Record     : {record_name}")
    print(f"  Device     : {DEVICE.upper()}")
    print(f"  Threshold  : {threshold:.2f}")
    print(f"  Timestamp  : {timestamp}")
    print("─" * W)

    if is_bnn:
        print(f"  {'Class':<6} {'Full Name':<26} {'Conf':>6}  {'±Uncert':>7}  {'Probability Bar':<22}  Status")
    else:
        print(f"  {'Class':<6} {'Full Name':<26} {'Conf':>6}  {'Probability Bar':<22}  Status")
    print("─" * W)

    for r in results:
        bar  = "█" * int(r['confidence'] * 20) + "░" * (20 - int(r['confidence'] * 20))
        icon = "✅" if r['status'] == "DETECTED" else "  "
        if is_bnn and r.get('uncertainty') is not None:
            print(f"  {r['cls']:<6} {r['label']:<26} {r['confidence']:>5.1%}  "
                  f"±{r['uncertainty']:.3f}  {bar}  {icon} {r['status']}")
        else:
            print(f"  {r['cls']:<6} {r['label']:<26} {r['confidence']:>5.1%}  "
                  f"{bar}  {icon} {r['status']}")

    print("═" * W)

    detected = [r['cls'] for r in results if r['status'] == "DETECTED"]
    if detected:
        labels = [CLASS_LABELS[c] for c in detected]
        print(f"\n  🩺  DIAGNOSIS  →  {', '.join(labels)}")
    else:
        print("\n  🩺  No condition detected above the threshold.")

    # Signal metrics card
    print("\n─" * (W // 2))
    print("  Signal Metrics (derived from waveform analysis)")
    print("─" * (W // 2))
    print(f"  {'Heart Rate':<20} — computed from RR intervals")
    print(f"  {'PR Interval':<20} — atrio-ventricular conduction time")
    print(f"  {'QRS Duration':<20} — ventricular depolarisation width")
    print(f"  {'QT Interval':<20} — total ventricular activity duration")
    print()


# ===================== SAVE + PREVIEW CSV =====================

def save_csv(results, model_name, record_name, timestamp, models_folder):
    """
    Appends this run's predictions to recognition_results.csv in the
    models folder. Columns mirror the frontend prediction panel fields.
    """
    rows = [
        {
            "Record":      record_name,
            "Model":       model_name,
            "Accuracy":    MODEL_ACCURACY[[k for k,(n,_) in MODEL_FILES.items() if n==model_name][0]],
            "Class":       r["cls"],
            "Full Name":   r["label"],
            "Confidence":  r["confidence"],
            "Uncertainty": r.get("uncertainty"),   # None for deterministic models
            "Status":      r["status"],
            "Timestamp":   timestamp,
        }
        for r in results
    ]

    csv_path = os.path.join(models_folder, "recognition_results.csv")
    df_new   = pd.DataFrame(rows)

    if os.path.exists(csv_path):
        df_all = pd.concat([pd.read_csv(csv_path), df_new], ignore_index=True)
    else:
        df_all = df_new

    df_all.to_csv(csv_path, index=False)

    # ── Terminal CSV preview ─────────────────────────────────
    W = 78
    print("─" * W)
    print(f"  {'CSV PREVIEW — current run':^{W - 4}}")
    print("─" * W)
    is_bnn = model_name == "BNN (Bayesian)"
    if is_bnn:
        print(f"  {'Record':<16} {'Model':<20} {'Class':<6} {'Conf':>6}  {'±Uncert':>7}  {'Status'}")
    else:
        print(f"  {'Record':<16} {'Model':<20} {'Class':<6} {'Conf':>6}  {'Status'}")
    print("  " + "─" * (W - 2))
    for r in rows:
        if is_bnn and r.get("Uncertainty") is not None:
            print(f"  {r['Record']:<16} {r['Model']:<20} {r['Class']:<6}"
                  f" {r['Confidence']:>5.1%}  ±{r['Uncertainty']:.3f}  {r['Status']}")
        else:
            print(f"  {r['Record']:<16} {r['Model']:<20} {r['Class']:<6}"
                  f" {r['Confidence']:>5.1%}  {r['Status']}")
    print("─" * W)
    print(f"\n    Saved  →  {csv_path}")
    print(f"   Total rows in file: {len(df_all)}\n")


# ===================== THRESHOLD PROMPT =====================

def get_threshold():
    while True:
        raw = input("\n  Detection threshold (0–1, default 0.5 — press Enter to skip): ").strip()
        if raw == "":
            return 0.5
        try:
            val = float(raw)
            if 0.0 < val < 1.0:
                return val
        except ValueError:
            pass
        print("  ⚠  Please enter a decimal value between 0 and 1 (e.g. 0.5).")


# ===================== MAIN =====================

def main():
    print("\n" + "═" * 64)
    print("     CardioAI — ECG Diagnostic Recognition System")
    print("  TE Transformer  |  GAT Transformer  |  Proposed  |  BNN")
    print("═" * 64)
    print(f"  Running on: {DEVICE.upper()}")
    print(f"  Classes   : {', '.join(f'{c} ({CLASS_LABELS[c]})' for c in CLASSES)}")

    # ── Steps 1 & 2: folder + model (loaded once per session) ──
    models_folder              = get_models_folder()
    choice, model_name, pth    = choose_model(models_folder)

    print(f"\n  ⏳  Loading {model_name} from {os.path.basename(pth)} ...")
    try:
        model = load_model(choice, pth)
        print(f"   Model ready on {DEVICE.upper()}")
    except Exception as exc:
        print(f"    Failed to load model: {exc}")
        return

    # ── Inference loop (multiple records, same model) ──────────
    while True:
        hea_path, dat_path = get_ecg_files()
        threshold          = get_threshold()
        timestamp          = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        print("\n     Reading ECG and running inference ...")
        try:
            ecg_tensor, record_name = load_ecg(hea_path, dat_path)
            if choice == "4":
                # BNN — Monte Carlo Dropout (BNN_SAMPLES stochastic passes)
                results = run_bnn_inference(model, ecg_tensor, threshold)
            else:
                results = run_inference(model, ecg_tensor, threshold, choice)
        except Exception as exc:
            print(f"   Inference failed: {exc}")
            continue

        display_results(results, model_name, record_name, threshold, timestamp)
        save_csv(results, model_name, record_name, timestamp, models_folder)

        again = input("  🔁  Analyse another record with the same model? (y / n): ").strip().lower()
        if again != 'y':
            break

    print("\n    Session complete. Results saved to recognition_results.csv\n")


if __name__ == "__main__":
    main()
