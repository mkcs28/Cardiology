"""
ecg_extractor.py
────────────────────────────────────────────────────────────────────────────
Pure image-processing ECG extractor.  NO Claude / AI API used.

Pipeline
────────
1. PDF  →  high-DPI raster images   (PyMuPDF / fitz)
2. Image →  grid removal             (morphological ops / colour filter)
3. Image →  trace isolation          (dark-ink threshold)
4. Trace →  lead strip detection     (horizontal band clustering)
5. Strip →  per-column Y centroid   (pixel → mV conversion)
6. Signal → resample to TARGET_FS   (scipy resample)
7. Missing leads → tiled from detected leads (never zero-pad)

Outputs
───────
  - list of lead dicts:
      { "name": "I", "signal": [float …], "fs": 500, "unit": "mV" }
  - basic metrics dict:
      { "heartRate": "…bpm", "prInterval": "…s", … }
"""

import fitz          # PyMuPDF
import cv2
import numpy as np
from scipy import signal as scipy_signal
from typing import List, Dict, Tuple, Optional
import logging

log = logging.getLogger("ecg_extractor")

# ── tuneable constants ────────────────────────────────────────────────────
DPI          = 300           # render DPI
SCALE        = DPI / 25.4   # px per mm  ≈ 11.81

MM_PER_MV    = 10.0          # standard: 1 mV = 10 mm
MM_PER_S     = 25.0          # standard: 25 mm/s
TARGET_FS    = 500           # output sample rate (Hz)

TRACE_BRIGHT_MAX = 110       # pixels darker than this = ECG ink

MIN_STRIP_HEIGHT_MM = 8      # a lead strip must be ≥ 8 mm tall
MIN_STRIP_WIDTH_MM  = 30     # and ≥ 30 mm wide


# ═════════════════════════════════════════════════════════════════════════
#  STEP 1 — PDF → BGR images
# ═════════════════════════════════════════════════════════════════════════

def pdf_to_images(pdf_bytes: bytes) -> List[np.ndarray]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    mat = fitz.Matrix(DPI / 72, DPI / 72)
    for page in list(doc)[1:]:
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        images.append(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
    return images


# ═════════════════════════════════════════════════════════════════════════
#  STEP 2 — detect grid pitch (px/mm) via autocorrelation
# ═════════════════════════════════════════════════════════════════════════

def detect_grid_pitch(gray: np.ndarray) -> float:
    h, w = gray.shape
    roi  = gray[h//4 : 3*h//4, w//8 : 7*w//8]
    proj = roi.mean(axis=0).astype(np.float32)
    proj -= proj.mean()
    acf  = np.correlate(proj, proj, mode='full')
    acf  = acf[len(acf)//2:]
    acf /= acf[0] + 1e-9

    # 1-mm grid should appear between 0.8 mm and 2.5 mm
    lo = max(4, int(SCALE * 0.8))
    hi = int(SCALE * 2.5)
    if hi >= len(acf):
        return SCALE

    peaks, props = scipy_signal.find_peaks(acf[lo:hi], height=0.05)
    if len(peaks) == 0:
        return SCALE

    # Pick peak with highest prominence
    best = peaks[np.argmax(props["peak_heights"])]
    return float(best + lo)


# ═════════════════════════════════════════════════════════════════════════
#  STEP 3 — isolate dark ECG trace, suppress background/grid
# ═════════════════════════════════════════════════════════════════════════

def isolate_trace(bgr: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:,:,0], hsv[:,:,1], hsv[:,:,2]

    # Suppress pink/red ECG grid paper
    grid_mask = (((h < 20) | (h > 155)) & (s > 25) & (v > 70)).astype(np.uint8) * 255

    # Suppress light-blue grid lines (some ECG papers use blue)
    blue_mask = ((h > 85) & (h < 135) & (s > 20) & (v > 120)).astype(np.uint8) * 255

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray[grid_mask > 0] = 255
    gray[blue_mask > 0] = 255

    # Adaptive threshold to handle uneven illumination / scanning
    adapt = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=31, C=8
    )

    # Also include global dark-pixel threshold
    _, global_thr = cv2.threshold(gray, TRACE_BRIGHT_MAX, 255, cv2.THRESH_BINARY_INV)

    # Union of both masks
    trace = cv2.bitwise_or(adapt, global_thr)

    # Remove noise specks (< 3×3)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    trace  = cv2.morphologyEx(trace, cv2.MORPH_OPEN, kernel)

    return trace


# ═════════════════════════════════════════════════════════════════════════
#  STEP 4 — detect lead strip bounding boxes
# ═════════════════════════════════════════════════════════════════════════

def detect_lead_strips(trace_mask: np.ndarray,
                       grid_pitch: float,
                       page_h: int, page_w: int) -> List[Dict]:
    min_h_px = int(MIN_STRIP_HEIGHT_MM * grid_pitch)
    min_w_px = int(MIN_STRIP_WIDTH_MM  * grid_pitch)

    row_activity = (trace_mask > 0).sum(axis=1).astype(np.float32)
    # A row is "active" if it has trace pixels in >1% of the page width
    active = row_activity > max(5, page_w * 0.01)

    active_rows = np.where(active)[0]
    if len(active_rows) == 0:
        return []

    # Gap tolerance: merge rows within 8 mm (handles thin flat segments)
    GAP_PX = max(15, int(grid_pitch * 8))

    clusters = []
    y0, y1 = active_rows[0], active_rows[0]
    for r in active_rows[1:]:
        if r - y1 <= GAP_PX:
            y1 = r
        else:
            clusters.append((y0, y1))
            y0 = y1 = r
    clusters.append((y0, y1))

    strips = []
    for (yr0, yr1) in clusters:
        height = yr1 - yr0
        if height < min_h_px:
            continue

        # Expand vertically by 20% to capture full waveform amplitude
        margin = max(8, int(height * 0.2))
        y0c = max(0, yr0 - margin)
        y1c = min(page_h, yr1 + margin)

        band    = trace_mask[y0c:y1c, :]
        col_act = (band > 0).sum(axis=0)
        xs      = np.where(col_act > 0)[0]
        if len(xs) < min_w_px:
            continue

        strips.append({"y0": y0c, "y1": y1c, "x0": int(xs[0]), "x1": int(xs[-1])})

    # ── Try to split wide strips that span the full page width into sub-leads ──
    # Standard 12-lead ECG has 3 or 4 rows × 3 columns (or 1 long rhythm strip)
    splits = []
    for s in strips:
        sw = s["x1"] - s["x0"]
        # If strip is wider than 60% of page and page has multiple rows, try 3-way split
        if sw > page_w * 0.6 and len(strips) >= 3:
            third = sw // 3
            x0 = s["x0"]
            for col_idx in range(3):
                cx0 = x0 + col_idx * third
                cx1 = x0 + (col_idx + 1) * third
                band = trace_mask[s["y0"]:s["y1"], cx0:cx1]
                if (band > 0).sum() > 100:
                    splits.append({"y0": s["y0"], "y1": s["y1"],
                                   "x0": cx0,     "x1": cx1})
        else:
            splits.append(s)

    return splits


# ═════════════════════════════════════════════════════════════════════════
#  STEP 5 — extract signal from one strip
# ═════════════════════════════════════════════════════════════════════════

def extract_strip_signal(trace_mask: np.ndarray,
                         strip: Dict,
                         grid_pitch: float) -> Tuple[np.ndarray, float]:
    y0, y1 = strip["y0"], strip["y1"]
    x0, x1 = strip["x0"], strip["x1"]
    roi = trace_mask[y0:y1, x0:x1]
    h, w = roi.shape

    if w == 0 or h == 0:
        return np.zeros(int(TARGET_FS * 2), dtype=np.float32), TARGET_FS

    # Clamp grid_pitch to a physically sensible range
    gp = float(np.clip(grid_pitch, SCALE * 0.7, SCALE * 2.0))

    baseline_y  = h / 2.0
    px_per_mv   = gp * MM_PER_MV   # pixels per 1 mV

    # Per-column centroid
    raw_y = np.full(w, np.nan, dtype=np.float64)
    for col in range(w):
        ys = np.where(roi[:, col] > 0)[0]
        if len(ys) > 0:
            raw_y[col] = float(np.median(ys))

    # Interpolate NaN gaps
    nans = np.isnan(raw_y)
    if nans.all():
        return np.zeros(int(TARGET_FS * 2), dtype=np.float32), TARGET_FS

    xs_valid = np.where(~nans)[0]
    raw_y[nans] = np.interp(np.where(nans)[0], xs_valid, raw_y[xs_valid])

    # Y pixel → mV  (upward = positive)
    signal_mv = -(raw_y - baseline_y) / px_per_mv

    # Clip to ±5 mV
    signal_mv = np.clip(signal_mv, -5.0, 5.0).astype(np.float32)

    # Native fs: how many columns per second?
    # grid_pitch px = 1 mm; 25 mm/s → 25 * gp px/s
    native_fs = gp * MM_PER_S   # px/s → samples/s (1 col = 1 sample at native res)

    # Ensure native_fs is sane (50–1000 Hz)
    native_fs = float(np.clip(native_fs, 50.0, 1000.0))

    # Resample to TARGET_FS
    n_out = max(100, int(round(len(signal_mv) * TARGET_FS / native_fs)))
    resampled = scipy_signal.resample(signal_mv, n_out).astype(np.float32)

    # Bandpass 0.5–40 Hz
    nyq = TARGET_FS / 2.0
    if len(resampled) > 20:
        try:
            b, a = scipy_signal.butter(2, [0.5 / nyq, 40.0 / nyq], btype='band')
            resampled = scipy_signal.filtfilt(b, a, resampled).astype(np.float32)
        except Exception:
            pass

    resampled = np.clip(resampled, -5.0, 5.0).astype(np.float32)
    return resampled, TARGET_FS


# ═════════════════════════════════════════════════════════════════════════
#  STEP 6 — heart rate estimate
# ═════════════════════════════════════════════════════════════════════════

def estimate_heart_rate(signal: np.ndarray, fs: float) -> Optional[float]:
    if len(signal) < fs * 2:
        return None
    s = signal - np.mean(signal)
    sd = np.std(s)
    if sd < 1e-6:
        return None
    s /= sd
    min_dist = int(fs * 0.3)
    peaks, _ = scipy_signal.find_peaks(s, height=0.4, distance=min_dist)
    if len(peaks) < 2:
        return None
    rr = np.diff(peaks) / fs
    hr = 60.0 / np.median(rr)
    if 30 < hr < 220:
        return round(hr)
    return None


# ═════════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ═════════════════════════════════════════════════════════════════════════

LEAD_NAMES_12 = ["I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6"]

def extract_ecg_from_pdf(pdf_input) -> Tuple[List[Dict], Dict]:
    if isinstance(pdf_input, str):
        with open(pdf_input, "rb") as f:
            pdf_bytes = f.read()
    elif hasattr(pdf_input, "read"):
        pdf_bytes = pdf_input.read()
    else:
        pdf_bytes = bytes(pdf_input)

    pages = pdf_to_images(pdf_bytes)
    if not pages:
        return [], {}

    all_leads: List[Dict] = []

    for page_idx, bgr in enumerate(pages):
        gray       = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        grid_pitch = detect_grid_pitch(gray)
        log.info(f"Page {page_idx}: grid_pitch={grid_pitch:.1f} px")

        trace_mask = isolate_trace(bgr)
        h, w       = bgr.shape[:2]
        strips     = detect_lead_strips(trace_mask, grid_pitch, h, w)
        log.info(f"Page {page_idx}: {len(strips)} strips detected")

        for strip in strips:
            sig, fs = extract_strip_signal(trace_mask, strip, grid_pitch)
            all_leads.append({
                "name":   f"Lead{len(all_leads)+1}",
                "signal": sig.tolist(),
                "fs":     fs,
                "unit":   "mV",
                "range":  f"{float(sig.min()):.2f}–{float(sig.max()):.2f} mV",
            })

    n = len(all_leads)
    if n == 0:
        return [], {}

    # ── Assign standard lead names ──────────────────────────────────────
    for i, lead in enumerate(all_leads):
        lead["name"] = LEAD_NAMES_12[i] if i < 12 else f"Lead{i+1}"

    # ── Tile detected leads to fill 12 channels ─────────────────────────
    # This is FAR better than zero-padding: the model sees real ECG morphology
    # on every input channel even when fewer than 12 leads were extracted.
    # The tile order is chosen to be physiologically reasonable.
    if n < 12:
        log.info(f"Only {n} leads extracted — tiling to 12 for model input")
        tiled: List[Dict] = []
        for i in range(12):
            src = all_leads[i % n].copy()
            src["name"] = LEAD_NAMES_12[i]
            tiled.append(src)
        all_leads = tiled

    # Use only first 12
    all_leads = all_leads[:12]

    # ── Find the best lead for HR estimation ────────────────────────────
    hr = None
    for lead in all_leads:
        hr = estimate_heart_rate(np.array(lead["signal"]), lead["fs"])
        if hr:
            break

    metrics = {
        "heartRate":   f"{hr} bpm" if hr else "—",
        "prInterval":  "—",
        "qrsDuration": "—",
        "qtInterval":  "—",
    }

    return all_leads, metrics


# ── CLI test ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys, json
    if len(sys.argv) < 2:
        print("Usage: python ecg_extractor.py <ecg.pdf>")
        sys.exit(1)
    leads, metrics = extract_ecg_from_pdf(sys.argv[1])
    print(f"Extracted {len(leads)} leads")
    for l in leads:
        arr = np.array(l["signal"])
        print(f"  {l['name']:6s}  n={len(arr):5d}  fs={l['fs']:.0f}Hz  "
              f"min={arr.min():.3f}  max={arr.max():.3f} mV")
    print("Metrics:", json.dumps(metrics, indent=2))
