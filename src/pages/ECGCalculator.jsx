import { useState, useRef, useCallback } from 'react';
import '../styles/calculator.css';
import ApiStatusBanner from '../components/ApiStatusBanner';
import { analyzeECG } from '../api/client';
import { useApi } from '../api/useApi';

// ── Static model metadata (mirrors backend MODEL_REGISTRY) ───
const MODELS = [
  { id: 'te',       name: 'TE Transformer',  desc: 'Temporal Encoding transformer for time-series ECG analysis', acc: '96.2%', icon: '⚡' },
  { id: 'gat',      name: 'GAT Transformer', desc: 'Graph Attention Network for relational pattern learning',     acc: '97.1%', icon: '🔗' },
  { id: 'proposed', name: 'Proposed Model',  desc: 'Hybrid TE + GAT ensemble with superior accuracy',            acc: '98.7%', icon: '🏆' },
];

const LEAD_LABELS = ['Lead I', 'Lead II', 'Lead III', 'aVR', 'aVL', 'aVF'];
const LEAD_KEYS   = ['lead0', 'lead1', 'lead2', 'lead3', 'lead4', 'lead5'];

// Fallback demo waveform when backend isn't connected yet
const DEMO_ECG = "M0,70 L20,70 L25,68 L30,30 L35,110 L40,70 L50,70 L55,68 L60,30 L65,110 L70,70 L80,70 L85,68 L90,30 L95,110 L100,70 L110,70 L115,68 L120,30 L125,110 L130,70 L140,70 L145,68 L150,30 L155,110 L160,70 L170,70 L175,68 L180,30 L185,110 L190,70 L200,70 L205,68 L210,30 L215,110 L220,70 L230,70 L235,68 L240,30 L245,110 L250,70 L260,70 L265,68 L270,30 L275,110 L280,70 L290,70 L295,68 L300,30 L305,110 L310,70 L320,70 L325,68 L330,30 L335,110 L340,70 L350,70 L355,68 L360,30 L365,110 L370,70 L380,70 L385,68 L390,30 L395,110 L400,70 L410,70 L415,68 L420,30 L425,110 L430,70 L440,70 L445,68 L450,30 L455,110 L460,70 L470,70 L475,68 L480,30 L485,110 L490,70 L500,70";

// Convert backend polyline points string to SVG <polyline> points attr
function PolylineWave({ points, stroke, opacity = 1, offset = 0 }) {
  if (!points) return null;
  // shift y by offset for multi-lead stacking
  const shifted = points.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, (_, x, y) =>
    `${x},${Math.max(0, Math.min(140, parseFloat(y) + offset))}`
  );
  return <polyline points={shifted} fill="none" stroke={stroke}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
}

export default function ECGCalculator() {
  const [selectedModel, setSelectedModel] = useState('proposed');
  const [threshold,     setThreshold]     = useState(0.5);
  const [heaFile,       setHeaFile]       = useState(null);
  const [datFile,       setDatFile]       = useState(null);
  const [dragOverZone,  setDragOverZone]  = useState(null); // 'hea' | 'dat' | null
  const [activeLead,    setActiveLead]    = useState(0);

  const heaRef = useRef();
  const datRef = useRef();

  const analyze = useCallback(
    (hea, dat, model, thr) => analyzeECG(hea, dat, model, thr),
    []
  );
  const { call: runAnalysis, data: result, loading, error, reset } = useApi(analyze);

  // ── File handlers ────────────────────────────────────────
  const setFile = (type, file) => {
    if (!file) return;
    if (type === 'hea' && !file.name.toLowerCase().endsWith('.hea')) {
      alert('Please select a .hea file'); return;
    }
    if (type === 'dat' && !file.name.toLowerCase().endsWith('.dat')) {
      alert('Please select a .dat file'); return;
    }
    if (type === 'hea') setHeaFile(file);
    else                setDatFile(file);
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

  const clearFiles = () => { setHeaFile(null); setDatFile(null); reset(); };

  // ── Derived display values ────────────────────────────────
  const bothUploaded = heaFile && datFile;

  const waveformData  = result?.waveformData ?? {};
  const signalMetrics = result?.signalMetrics ?? { heartRate: '—', prInterval: '—', qrsDuration: '—', qtInterval: '—' };
  const predictions   = result?.predictions  ?? [];
  const detected      = result?.detected     ?? [];
  const metrics       = result?.metrics      ?? null;
  const activeModel   = MODELS.find(m => m.id === selectedModel);

  const topPrediction = predictions[0];
  const hasWaveform   = waveformData[LEAD_KEYS[activeLead]];

  return (
    <div className="page-wrapper">
      <div className="page-hero">
        <div className="container">
          <div className="page-hero-inner">
            <div className="page-hero-text">
              <p className="section-label">📊 ECG Analysis</p>
              <h1 className="page-hero-title">ECG Calculator</h1>
              <p className="page-hero-subtitle">
                AI-powered ECG signal analysis using advanced transformer models.
              </p>
            </div>
            <div className="page-hero-badge">🤖 Deep Learning · Arrhythmia Detection</div>
          </div>
        </div>
      </div>

      <div className="container">
        <div style={{ paddingTop: 28 }}>
          <ApiStatusBanner />
        </div>

        <div className="ecg-layout">

          {/* ── MODEL SIDEBAR ────────────────────────────── */}
          <div className="model-sidebar">
            <p className="model-sidebar-title">Select Model</p>
            {MODELS.map(m => (
              <div key={m.id}
                className={`model-select-card${selectedModel === m.id ? ' active' : ''}`}
                onClick={() => { setSelectedModel(m.id); reset(); }}
              >
                <div className="model-select-name">{m.icon} {m.name}</div>
                <div className="model-select-desc">{m.desc}</div>
                <div className="model-select-acc">
                  <div className="model-acc-dot" />
                  <span className="model-acc-text">{m.acc} accuracy</span>
                </div>
              </div>
            ))}

            {/* Active model info */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: 18,
              border: '1px solid var(--soft-gray)', marginTop: 8 }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                ACTIVE MODEL
              </p>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--blue)' }}>
                {activeModel?.icon} {activeModel?.name}
              </p>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Accuracy: <strong style={{ color: 'var(--mint)' }}>{activeModel?.acc}</strong>
              </p>
            </div>

            {/* Threshold control */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-md)', padding: 18,
              border: '1px solid var(--soft-gray)' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
                DETECTION THRESHOLD
              </p>
              <div className="range-wrapper">
                <div className="range-header">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0.1 – 0.9</span>
                  <span className="range-val">{threshold.toFixed(2)}</span>
                </div>
                <input type="range" className="form-range" min="0.1" max="0.9" step="0.05"
                  value={threshold}
                  onChange={e => { setThreshold(parseFloat(e.target.value)); reset(); }} />
              </div>
            </div>
          </div>

          {/* ── CENTER ──────────────────────────────────── */}
          <div className="ecg-center">

            {/* Upload Card — dual .hea + .dat */}
            <div className="ecg-upload-card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                📁 Upload ECG Files
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 18 }}>
                Upload the matching <strong>.hea</strong> header and <strong>.dat</strong> signal files (WFDB format).
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                {/* HEA drop zone */}
                {[{ zone: 'hea', ref: heaRef, file: heaFile, label: '.hea Header', accept: '.hea' },
                  { zone: 'dat', ref: datRef, file: datFile, label: '.dat Signal',  accept: '.dat' }
                ].map(({ zone, ref, file, label, accept }) => (
                  <div key={zone}>
                    <input type="file" ref={ref} style={{ display: 'none' }} accept={accept}
                      onChange={e => setFile(zone, e.target.files[0])} />
                    <div
                      className={`ecg-upload-area${dragOverZone === zone ? ' drag-over' : ''}`}
                      style={{ padding: '20px 14px', minHeight: 130 }}
                      onDragOver={e => { e.preventDefault(); setDragOverZone(zone); }}
                      onDragLeave={() => setDragOverZone(null)}
                      onDrop={e => handleDrop(zone, e)}
                      onClick={() => ref.current.click()}
                    >
                      {file ? (
                        <>
                          <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>✅</div>
                          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)',
                            wordBreak: 'break-all', lineHeight: 1.4 }}>
                            {file.name}
                          </p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>
                            {zone === 'hea' ? '📋' : '📊'}
                          </div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {label}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Drop or click
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="upload-browse-btn"
                  disabled={!bothUploaded || loading}
                  onClick={handleAnalyze}
                  style={{
                    flex: 1, justifyContent: 'center',
                    background: bothUploaded
                      ? 'linear-gradient(135deg,var(--blue),var(--teal))'
                      : 'var(--soft-gray)',
                    color: bothUploaded ? 'white' : 'var(--text-muted)',
                    opacity: loading ? 0.7 : 1,
                    cursor: bothUploaded && !loading ? 'pointer' : 'not-allowed',
                  }}>
                  {loading ? '🔄 Analyzing…' : '🔬 Analyze ECG'}
                </button>
                {(heaFile || datFile) && (
                  <button className="upload-browse-btn" onClick={clearFiles}
                    style={{ background: 'var(--soft-gray)', color: 'var(--text-secondary)' }}>
                    ✕ Clear
                  </button>
                )}
              </div>

              {!bothUploaded && (
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
                  {!heaFile && !datFile ? 'Upload both .hea and .dat files to proceed.'
                    : !heaFile ? 'Still need: .hea header file'
                    : 'Still need: .dat signal file'}
                </p>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.3)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px',
                color: '#C62828', fontSize: '0.85rem',
              }}>
                ❌ <strong>Analysis failed:</strong> {error}
              </div>
            )}

            {/* ECG Waveform Display */}
            <div className="ecg-waveform-card">
              <div className="ecg-waveform-header">
                <h3 className="ecg-waveform-title">
                  📈 ECG Waveform
                  {result && (
                    <span style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 10 }}>
                      {result.record} · {result.timestamp}
                    </span>
                  )}
                </h3>
                <div className="ecg-waveform-controls">
                  {LEAD_LABELS.slice(0, 6).map((l, i) => (
                    <button key={i}
                      className={`ecg-ctrl-btn${activeLead === i ? ' active' : ''}`}
                      style={activeLead === i ? { background: 'var(--blue)', color: 'white', border: '1px solid var(--blue)' } : {}}
                      onClick={() => setActiveLead(i)}
                      title={l}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ecg-display-area">
                <svg className="ecg-display-svg" viewBox="0 0 500 140" preserveAspectRatio="none">
                  {/* Grid lines */}
                  {[28, 56, 84, 112].map(y => <line key={`h${y}`} x1="0" y1={y} x2="500" y2={y} className="ecg-display-grid" />)}
                  {[0, 56, 112].map(y =>     <line key={`hM${y}`} x1="0" y1={y} x2="500" y2={y} className="ecg-display-grid-major" />)}
                  {[50,100,150,200,250,300,350,400,450].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="140" className="ecg-display-grid" />)}
                  {[0, 250, 500].map(x =>   <line key={`vM${x}`} x1={x} y1="0" x2={x} y2="140" className="ecg-display-grid-major" />)}

                  {/* Real waveform from backend — active lead */}
                  {hasWaveform ? (
                    <PolylineWave points={waveformData[LEAD_KEYS[activeLead]]} stroke="var(--blue)" />
                  ) : (
                    /* Demo waveform when no result yet */
                    <>
                      <path d={DEMO_ECG} className="ecg-display-path" />
                      <path
                        d={DEMO_ECG.replace(/(\d+),(\d+)/g, (_, x, y) => `${x},${+y + 18}`)}
                        className="ecg-display-path-teal"
                      />
                    </>
                  )}
                </svg>
              </div>

              {/* Lead selector tabs */}
              <div className="ecg-labels-row">
                {LEAD_LABELS.map((l, i) => (
                  <span key={l}
                    className="ecg-channel-label"
                    style={{
                      cursor: 'pointer',
                      background: activeLead === i ? 'rgba(30,136,229,0.18)' : undefined,
                      fontWeight: activeLead === i ? 700 : 400,
                    }}
                    onClick={() => setActiveLead(i)}
                  >
                    {l}
                  </span>
                ))}
                {result && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    Device: {result.device}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ──────────────────────────────── */}
          <div className="ecg-right-panel">

            {/* Arrhythmia Prediction */}
            <div className="arrhythmia-card">
              <div className="arrhythmia-header">
                <div className="arrhythmia-icon">💓</div>
                <h3 className="arrhythmia-title">Arrhythmia Prediction</h3>
              </div>

              {!result && !loading && (
                <div className="prediction-placeholder" style={{ padding: '28px 10px' }}>
                  <div className="prediction-placeholder-icon">📊</div>
                  <p className="prediction-placeholder-text">
                    Upload .hea + .dat files and click Analyze to see real predictions.
                  </p>
                </div>
              )}

              {loading && (
                <div className="prediction-placeholder" style={{ padding: '28px 10px' }}>
                  <div className="prediction-placeholder-icon">🔄</div>
                  <p className="prediction-placeholder-text">
                    Running {activeModel?.name} on backend…
                  </p>
                </div>
              )}

              {result && !loading && (
                <>
                  {/* Primary detection */}
                  <div className="arrhythmia-result">
                    <div className="arrhythmia-class">
                      {detected.length > 0 ? detected.map(d => d.label).join(', ') : 'No Condition Detected'}
                    </div>
                    <div className="arrhythmia-confidence">
                      Top confidence: {topPrediction ? (topPrediction.pct.toFixed(1) + '%') : '—'}
                    </div>
                  </div>

                  {/* All 5 class probability bars */}
                  <div className="prob-bars">
                    {predictions.map((p, i) => (
                      <div key={p.cls} className="prob-bar-row">
                        <div className="prob-bar-meta">
                          <span className="prob-bar-name">
                            {p.detected ? '✅ ' : ''}{p.label}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                              [{p.cls}]
                            </span>
                          </span>
                          <span className="prob-bar-pct">{p.pct.toFixed(1)}%</span>
                        </div>
                        <div className="prob-bar-track">
                          <div
                            className="prob-bar-fill"
                            style={{
                              width:      `${p.pct}%`,
                              background: p.detected
                                ? 'linear-gradient(90deg,var(--blue),var(--teal))'
                                : 'var(--soft-gray)',
                              transition: `width ${0.4 + i * 0.1}s ease`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
                    Threshold: {result.threshold} · {result.timestamp}
                  </p>
                </>
              )}
            </div>

            {/* Model Analysis */}
            <div className="model-analysis-card">
              <h4 className="model-analysis-title">📐 Model Analysis</h4>
              <div className="model-metric-grid">
                <div className="model-metric-item">
                  <div className="model-metric-value">{activeModel?.acc}</div>
                  <div className="model-metric-label">Accuracy</div>
                </div>
                <div className="model-metric-item">
                  <div className="model-metric-value">
                    {metrics?.sensitivity ?? (activeModel?.id === 'te' ? '95.8%' : activeModel?.id === 'gat' ? '96.5%' : '98.2%')}
                  </div>
                  <div className="model-metric-label">Sensitivity</div>
                </div>
                <div className="model-metric-item">
                  <div className="model-metric-value">
                    {metrics?.specificity ?? (activeModel?.id === 'te' ? '96.1%' : activeModel?.id === 'gat' ? '97.0%' : '98.9%')}
                  </div>
                  <div className="model-metric-label">Specificity</div>
                </div>
                <div className="model-metric-item">
                  <div className="model-metric-value">
                    {metrics?.auc ?? (activeModel?.id === 'te' ? '0.974' : activeModel?.id === 'gat' ? '0.978' : '0.991')}
                  </div>
                  <div className="model-metric-label">AUC-ROC</div>
                </div>
              </div>
            </div>

            {/* Signal Metrics — real values from backend after analysis */}
            <div className="model-analysis-card"
              style={{ background: 'linear-gradient(135deg,rgba(30,136,229,0.04),rgba(38,166,154,0.04))' }}>
              <h4 className="model-analysis-title">
                📡 Signal Metrics
                {result && <span style={{ fontWeight: 400, fontSize: '0.74rem', color: 'var(--mint)', marginLeft: 8 }}>
                  · from waveform
                </span>}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Heart Rate',   val: signalMetrics.heartRate   },
                  { label: 'PR Interval',  val: signalMetrics.prInterval  },
                  { label: 'QRS Duration', val: signalMetrics.qrsDuration },
                  { label: 'QT Interval',  val: signalMetrics.qtInterval  },
                ].map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{m.label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
