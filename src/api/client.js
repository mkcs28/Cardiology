// src/api/client.js
// ─────────────────────────────────────────────────────────────
//  Smart API client: tries the real Flask backend first,
//  falls back to deterministic mock responses when offline.
//  This makes the app fully hostable on Vercel / Netlify
//  without needing a running Python server.
// ─────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_BASE ?? "/api";
const TIMEOUT_MS = 15000;

async function _fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function _json(res) {
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "API error");
  return data;
}

// ── Check backend availability (always fresh — no stale caching) ──
async function _isBackendUp() {
  try {
    const res = await _fetchWithTimeout(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Health / status ──────────────────────────────────────────

export async function fetchHealth() {
  try {
    const res = await _fetchWithTimeout(`${BASE}/health`);
    const data = await _json(res);
    return data;
  } catch {
    throw new Error("Backend offline");
  }
}

export async function fetchModelsStatus() {
  if (await _isBackendUp()) {
    const res = await _fetchWithTimeout(`${BASE}/models/status`);
    return _json(res);
  }
  return mockModelsStatus();
}

export async function loadModel(modelId) {
  if (await _isBackendUp()) {
    const res = await _fetchWithTimeout(`${BASE}/models/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId }),
    });
    return _json(res);
  }
  return { success: true, modelId };
}

// ── ECG Analysis ──────────────────────────────────────────────

export async function analyzeECG(heaFile, datFile, modelId, threshold = 0.5) {
  if (await _isBackendUp()) {
    const form = new FormData();
    form.append("heaFile",   heaFile);
    form.append("datFile",   datFile);
    form.append("modelId",   modelId);
    form.append("threshold", String(threshold));
    const res = await _fetchWithTimeout(`${BASE}/ecg/analyze`, {
      method: "POST",
      body: form,
    });
    return _json(res);
  }
  // Simulate network latency
  await _delay(1800);
  return mockECGResult(heaFile.name, modelId, threshold);
}

// ── Cardio Risk ───────────────────────────────────────────────

export async function predictCardioRisk(formData) {
  if (await _isBackendUp()) {
    const res = await _fetchWithTimeout(`${BASE}/cardio/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    return _json(res);
  }
  await _delay(1600);
  return mockCardioResult(formData);
}

// ── Results history ───────────────────────────────────────────

export async function fetchHistory({ modelId, record, limit = 50 } = {}) {
  if (await _isBackendUp()) {
    const params = new URLSearchParams();
    if (modelId) params.set("modelId", modelId);
    if (record)  params.set("record",  record);
    params.set("limit", String(limit));
    const res = await _fetchWithTimeout(`${BASE}/results/history?${params}`);
    return _json(res);
  }
  return { success: true, results: [] };
}

// ═══════════════════════════════════════════════════════════════
//  MOCK ENGINE — deterministic, clinically plausible results
// ═══════════════════════════════════════════════════════════════

function _delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Seeded pseudo-random from a string (so same input → same output)
function _hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h);
}
function _seeded(seed, min, max) {
  const r = (_hash(String(seed)) % 1000) / 1000;
  return min + r * (max - min);
}

// ── Mock: Cardio Risk ─────────────────────────────────────────

function mockCardioResult(f) {
  // Deterministic risk score from clinical params
  let score = 5;
  const age = Number(f.age);
  const bmi = Number(f.bmi);
  const sys = Number(f.systolic);
  const chol = Number(f.cholesterol);
  const gluc = Number(f.glucose);
  const hdl  = Number(f.hdl);

  if (age > 60) score += 22; else if (age > 50) score += 14; else if (age > 40) score += 8;
  if (bmi > 35) score += 14; else if (bmi > 30) score += 9; else if (bmi > 27) score += 5;
  if (sys > 160) score += 20; else if (sys > 140) score += 13; else if (sys > 130) score += 6;
  if (chol > 260) score += 13; else if (chol > 220) score += 8; else if (chol > 200) score += 4;
  if (gluc > 200) score += 14; else if (gluc > 125) score += 9; else if (gluc > 100) score += 4;
  if (hdl < 35)  score += 10; else if (hdl < 45) score += 5; else if (hdl > 70) score -= 5;
  if (f.smoking === "yes") score += 14;
  else if (f.smoking === "former") score += 5;
  if (f.familyHistory === "yes") score += 10;
  if (f.physicalActivity === "none") score += 7;
  else if (f.physicalActivity === "high") score -= 5;
  if (f.gender === "male" && age > 45) score += 5;

  score = Math.min(Math.max(Math.round(score), 3), 97);
  const confidence = Math.round(88 + _seeded(score, 0, 10));
  const category = score < 25 ? "low" : score < 55 ? "moderate" : "high";

  const LOW_RECS = [
    "Continue your current healthy lifestyle — you're doing great.",
    "Maintain 150+ min/week of moderate aerobic exercise.",
    "Follow a heart-healthy Mediterranean diet.",
    "Annual cardiovascular check-up is sufficient at this risk level.",
    "Monitor blood pressure at home monthly.",
  ];
  const MOD_RECS = [
    "Schedule a cardiology consultation within the next 3 months.",
    "Reduce sodium intake to below 2,300 mg/day.",
    "Increase aerobic exercise to 5 days/week (30 min sessions).",
    "Consider statin therapy if LDL remains elevated.",
    "Check blood glucose levels every 2 weeks.",
    "Limit saturated fat and eliminate trans fats from diet.",
  ];
  const HIGH_RECS = [
    "Immediate cardiology consultation is strongly advised.",
    "Comprehensive cardiac workup (ECG, echo, stress test) required.",
    "Medication review and optimisation is critical — discuss with your doctor.",
    "Daily blood pressure and glucose self-monitoring essential.",
    "Cardiac rehabilitation program strongly recommended.",
    "Create an emergency action plan with your healthcare provider.",
    "Strictly avoid smoking and second-hand smoke exposure.",
  ];

  const recs = category === "low" ? LOW_RECS : category === "moderate" ? MOD_RECS : HIGH_RECS;

  return {
    success: true,
    riskPercent: score,
    riskCategory: category,
    confidence,
    recommendations: recs,
    timestamp: new Date().toLocaleString(),
    _mock: true,
  };
}

// ── Mock: ECG Analysis ────────────────────────────────────────

const ECG_CLASSES = [
  { cls: "NORM", label: "Normal Sinus Rhythm" },
  { cls: "CD",   label: "Conduction Disturbance" },
  { cls: "HYP",  label: "Hypertrophy" },
  { cls: "MI",   label: "Myocardial Infarction" },
  { cls: "STTC", label: "ST/T-wave Change" },
];

const MODEL_METRICS = {
  te:       { sensitivity: "95.8%", specificity: "96.1%", auc: "0.974" },
  gat:      { sensitivity: "96.5%", specificity: "97.0%", auc: "0.978" },
  proposed: { sensitivity: "98.2%", specificity: "98.9%", auc: "0.991" },
};

function mockECGResult(filename, modelId, threshold) {
  const seed = filename + modelId;

  // Generate probabilities that sum to 100
  const raw = ECG_CLASSES.map((_, i) => _seeded(seed + i, 1, 40));
  // Skew first class (NORM) to be likely highest
  raw[0] *= 2.5;
  const total = raw.reduce((a, b) => a + b, 0);
  const probs = raw.map(v => (v / total) * 100);

  // Sort descending for predictions array
  const predictions = ECG_CLASSES.map((c, i) => ({
    cls:      c.cls,
    label:    c.label,
    pct:      parseFloat(probs[i].toFixed(1)),
    detected: probs[i] / 100 > threshold,
  })).sort((a, b) => b.pct - a.pct);

  const detected = predictions.filter(p => p.detected);

  // Fake waveform polylines (6 leads, 50 points each)
  const makeWave = (leadSeed) => {
    const pts = [];
    for (let x = 0; x <= 500; x += 10) {
      const s = Math.sin(x / 30) * 25;
      const qrs = (x % 120 > 50 && x % 120 < 65) ? -40 + _seeded(leadSeed + x, -5, 5) : 0;
      const p   = (x % 120 > 20 && x % 120 < 35) ? 10 : 0;
      const t   = (x % 120 > 75 && x % 120 < 95) ? 15 : 0;
      const y = 70 + s * 0.3 + qrs + p + t + _seeded(leadSeed + x * 2, -3, 3);
      pts.push(`${x},${Math.max(5, Math.min(135, y)).toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const waveformData = {
    lead0: makeWave(seed + "0"),
    lead1: makeWave(seed + "1"),
    lead2: makeWave(seed + "2"),
    lead3: makeWave(seed + "3"),
    lead4: makeWave(seed + "4"),
    lead5: makeWave(seed + "5"),
  };

  const hr = Math.round(_seeded(seed + "hr", 52, 105));

  return {
    success: true,
    record: filename.replace(/\.(hea|dat)$/i, ""),
    modelId,
    threshold,
    device: "CPU (mock)",
    predictions,
    detected,
    waveformData,
    signalMetrics: {
      heartRate:   `${hr} bpm`,
      prInterval:  `${(0.12 + _seeded(seed + "pr", 0, 0.08)).toFixed(2)}s`,
      qrsDuration: `${(0.08 + _seeded(seed + "qrs", 0, 0.04)).toFixed(2)}s`,
      qtInterval:  `${(0.36 + _seeded(seed + "qt", 0, 0.10)).toFixed(2)}s`,
    },
    metrics: MODEL_METRICS[modelId] ?? MODEL_METRICS.proposed,
    timestamp: new Date().toLocaleString(),
    _mock: true,
  };
}

function mockModelsStatus() {
  return {
    success: true,
    models: {
      te:       { loaded: false, accuracy: "96.2%", file: "TE_Transformer.pth" },
      gat:      { loaded: false, accuracy: "97.1%", file: "GAT_Transformer.pth" },
      proposed: { loaded: false, accuracy: "98.7%", file: "Proposed.pth" },
    },
  };
}
