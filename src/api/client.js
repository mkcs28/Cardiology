// src/api/client.js
// ─────────────────────────────────────────────────────────────
//  Thin fetch wrappers for all CardioAI backend endpoints.
//  All requests go through Vite's /api proxy → Flask :5000
// ─────────────────────────────────────────────────────────────

const BASE = "/api";

async function _json(res) {
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "API error");
  return data;
}

// ── Health / status ──────────────────────────────────────────

export async function fetchHealth() {
  const res = await fetch(`${BASE}/health`);
  return _json(res);
}

export async function fetchModelsStatus() {
  const res = await fetch(`${BASE}/models/status`);
  return _json(res);
}

export async function loadModel(modelId) {
  const res = await fetch(`${BASE}/models/load`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ modelId }),
  });
  return _json(res);
}

// ── ECG Analysis ─────────────────────────────────────────────

/**
 * Upload a .hea + .dat pair and run ECG inference.
 * @param {File}   heaFile
 * @param {File}   datFile
 * @param {string} modelId   — "te" | "gat" | "proposed"
 * @param {number} threshold — 0–1, default 0.5
 */
export async function analyzeECG(heaFile, datFile, modelId, threshold = 0.5) {
  const form = new FormData();
  form.append("heaFile",   heaFile);
  form.append("datFile",   datFile);
  form.append("modelId",   modelId);
  form.append("threshold", String(threshold));

  const res = await fetch(`${BASE}/ecg/analyze`, {
    method: "POST",
    body:   form,
  });
  return _json(res);
}

// ── Results history ──────────────────────────────────────────

export async function fetchHistory({ modelId, record, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (modelId) params.set("modelId", modelId);
  if (record)  params.set("record",  record);
  params.set("limit", String(limit));

  const res = await fetch(`${BASE}/results/history?${params}`);
  return _json(res);
}

// ── Cardio Risk ──────────────────────────────────────────────

/**
 * POST patient form data → { riskPercent, riskCategory,
 *                             confidence, recommendations, timestamp }
 */
export async function predictCardioRisk(formData) {
  const res = await fetch(`${BASE}/cardio/predict`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(formData),
  });
  return _json(res);
}
