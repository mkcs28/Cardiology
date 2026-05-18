"""
ecg_extractor.py
─────────────────────────────────────────────────────────────────────────────
Pure image-processing ECG extractor.  NO Claude / AI API used.

Pipeline
────────
1. PDF  →  high-DPI raster images   (PyMuPDF / fitz)
2. Image →  grid removal             (morphological ops, FFT freq filter)
3. Image →  trace isolation          (colour segmentation or intensity)
4. Trace →  per-pixel Y centroids    (column-by-column median)
7. Pixels →  mV values              (calibrate from 1 mV calibration pulse
                                      or from known grid spacing)
8. Pixels →  time axis              (standard 25 mm/s, 10 mm/small-square)

Outputs
───────
  - list of lead dicts:
      { "name": "I", "signal": [float …], "fs": 100, "unit": "mV" }
  - basic metrics dict:
      { "heartRate": "…bpm", "prInterval": "…s", … }

Usage
─────
  from ecg_extractor import extract_ecg_from_pdf

  leads, metrics = extract_ecg_from_pdf("ecg.pdf")
"""

import fitz          # PyMuPDF
import cv2
import numpy as np
from scipy import ndimage, signal as scipy_signal
from typing import List, Dict, Tuple, Optional
import io, math, logging

log = logging.getLogger("ecg_extractor")

# ── tuneable constants ─────────────────────────────────────────────────────
DPI            = 300          # render DPI (higher = more accurate trace)
SCALE          = DPI / 25.4  # px per mm

# Standard ECG paper specs
MM_PER_MV      = 10.0        # 1 mV = 10 mm amplitude
MM_PER_S       = 25.0        # 25 mm per second
TARGET_FS      = 500         # output samples / second (resampled)

# Grid colours (pink/salmon ECG paper)
GRID_HUE_LOW   = 340         # HSV hue range for pink/red grid
GRID_HUE_HIGH  = 20
GRID_SAT_MIN   = 40

# Trace colour (black ink)
TRACE_BRIGHT_MAX = 120       # pixel brightness < this → ink

# Layout detection
MIN_STRIP_HEIGHT_MM = 10     # a lead strip must be at least 10 mm tall
MIN_STRIP_WIDTH_MM  = 40     # and 40 mm wide


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 1 — PDF → PIL images
# ═══════════════════════════════════════════════════════════════════════════

def pdf_to_images(pdf_bytes: bytes) -> List[np.ndarray]:
    """Rasterize every page of the PDF at DPI, return list of BGR numpy arrays."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    mat = fitz.Matrix(DPI / 72, DPI / 72)   # 72 dpi is fitz default
    for page in doc:
        pix  = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        arr  = np.frombuffer(pix.samples, dtype=np.uint8)
        arr  = arr.reshape(pix.height, pix.width, 3)
        bgr  = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        images.append(bgr)
    return images


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 2 — detect grid pitch (px per mm) from autocorrelation
# ═══════════════════════════════════════════════════════════════════════════

def detect_grid_pitch(gray: np.ndarray) -> float:
    """
    Estimate pixel spacing of the 1-mm ECG grid squares by finding the
    dominant periodicity in a horizontal projection of the image.
    Returns pixels-per-mm (float).  Falls back to DPI/25.4 if unsure.
    """
    # Use the middle third of the image (avoid borders)
    h, w = gray.shape
    roi  = gray[h//3 : 2*h//3, w//8 : 7*w//8]

    # Horizontal projection: mean brightness per column
    proj = roi.mean(axis=0).astype(np.float32)
    proj -= proj.mean()

    # Autocorrelation
    acf = np.correlate(proj, proj, mode='full')
    acf = acf[len(acf)//2:]   # positive lags only
    acf = acf / (acf[0] + 1e-9)

    # Find first significant peak after lag-5 (ignore DC)
    min_lag = max(5, int(SCALE * 0.5))   # at least 0.5 mm
    max_lag = int(SCALE * 3.0)           # at most 3 mm
    if max_lag >= len(acf):
        return SCALE

    peaks, _ = scipy_signal.find_peaks(acf[min_lag:max_lag], height=0.1)
    if len(peaks) == 0:
        return SCALE   # fallback

    pitch_px = peaks[0] + min_lag
    return float(pitch_px)


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 3 — remove the pink grid, isolate the dark ECG trace
# ═══════════════════════════════════════════════════════════════════════════

def isolate_trace(bgr: np.ndarray) -> np.ndarray:
    """
    Returns a binary mask where 255 = ECG trace (dark ink).
    Strategy:
      • Convert to HSV; mask out pink/red grid pixels
      • Threshold remaining dark pixels as trace
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:,:,0], hsv[:,:,1], hsv[:,:,2]

    # Pink/red hue wraps around 0/180 in OpenCV (0–179 scale)
    grid_mask = (
        ((h < 20) | (h > 155)) &    # hue in pink/red range
        (s > 30) &                    # some saturation
        (v > 80)                      # not too dark
    ).astype(np.uint8) * 255

    # Build grayscale with grid suppressed (set grid pixels to white)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    gray[grid_mask > 0] = 255

    # Threshold: dark pixels = trace
    _, trace = cv2.threshold(gray, TRACE_BRIGHT_MAX, 255, cv2.THRESH_BINARY_INV)

    # Morphological clean-up: remove tiny noise specks
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    trace  = cv2.morphologyEx(trace, cv2.MORPH_OPEN, kernel)

    return trace


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 4 — detect lead strip bounding boxes
# ═══════════════════════════════════════════════════════════════════════════

def detect_lead_strips(trace_mask: np.ndarray,
                        grid_pitch: float,
                        page_h: int, page_w: int) -> List[Dict]:
    """
    Scan horizontal bands for rows containing ECG trace activity.
    Groups nearby active rows into strips. Returns list of
    {y0, y1, x0, x1} bounding boxes.
    """
    min_w = int(MIN_STRIP_WIDTH_MM * grid_pitch)

    row_activity = (trace_mask > 0).sum(axis=1).astype(np.float32)

    # Active = any meaningful trace pixels in that row (>0.5% of page width)
    active = row_activity > max(3, page_w * 0.003)

    # Collect active row indices and cluster with a vertical gap tolerance
    active_rows = np.where(active)[0]
    if len(active_rows) == 0:
        return []

    GAP_TOLERANCE_PX = max(20, int(grid_pitch * 3))  # merge rows within 3 mm

    clusters = []
    cluster_start = active_rows[0]
    cluster_end   = active_rows[0]
    for r in active_rows[1:]:
        if r - cluster_end <= GAP_TOLERANCE_PX:
            cluster_end = r
        else:
            clusters.append((cluster_start, cluster_end))
            cluster_start = cluster_end = r
    clusters.append((cluster_start, cluster_end))

    strips = []
    for (y0_raw, y1_raw) in clusters:
        # Expand vertically by a margin so the full waveform amplitude is included
        margin = max(10, int(grid_pitch * 5))
        y0 = max(0, y0_raw - margin)
        y1 = min(page_h, y1_raw + margin)

        band = trace_mask[y0:y1, :]
        col_act = (band > 0).sum(axis=0)
        xs = np.where(col_act > 0)[0]
        if len(xs) >= min_w:
            strips.append({"y0": y0, "y1": y1,
                            "x0": int(xs[0]), "x1": int(xs[-1])})

    return strips


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 5 — extract signal from a single strip
# ═══════════════════════════════════════════════════════════════════════════

def extract_strip_signal(trace_mask: np.ndarray,
                          strip: Dict,
                          grid_pitch: float) -> Tuple[np.ndarray, float]:
    """
    For each column in the strip, find the Y centroid of trace pixels.
    Convert Y pixels → mV  (calibrate from strip midpoint = 0 mV).
    Returns (signal_mv, fs_hz).
    """
    y0, y1 = strip["y0"], strip["y1"]
    x0, x1 = strip["x0"], strip["x1"]
    roi = trace_mask[y0:y1, x0:x1]

    h, w = roi.shape
    baseline_y = h / 2.0   # assume midpoint of strip = isoelectric baseline

    # Sanity-clamp grid_pitch: must be between 0.5 mm and 3 mm worth of pixels.
    # If detect_grid_pitch failed, this keeps mV values in a sane range.
    min_pitch = DPI / 25.4 * 0.5   # 0.5 mm at render DPI
    max_pitch = DPI / 25.4 * 3.0   # 3.0 mm at render DPI
    grid_pitch = float(np.clip(grid_pitch, min_pitch, max_pitch))

    # Pixel → mV scale: grid_pitch px = 1 mm, 10 mm = 1 mV
    px_per_mv = grid_pitch * MM_PER_MV

    raw_y = np.full(w, np.nan)
    for col in range(w):
        col_data = roi[:, col]
        ys = np.where(col_data > 0)[0]
        if len(ys) > 0:
            raw_y[col] = float(np.median(ys))

    # Interpolate over NaN gaps (no trace pixels in that column)
    nans = np.isnan(raw_y)
    if nans.all():
        return np.zeros(w), TARGET_FS

    xs_valid = np.where(~nans)[0]
    raw_y[nans] = np.interp(np.where(nans)[0], xs_valid, raw_y[xs_valid])

    # Convert: upward deflection = positive mV
    signal_mv = -(raw_y - baseline_y) / px_per_mv

    # Hard clamp to ±5 mV — any larger value is a calibration error
    signal_mv = np.clip(signal_mv, -5.0, 5.0)

    # Determine native sampling rate from grid pitch
    px_per_s  = grid_pitch * MM_PER_S
    native_fs = px_per_s

    # Resample to TARGET_FS
    n_out = max(1, int(round(len(signal_mv) * TARGET_FS / native_fs)))
    resampled = scipy_signal.resample(signal_mv, n_out)

    # Light bandpass 0.5–40 Hz to remove baseline wander and HF noise
    nyq = TARGET_FS / 2.0
    try:
        b, a = scipy_signal.butter(2, [0.5 / nyq, 40.0 / nyq], btype='band')
        resampled = scipy_signal.filtfilt(b, a, resampled)
    except Exception:
        pass   # signal too short, skip filtering

    # Final clamp after filtering
    resampled = np.clip(resampled, -5.0, 5.0)

    return resampled, float(TARGET_FS)


# ═══════════════════════════════════════════════════════════════════════════
#  STEP 6 — basic metrics from extracted signal
# ═══════════════════════════════════════════════════════════════════════════

LEAD_NAMES_12 = ["I","II","III","aVR","aVL","aVF","V1","V2","V3","V4","V5","V6"]
LEAD_NAMES_6  = ["I","II","III","aVR","aVL","aVF"]
LEAD_NAMES_2  = ["I","II"]


def estimate_heart_rate(signal: np.ndarray, fs: float) -> Optional[float]:
    """Estimate HR from R-R intervals via peak detection on signal."""
    if len(signal) < fs:
        return None
    # Normalise
    s = signal - np.mean(signal)
    s = s / (np.std(s) + 1e-9)
    # Find peaks (R waves)
    min_dist = int(fs * 0.3)   # refractory ~300 ms
    peaks, _ = scipy_signal.find_peaks(s, height=0.5, distance=min_dist)
    if len(peaks) < 2:
        return None
    rr = np.diff(peaks) / fs   # RR intervals in seconds
    return round(60.0 / np.mean(rr))


def compute_metrics(leads: List[Dict]) -> Dict:
    """Derive HR and interval estimates from available lead signals."""
    hr = None
    for lead in leads:
        hr = estimate_heart_rate(np.array(lead["signal"]), lead["fs"])
        if hr:
            break

    return {
        "heartRate":   f"{hr} bpm" if hr else "—",
        "prInterval":  "—",    # would need P-wave detector
        "qrsDuration": "—",
        "qtInterval":  "—",
    }


# ═══════════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════

def extract_ecg_from_pdf(pdf_input) -> Tuple[List[Dict], Dict]:
    """
    Main entry point.

    Parameters
    ----------
    pdf_input : bytes | str | pathlib.Path
        Either raw PDF bytes or a file path.

    Returns
    -------
    leads   : list of dicts  { name, signal (list[float]), fs, unit }
    metrics : dict           { heartRate, prInterval, qrsDuration, qtInterval }
    """
    if isinstance(pdf_input, (str,)):
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
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        grid_pitch = detect_grid_pitch(gray)   # px / mm
        log.debug(f"Page {page_idx}: grid_pitch={grid_pitch:.1f} px/mm")

        trace_mask = isolate_trace(bgr)
        h, w = bgr.shape[:2]
        strips = detect_lead_strips(trace_mask, grid_pitch, h, w)
        log.debug(f"Page {page_idx}: detected {len(strips)} strips")

        for i, strip in enumerate(strips):
            sig, fs = extract_strip_signal(trace_mask, strip, grid_pitch)
            all_leads.append({
                "name":   f"Lead{len(all_leads)+1}",
                "signal": sig.tolist(),
                "fs":     fs,
                "unit":   "mV",
                "strip":  strip,   # pixel coords for debugging
            })

    # Assign standard lead names
    n = len(all_leads)
    names = (LEAD_NAMES_12 if n >= 12 else
             LEAD_NAMES_6  if n >= 6  else
             LEAD_NAMES_2  if n >= 2  else
             [f"Lead{i+1}" for i in range(n)])
    for i, lead in enumerate(all_leads):
        lead["name"] = names[i] if i < len(names) else f"Lead{i+1}"

    metrics = compute_metrics(all_leads)
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
              f"min={arr.min():.2f}  max={arr.max():.2f} mV")
    print("Metrics:", json.dumps(metrics, indent=2))
