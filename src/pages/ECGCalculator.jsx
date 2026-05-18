import { useState, useRef, useCallback } from 'react';
import '../styles/calculator.css';
import ApiStatusBanner from '../components/ApiStatusBanner';
import { analyzeECG } from '../api/client';
import { useApi } from '../api/useApi';

// ── Static model metadata (mirrors backend MODEL_REGISTRY) ───
const MODELS = [
  { id: 'te',       name: 'TE Transformer',  desc: 'Temporal Encoding transformer for time-series ECG analysis', acc: '96.2%', icon: 'bolt' },
  { id: 'gat',      name: 'GAT Transformer', desc: 'Graph Attention Network for relational pattern learning',     acc: '97.1%', icon: 'link' },
  { id: 'proposed', name: 'Proposed Model',  desc: 'Hybrid TE + GAT ensemble with superior accuracy',            acc: '98.7%', icon: 'trophy' },
];

const LEAD_LABELS = ['Lead I', 'Lead II', 'Lead III', 'aVR', 'aVL', 'aVF'];
const LEAD_KEYS   = ['lead0', 'lead1', 'lead2', 'lead3', 'lead4', 'lead5'];

const DEMO_ECG = "M0,70 L20,70 L25,68 L30,30 L35,110 L40,70 L50,70 L55,68 L60,30 L65,110 L70,70 L80,70 L85,68 L90,30 L95,110 L100,70 L110,70 L115,68 L120,30 L125,110 L130,70 L140,70 L145,68 L150,30 L155,110 L160,70 L170,70 L175,68 L180,30 L185,110 L190,70 L200,70 L205,68 L210,30 L215,110 L220,70 L230,70 L235,68 L240,30 L245,110 L250,70 L260,70 L265,68 L270,30 L275,110 L280,70 L290,70 L295,68 L300,30 L305,110 L310,70 L320,70 L325,68 L330,30 L335,110 L340,70 L350,70 L355,68 L360,30 L365,110 L370,70 L380,70 L385,68 L390,30 L395,110 L400,70 L410,70 L415,68 L420,30 L425,110 L430,70 L440,70 L445,68 L450,30 L455,110 L460,70 L470,70 L475,68 L480,30 L485,110 L490,70 L500,70";

function PolylineWave({ points, stroke, opacity = 1, offset = 0 }) {
  if (!points) return null;
  const shifted = points.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, (_, x, y) =>
    `${x},${Math.max(0, Math.min(140, parseFloat(y) + offset))}`
  );
  return <polyline points={shifted} fill="none" stroke={stroke}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
}

// ── Step 1: Claude Vision digitizes ECG waveforms into numeric signal arrays ──
async function extractSignalsFromPDF(pdfFile) {
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read PDF'));
    reader.readAsDataURL(pdfFile);
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
          },
          {
            type: 'text',
            text: `You are a clinical ECG digitization AI. Carefully examine this ECG PDF and digitize the waveforms into numeric amplitude samples so they can be fed into a deep learning model.

For each visible lead, trace the waveform and produce an array of exactly 1000 evenly-spaced amplitude values in millivolts (mV).
Baseline (isoelectric line) = 0.0 mV. Upward deflections are positive, downward are negative. Typical range: -2.0 to +2.0 mV.

Also extract the visible clinical measurements.

Respond ONLY with a valid JSON object — no markdown, no backticks, no explanation:
{
  "fs": 100,
  "heartRate": "<number> bpm",
  "prInterval": "<decimal>s",
  "qrsDuration": "<decimal>s",
  "qtInterval": "<decimal>s",
  "summary": "<2-3 sentence clinical summary>",
  "findings": ["<finding1>", "<finding2>"],
  "leads": {
    "lead0":  [<1000 float mV values — Lead I>],
    "lead1":  [<1000 float mV values — Lead II>],
    "lead2":  [<1000 float mV values — Lead III>],
    "lead3":  [<1000 float mV values — aVR>],
    "lead4":  [<1000 float mV values — aVL>],
    "lead5":  [<1000 float mV values — aVF>],
    "lead6":  [<1000 float mV values — V1>],
    "lead7":  [<1000 float mV values — V2>],
    "lead8":  [<1000 float mV values — V3>],
    "lead9":  [<1000 float mV values — V4>],
    "lead10": [<1000 float mV values — V5>],
    "lead11": [<1000 float mV values — V6>]
  }
}

Provide all 12 leads. If a lead is not visible in the PDF, synthesize it from nearby leads with similar morphology.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) throw new Error(`Claude Vision API error ${response.status}`);
  const data = await response.json();
  const text = data.content.map(b => b.text || '').join('');
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Step 2: Send numeric signals to backend → backend writes .hea + .dat → runs model ──
async function analyzeECGFromPDF(pdfFile, modelId, threshold, apiBase) {
  // Step 1 — Vision extracts numeric signal arrays from the PDF
  const extracted = await extractSignalsFromPDF(pdfFile);

  // Step 2 — POST signal arrays to backend; backend writes WFDB files and runs selected model
  const record = pdfFile.name.replace(/\.pdf$/i, '');
  const response = await fetch(`${apiBase}/ecg/analyze-from-signal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modelId,
      threshold,
      record,
      leads: extracted.leads,
      fs:    extracted.fs ?? 100,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Backend error ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) throw new Error(result.error || 'Analysis failed');

  // Attach Vision-extracted clinical text to the model result
  return {
    ...result,
    pdfSummary:  extracted.summary  ?? '',
    pdfFindings: extracted.findings ?? [],
    _fromPDF: true,
  };
}


export default function ECGCalculator() {
  const [selectedModel, setSelectedModel] = useState('proposed');
  const [threshold,     setThreshold]     = useState(0.5);
  const [heaFile,       setHeaFile]       = useState(null);
  const [datFile,       setDatFile]       = useState(null);
  const [pdfFile,       setPdfFile]       = useState(null);
  const [dragOverZone,  setDragOverZone]  = useState(null);
  const [activeLead,    setActiveLead]    = useState(0);
  const [inputMode,     setInputMode]     = useState('wfdb'); // 'wfdb' | 'pdf'

  const heaRef = useRef();
  const datRef = useRef();
  const pdfRef = useRef();

  const analyze = useCallback((hea, dat, model, thr) => analyzeECG(hea, dat, model, thr), []);
  const { call: runAnalysis, data: wfdbResult, loading: wfdbLoading, error: wfdbError, reset } = useApi(analyze);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError,   setPdfError]   = useState(null);
  const [pdfResult,  setPdfResult]  = useState(null);

  const activeResult  = inputMode === 'pdf' ? pdfResult   : wfdbResult;
  const activeLoading = inputMode === 'pdf' ? pdfLoading  : wfdbLoading;
  const activeError   = inputMode === 'pdf' ? pdfError    : wfdbError;

  const setFile = (type, file) => {
    if (!file) return;
    if (type === 'hea' && !file.name.toLowerCase().endsWith('.hea')) { alert('Please select a .hea file'); return; }
    if (type === 'dat' && !file.name.toLowerCase().endsWith('.dat')) { alert('Please select a .dat file'); return; }
    if (type === 'pdf' && !file.name.toLowerCase().endsWith('.pdf')) { alert('Please select a PDF file'); return; }
    if (type === 'hea') setHeaFile(file);
    else if (type === 'dat') setDatFile(file);
    else { setPdfFile(file); setPdfResult(null); setPdfError(null); }
    reset();
  };

  const handleDrop = (zone, e) => {
    e.preventDefault();
    setDragOverZone(null);
    const file = e.dataTransfer.files[0];
    if (file) setFile(zone, file);
  };

  const handleAnalyze = () => {
    if (!heaFile || !datFile) return;
    runAnalysis(heaFile, datFile, selectedModel, threshold);
  };

  const handlePdfAnalyze = async () => {
    if (!pdfFile) return;
    setPdfLoading(true); setPdfError(null); setPdfResult(null);
    try {
      const apiBase = (import.meta.env.VITE_API_BASE ?? '/api');
      const res = await analyzeECGFromPDF(pdfFile, selectedModel, threshold, apiBase);
      setPdfResult(res);
    } catch (err) {
      setPdfError(err.message || 'PDF analysis failed');
    } finally {
      setPdfLoading(false);
    }
  };

  const clearAll = () => {
    setHeaFile(null); setDatFile(null); setPdfFile(null);
    setPdfResult(null); setPdfError(null); reset();
  };

  const bothUploaded  = heaFile && datFile;
  const waveformData  = activeResult?.waveformData  ?? {};
  const signalMetrics = activeResult?.signalMetrics ?? { heartRate: '—', prInterval: '—', qrsDuration: '—', qtInterval: '—' };
  const predictions   = activeResult?.predictions   ?? [];
  const detected      = activeResult?.detected      ?? [];
  const metrics       = activeResult?.metrics       ?? null;
  const activeModel   = MODELS.find(m => m.id === selectedModel);
  const topPrediction = predictions[0];
  const hasWaveform   = waveformData[LEAD_KEYS[activeLead]];

  return (
    <div className="page-wrapper">
      <div className="page-hero">
        <div className="container">
          <div className="page-hero-inner">
            <div className="page-hero-text">
              <p className="section-label" style={{display:"inline-flex",alignItems:"center",gap:6}}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C4.22 3 3 4.22 3 5.5v13C3 19.78 4.22 21 5.5 21h15c1.28 0 2.5-1.22 2.5-2.5v-13C23 4.22 21.78 3 20.5 3z"/></svg>
                ECG Analysis
              </p>
              <h1 className="page-hero-title">ECG Calculator</h1>
              <p className="page-hero-subtitle">AI-powered ECG signal analysis using advanced transformer models.</p>
            </div>
            <div className="page-hero-badge" style={{display:"inline-flex",alignItems:"center",gap:6}}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3z"/></svg>
              Deep Learning · Arrhythmia Detection
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div style={{ paddingTop: 28 }}><ApiStatusBanner /></div>

        <div className="ecg-layout">

          {/* ── SIDEBAR ─────────────────────────────────── */}
          <div className="model-sidebar">
            <p className="model-sidebar-title">Select Model</p>
            {MODELS.map(m => (
              <div key={m.id}
                className={`model-select-card${selectedModel === m.id ? ' active' : ''}`}
                onClick={() => { setSelectedModel(m.id); reset(); }}
              >
                <div className="model-select-name">
                  {m.icon === 'bolt'   && <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{flexShrink:0}}><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>}
                  {m.icon === 'link'   && <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{flexShrink:0}}><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>}
                  {m.icon === 'trophy' && <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{flexShrink:0}}><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>}
                  {m.name}
                </div>
                <div className="model-select-desc">{m.desc}</div>
                <div className="model-select-acc">
                  <div className="model-acc-dot" />
                  <span className="model-acc-text">{m.acc} accuracy</span>
                </div>
              </div>
            ))}

            <div style={{ background:'white', borderRadius:'var(--radius-md)', padding:18, border:'1px solid var(--soft-gray)', marginTop:8 }}>
              <p style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', marginBottom:10 }}>ACTIVE MODEL</p>
              <p style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--blue)' }}>
                {activeModel?.icon === 'bolt'   && <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>}
                {activeModel?.icon === 'link'   && <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>}
                {activeModel?.icon === 'trophy' && <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>}
                {' '}{activeModel?.name}
              </p>
              <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', marginTop:4 }}>
                Accuracy: <strong style={{ color:'var(--mint)' }}>{activeModel?.acc}</strong>
              </p>
            </div>

            <div style={{ background:'white', borderRadius:'var(--radius-md)', padding:18, border:'1px solid var(--soft-gray)' }}>
              <p style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-muted)', marginBottom:10 }}>DETECTION THRESHOLD</p>
              <div className="range-wrapper">
                <div className="range-header">
                  <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>0.1 – 0.9</span>
                  <span className="range-val">{threshold.toFixed(2)}</span>
                </div>
                <input type="range" className="form-range" min="0.1" max="0.9" step="0.05"
                  value={threshold} onChange={e => { setThreshold(parseFloat(e.target.value)); reset(); }} />
              </div>
            </div>
          </div>

          {/* ── CENTER ──────────────────────────────────── */}
          <div className="ecg-center">

            {/* Mode Toggle */}
            <div style={{ display:'flex', gap:0, marginBottom:16, background:'var(--soft-gray)', borderRadius:'var(--radius-md)', padding:4 }}>
              {[
                { key:'wfdb', label:'WFDB Files', icon:<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C4.22 3 3 4.22 3 5.5v13C3 19.78 4.22 21 5.5 21h15c1.28 0 2.5-1.22 2.5-2.5v-13C23 4.22 21.78 3 20.5 3z"/></svg> },
                { key:'pdf',  label:'PDF Report',  icon:<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg> },
              ].map(({ key, label, icon }) => (
                <button key={key}
                  onClick={() => { setInputMode(key); clearAll(); }}
                  style={{
                    flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                    padding:'10px 16px', border:'none', cursor:'pointer',
                    borderRadius:'calc(var(--radius-md) - 2px)',
                    fontSize:'0.84rem', fontWeight:600, transition:'all 0.2s',
                    background: inputMode === key ? 'white' : 'transparent',
                    color:      inputMode === key ? 'var(--blue)' : 'var(--text-muted)',
                    boxShadow:  inputMode === key ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* ── WFDB Upload ─────────────────────────── */}
            {inputMode === 'wfdb' && (
              <div className="ecg-upload-card">
                <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/></svg>
                  Upload ECG Files
                </h3>
                <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:18 }}>
                  Upload the matching <strong>.hea</strong> header and <strong>.dat</strong> signal files (WFDB format).
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:16 }}>
                  {[
                    { zone:'hea', ref:heaRef, file:heaFile, label:'.hea Header', accept:'.hea' },
                    { zone:'dat', ref:datRef, file:datFile, label:'.dat Signal',  accept:'.dat' },
                  ].map(({ zone, ref, file, label, accept }) => (
                    <div key={zone}>
                      <input type="file" ref={ref} style={{ display:'none' }} accept={accept}
                        onChange={e => setFile(zone, e.target.files[0])} />
                      <div
                        className={`ecg-upload-area${dragOverZone === zone ? ' drag-over' : ''}`}
                        style={{ padding:'20px 14px', minHeight:130 }}
                        onDragOver={e => { e.preventDefault(); setDragOverZone(zone); }}
                        onDragLeave={() => setDragOverZone(null)}
                        onDrop={e => handleDrop(zone, e)}
                        onClick={() => ref.current.click()}
                      >
                        {file ? (
                          <>
                            <div style={{ marginBottom:6, color:'var(--teal)' }}><svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>
                            <p style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-primary)', wordBreak:'break-all', lineHeight:1.4 }}>{file.name}</p>
                            <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:4 }}>{(file.size/1024).toFixed(1)} KB</p>
                          </>
                        ) : (
                          <>
                            <div style={{ marginBottom:8, color:'var(--blue)' }}>
                              {zone === 'hea'
                                ? <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                                : <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C4.22 3 3 4.22 3 5.5v13C3 19.78 4.22 21 5.5 21h15c1.28 0 2.5-1.22 2.5-2.5v-13C23 4.22 21.78 3 20.5 3z"/></svg>}
                            </div>
                            <p style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-secondary)' }}>{label}</p>
                            <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4 }}>Drop or click</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button className="upload-browse-btn"
                    disabled={!bothUploaded || wfdbLoading}
                    onClick={handleAnalyze}
                    style={{
                      flex:1, justifyContent:'center',
                      background: bothUploaded ? 'linear-gradient(135deg,var(--blue),var(--teal))' : 'var(--soft-gray)',
                      color:      bothUploaded ? 'white' : 'var(--text-muted)',
                      opacity: wfdbLoading ? 0.7 : 1,
                      cursor: bothUploaded && !wfdbLoading ? 'pointer' : 'not-allowed',
                    }}>
                    {wfdbLoading ? 'Analyzing…' : 'Analyze ECG'}
                  </button>
                  {(heaFile || datFile) && (
                    <button className="upload-browse-btn" onClick={clearAll}
                      style={{ background:'var(--soft-gray)', color:'var(--text-secondary)' }}>Clear</button>
                  )}
                </div>
                {!bothUploaded && (
                  <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', textAlign:'center', marginTop:10 }}>
                    {!heaFile && !datFile ? 'Upload both .hea and .dat files to proceed.'
                      : !heaFile ? 'Still need: .hea header file'
                      : 'Still need: .dat signal file'}
                  </p>
                )}
              </div>
            )}

            {/* ── PDF Upload ───────────────────────────── */}
            {inputMode === 'pdf' && (
              <div className="ecg-upload-card">
                <h3 style={{ fontSize:'1rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                  Upload ECG PDF Report
                </h3>
                <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:8 }}>
                  Upload a PDF containing an ECG printout or report. Claude AI will visually read the waveforms and perform clinical analysis.
                </p>
                <div style={{
                  display:'inline-flex', alignItems:'center', gap:6, marginBottom:18,
                  background:'linear-gradient(135deg,rgba(103,58,183,0.08),rgba(30,136,229,0.08))',
                  border:'1px solid rgba(103,58,183,0.2)', borderRadius:20,
                  padding:'4px 12px', fontSize:'0.74rem', fontWeight:600, color:'#5c35a8',
                }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14.93V17a1 1 0 01-2 0v-.07A8 8 0 014 12a8 8 0 018-8 8 8 0 018 8 8 8 0 01-7 7.93zM12 6a1 1 0 110 2 1 1 0 010-2zm1 4v6h-2v-6h2z"/></svg>
                  Powered by Claude Vision AI — works without a backend
                </div>

                <input type="file" ref={pdfRef} style={{ display:'none' }} accept=".pdf"
                  onChange={e => setFile('pdf', e.target.files[0])} />
                <div
                  className={`ecg-upload-area${dragOverZone === 'pdf' ? ' drag-over' : ''}`}
                  style={{ padding:'28px 14px', minHeight:160, marginBottom:16 }}
                  onDragOver={e => { e.preventDefault(); setDragOverZone('pdf'); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={e => handleDrop('pdf', e)}
                  onClick={() => pdfRef.current.click()}
                >
                  {pdfFile ? (
                    <>
                      <div style={{ marginBottom:8, color:'var(--teal)' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                      </div>
                      <p style={{ fontSize:'0.88rem', fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>{pdfFile.name}</p>
                      <p style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>{(pdfFile.size/1024).toFixed(1)} KB · PDF ready for analysis</p>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom:12, color:'#8b6fcb' }}>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="44" height="44"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                      </div>
                      <p style={{ fontSize:'0.9rem', fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>Drop ECG PDF here or click to browse</p>
                      <p style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>Supports scanned ECG printouts, Holter reports, and digital ECG PDFs</p>
                    </>
                  )}
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <button className="upload-browse-btn"
                    disabled={!pdfFile || pdfLoading}
                    onClick={handlePdfAnalyze}
                    style={{
                      flex:1, justifyContent:'center', display:'flex', alignItems:'center', gap:8,
                      background: pdfFile ? 'linear-gradient(135deg,#673ab7,var(--blue))' : 'var(--soft-gray)',
                      color:      pdfFile ? 'white' : 'var(--text-muted)',
                      opacity: pdfLoading ? 0.75 : 1,
                      cursor: pdfFile && !pdfLoading ? 'pointer' : 'not-allowed',
                    }}>
                    {pdfLoading ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" style={{animation:'spin 1s linear infinite'}}><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                        Extracting signals → running model…
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                        Analyze with Claude AI
                      </>
                    )}
                  </button>
                  {pdfFile && (
                    <button className="upload-browse-btn" onClick={clearAll}
                      style={{ background:'var(--soft-gray)', color:'var(--text-secondary)' }}>Clear</button>
                  )}
                </div>

                {!pdfFile && (
                  <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', textAlign:'center', marginTop:10 }}>
                    Select a PDF containing an ECG recording to proceed.
                  </p>
                )}

                {/* AI Clinical Summary */}
                {pdfResult?.pdfSummary && (
                  <div style={{
                    marginTop:16, borderRadius:'var(--radius-md)', padding:'14px 16px',
                    background:'linear-gradient(135deg,rgba(103,58,183,0.06),rgba(30,136,229,0.06))',
                    border:'1px solid rgba(103,58,183,0.2)',
                  }}>
                    <p style={{ fontSize:'0.74rem', fontWeight:700, color:'#673ab7', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                      AI Clinical Summary
                    </p>
                    <p style={{ fontSize:'0.84rem', color:'var(--text-primary)', lineHeight:1.6, margin:0 }}>{pdfResult.pdfSummary}</p>
                    {pdfResult.pdfFindings?.length > 0 && (
                      <ul style={{ margin:'10px 0 0', paddingLeft:18 }}>
                        {pdfResult.pdfFindings.map((f, i) => (
                          <li key={i} style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginBottom:3 }}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error banner */}
            {activeError && (
              <div style={{
                background:'rgba(239,83,80,0.08)', border:'1px solid rgba(239,83,80,0.3)',
                borderRadius:'var(--radius-md)', padding:'14px 18px', color:'#C62828', fontSize:'0.85rem',
              }}>
                ❌ <strong>Analysis failed:</strong> {activeError}
              </div>
            )}

            {/* Waveform Card */}
            <div className="ecg-waveform-card">
              <div className="ecg-waveform-header">
                <h3 className="ecg-waveform-title">
                  📈 ECG Waveform
                  {activeResult && (
                    <span style={{ fontWeight:400, fontSize:'0.78rem', color:'var(--text-muted)', marginLeft:10 }}>
                      {activeResult.record} · {activeResult.timestamp}
                      {activeResult._fromPDF && (
                        <span style={{ marginLeft:6, background:'rgba(103,58,183,0.12)', color:'#673ab7',
                          borderRadius:10, padding:'2px 8px', fontSize:'0.7rem', fontWeight:700 }}>PDF</span>
                      )}
                    </span>
                  )}
                </h3>
                <div className="ecg-waveform-controls">
                  {LEAD_LABELS.slice(0,6).map((l,i) => (
                    <button key={i}
                      className={`ecg-ctrl-btn${activeLead === i ? ' active' : ''}`}
                      style={activeLead === i ? { background:'var(--blue)', color:'white', border:'1px solid var(--blue)' } : {}}
                      onClick={() => setActiveLead(i)}
                      title={l}
                    >{i+1}</button>
                  ))}
                </div>
              </div>
              <div className="ecg-display-area">
                <svg className="ecg-display-svg" viewBox="0 0 500 140" preserveAspectRatio="none">
                  {[28,56,84,112].map(y => <line key={`h${y}`} x1="0" y1={y} x2="500" y2={y} className="ecg-display-grid" />)}
                  {[0,56,112].map(y =>     <line key={`hM${y}`} x1="0" y1={y} x2="500" y2={y} className="ecg-display-grid-major" />)}
                  {[50,100,150,200,250,300,350,400,450].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="140" className="ecg-display-grid" />)}
                  {[0,250,500].map(x => <line key={`vM${x}`} x1={x} y1="0" x2={x} y2="140" className="ecg-display-grid-major" />)}
                  {hasWaveform ? (
                    <PolylineWave
                      points={waveformData[LEAD_KEYS[activeLead]]}
                      stroke={activeResult?._fromPDF ? '#673ab7' : 'var(--blue)'}
                    />
                  ) : (
                    <>
                      <path d={DEMO_ECG} className="ecg-display-path" />
                      <path d={DEMO_ECG.replace(/(\d+),(\d+)/g, (_, x, y) => `${x},${+y+18}`)} className="ecg-display-path-teal" />
                    </>
                  )}
                </svg>
              </div>
              <div className="ecg-labels-row">
                {LEAD_LABELS.map((l,i) => (
                  <span key={l} className="ecg-channel-label"
                    style={{ cursor:'pointer', background: activeLead===i ? 'rgba(30,136,229,0.18)' : undefined, fontWeight: activeLead===i ? 700 : 400 }}
                    onClick={() => setActiveLead(i)}
                  >{l}</span>
                ))}
                {activeResult && (
                  <span style={{ marginLeft:'auto', fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:500 }}>
                    Device: {activeResult.device}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ──────────────────────────────── */}
          <div className="ecg-right-panel">

            <div className="arrhythmia-card">
              <div className="arrhythmia-header">
                <div className="arrhythmia-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>
                <h3 className="arrhythmia-title">Arrhythmia Prediction</h3>
              </div>

              {!activeResult && !activeLoading && (
                <div className="prediction-placeholder" style={{ padding:'28px 10px' }}>
                  <div className="prediction-placeholder-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36" style={{color:'var(--blue)'}}><path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C4.22 3 3 4.22 3 5.5v13C3 19.78 4.22 21 5.5 21h15c1.28 0 2.5-1.22 2.5-2.5v-13C23 4.22 21.78 3 20.5 3z"/></svg></div>
                  <p className="prediction-placeholder-text">
                    {inputMode === 'pdf' ? 'Upload an ECG PDF and click "Analyze" — Claude Vision will digitize the signals and your selected model will classify them.' : 'Upload .hea + .dat files and click Analyze to see real predictions.'}
                  </p>
                </div>
              )}

              {activeLoading && (
                <div className="prediction-placeholder" style={{ padding:'28px 10px' }}>
                  <div className="prediction-placeholder-icon"><svg viewBox="0 0 24 24" fill="currentColor" width="36" height="36" style={{color:'var(--blue)'}}><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg></div>
                  <p className="prediction-placeholder-text">
                    {inputMode === 'pdf' ? `Step 1: Vision digitizing ECG → Step 2: ${activeModel?.name} classifying…` : `Running ${activeModel?.name} on backend…`}
                  </p>
                </div>
              )}

              {activeResult && !activeLoading && (
                <>
                  <div className="arrhythmia-result">
                    <div className="arrhythmia-class">
                      {detected.length > 0 ? detected.map(d => d.label).join(', ') : 'No Condition Detected'}
                    </div>
                    <div className="arrhythmia-confidence">
                      Top confidence: {topPrediction ? (topPrediction.pct.toFixed(1) + '%') : '—'}
                    </div>
                  </div>
                  <div className="prob-bars">
                    {predictions.map((p,i) => (
                      <div key={p.cls} className="prob-bar-row">
                        <div className="prob-bar-meta">
                          <span className="prob-bar-name">
                            {p.detected ? '✓ ' : ''}{p.label}
                            <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginLeft:4 }}>[{p.cls}]</span>
                          </span>
                          <span className="prob-bar-pct">{p.pct.toFixed(1)}%</span>
                        </div>
                        <div className="prob-bar-track">
                          <div className="prob-bar-fill" style={{
                            width:`${p.pct}%`,
                            background: p.detected
                              ? activeResult._fromPDF
                                ? 'linear-gradient(90deg,#673ab7,var(--blue))'
                                : 'linear-gradient(90deg,var(--blue),var(--teal))'
                              : 'var(--soft-gray)',
                            transition:`width ${0.4+i*0.1}s ease`,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginTop:12, textAlign:'center' }}>
                    Threshold: {activeResult.threshold} · {activeResult.timestamp}
                  </p>
                </>
              )}
            </div>

            <div className="model-analysis-card">
              <h4 className="model-analysis-title" style={{display:'flex',alignItems:'center',gap:8}}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M21 6.5l-4-4-9.5 9.5-2 4.5 4.5-2L21 6.5zm-13 8l-2-2 8-8 2 2-8 8z"/></svg>
                Model Analysis
              </h4>
              <div className="model-metric-grid">
                <div className="model-metric-item">
                  <div className="model-metric-value">{activeResult?._fromPDF ? 'Vision' : activeModel?.acc}</div>
                  <div className="model-metric-label">{activeResult?._fromPDF ? 'Mode' : 'Accuracy'}</div>
                </div>
                <div className="model-metric-item">
                  <div className="model-metric-value">{metrics?.sensitivity ?? (activeModel?.id==='te'?'95.8%':activeModel?.id==='gat'?'96.5%':'98.2%')}</div>
                  <div className="model-metric-label">Sensitivity</div>
                </div>
                <div className="model-metric-item">
                  <div className="model-metric-value">{metrics?.specificity ?? (activeModel?.id==='te'?'96.1%':activeModel?.id==='gat'?'97.0%':'98.9%')}</div>
                  <div className="model-metric-label">Specificity</div>
                </div>
                <div className="model-metric-item">
                  <div className="model-metric-value">{metrics?.auc ?? (activeModel?.id==='te'?'0.974':activeModel?.id==='gat'?'0.978':'0.991')}</div>
                  <div className="model-metric-label">AUC-ROC</div>
                </div>
              </div>
            </div>

            <div className="model-analysis-card"
              style={{ background:'linear-gradient(135deg,rgba(30,136,229,0.04),rgba(38,166,154,0.04))' }}>
              <h4 className="model-analysis-title" style={{display:'flex',alignItems:'center',gap:8}}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                Signal Metrics
                {activeResult && (
                  <span style={{ fontWeight:400, fontSize:'0.74rem', color:'var(--mint)', marginLeft:8 }}>
                    · {activeResult._fromPDF ? 'from PDF' : 'from waveform'}
                  </span>
                )}
              </h4>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'Heart Rate',   val:signalMetrics.heartRate   },
                  { label:'PR Interval',  val:signalMetrics.prInterval  },
                  { label:'QRS Duration', val:signalMetrics.qrsDuration },
                  { label:'QT Interval',  val:signalMetrics.qtInterval  },
                ].map((m,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.84rem' }}>
                    <span style={{ color:'var(--text-muted)', fontWeight:500 }}>{m.label}</span>
                    <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{m.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}
