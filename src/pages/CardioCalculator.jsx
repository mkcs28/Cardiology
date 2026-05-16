import { useState, useCallback } from 'react';
import '../styles/calculator.css';
import ApiStatusBanner from '../components/ApiStatusBanner';
import { predictCardioRisk } from '../api/client';
import { useApi } from '../api/useApi';

const initialForm = {
  age: 45, gender: 'male', bmi: 25, systolic: 120, diastolic: 80,
  cholesterol: 200, glucose: 90, smoking: 'no', hdl: 55, ldl: 120,
  physicalActivity: 'moderate', familyHistory: 'no',
};

const circumference = 2 * Math.PI * 68;

export default function CardioCalculator() {
  const [form, setForm] = useState(initialForm);

  const predict = useCallback((data) => predictCardioRisk(data), []);
  const { call: runPrediction, data: result, loading, error, reset } = useApi(predict);

  const set = (key, val) => { setForm(f => ({ ...f, [key]: val })); reset(); };
  const handleSubmit = () => runPrediction(form);

  const pct         = result?.riskPercent ?? 0;
  const category    = result?.riskCategory ?? 'low';
  const strokeOffset = circumference - (pct / 100) * circumference;
  const strokeColor  = { low: '#66BB6A', moderate: '#FFB300', high: '#EF5350' }[category] ?? '#DDE6ED';

  return (
    <div className="page-wrapper">
      <div className="page-hero">
        <div className="container">
          <div className="page-hero-inner">
            <div className="page-hero-text">
              <p className="section-label">❤️ Cardiovascular Risk</p>
              <h1 className="page-hero-title">Cardio Risk Calculator</h1>
              <p className="page-hero-subtitle">
                Enter patient parameters for AI-powered cardiovascular risk prediction.
              </p>
            </div>
            <div className="page-hero-badge">🔬 AI-Powered · Clinical Grade</div>
          </div>
        </div>
      </div>

      <div className="container">
        <div style={{ paddingTop: 28 }}>
          <ApiStatusBanner />
        </div>

        <div className="calc-layout">

          {/* ── PATIENT FORM ─────────────────────────────── */}
          <div className="form-card">
            <div className="form-card-header">
              <h2 className="form-card-title">Patient Information</h2>
              <p className="form-card-subtitle">Fill in the clinical parameters below for risk assessment.</p>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Age (years)</label>
                <div className="range-wrapper">
                  <div className="range-header">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>18 – 90</span>
                    <span className="range-val">{form.age}</span>
                  </div>
                  <input type="range" className="form-range" min="18" max="90"
                    value={form.age} onChange={e => set('age', +e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <div className="toggle-group">
                  {['male', 'female'].map(g => (
                    <button key={g} className={`toggle-btn${form.gender === g ? ' active' : ''}`}
                      onClick={() => set('gender', g)}>
                      {g === 'male' ? '♂ Male' : '♀ Female'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">BMI (kg/m²)</label>
                <div className="range-wrapper">
                  <div className="range-header">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>15 – 45</span>
                    <span className="range-val">{form.bmi}</span>
                  </div>
                  <input type="range" className="form-range" min="15" max="45" step="0.5"
                    value={form.bmi} onChange={e => set('bmi', +e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Systolic BP (mmHg)</label>
                <input type="number" className="form-input" min="80" max="220"
                  value={form.systolic} onChange={e => set('systolic', +e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Diastolic BP (mmHg)</label>
                <input type="number" className="form-input" min="50" max="140"
                  value={form.diastolic} onChange={e => set('diastolic', +e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Total Cholesterol (mg/dL)</label>
                <div className="range-wrapper">
                  <div className="range-header">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>100 – 350</span>
                    <span className="range-val">{form.cholesterol}</span>
                  </div>
                  <input type="range" className="form-range" min="100" max="350"
                    value={form.cholesterol} onChange={e => set('cholesterol', +e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Blood Glucose (mg/dL)</label>
                <input type="number" className="form-input" min="50" max="400"
                  value={form.glucose} onChange={e => set('glucose', +e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Smoking Status</label>
                <div className="toggle-group three">
                  {['no', 'former', 'yes'].map(s => (
                    <button key={s} className={`toggle-btn${form.smoking === s ? ' active' : ''}`}
                      onClick={() => set('smoking', s)}>
                      {s === 'no' ? '✓ No' : s === 'former' ? '⏸ Former' : '✕ Yes'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">HDL Cholesterol (mg/dL)</label>
                <div className="range-wrapper">
                  <div className="range-header">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>20 – 100</span>
                    <span className="range-val">{form.hdl}</span>
                  </div>
                  <input type="range" className="form-range" min="20" max="100"
                    value={form.hdl} onChange={e => set('hdl', +e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">LDL Cholesterol (mg/dL)</label>
                <div className="range-wrapper">
                  <div className="range-header">
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>50 – 250</span>
                    <span className="range-val">{form.ldl}</span>
                  </div>
                  <input type="range" className="form-range" min="50" max="250"
                    value={form.ldl} onChange={e => set('ldl', +e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Physical Activity</label>
                <select className="form-select" value={form.physicalActivity}
                  onChange={e => set('physicalActivity', e.target.value)}>
                  <option value="none">None / Sedentary</option>
                  <option value="low">Low (1–2×/week)</option>
                  <option value="moderate">Moderate (3–4×/week)</option>
                  <option value="high">High (5+×/week)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Family History of CVD</label>
                <div className="toggle-group">
                  {['no', 'yes'].map(v => (
                    <button key={v} className={`toggle-btn${form.familyHistory === v ? ' active' : ''}`}
                      onClick={() => set('familyHistory', v)}>
                      {v === 'no' ? '✓ No History' : '⚠ Yes, History'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.3)',
                borderRadius: 'var(--radius-sm)', padding: '12px 16px',
                color: '#C62828', fontSize: '0.85rem', marginBottom: 16,
              }}>
                ❌ {error}
              </div>
            )}

            <button className="calc-submit-btn" onClick={handleSubmit} disabled={loading}>
              {loading ? '🔄 Analysing via API…' : '🔬 Predict Cardiovascular Risk'}
            </button>
          </div>

          {/* ── PREDICTION PANEL ─────────────────────────── */}
          <div className="prediction-panel">
            <div className="prediction-card">
              <h3 className="prediction-card-title">📊 Risk Assessment</h3>

              {!result && !loading && !error && (
                <div className="prediction-placeholder">
                  <div className="prediction-placeholder-icon">❤️</div>
                  <p className="prediction-placeholder-text">
                    Fill in patient parameters and click "Predict" to view the risk assessment.
                  </p>
                </div>
              )}

              {loading && (
                <div className="prediction-placeholder">
                  <div className="prediction-placeholder-icon">🔄</div>
                  <p className="prediction-placeholder-text">Sending to backend API…</p>
                </div>
              )}

              {result && !loading && (
                <>
                  <div className="risk-gauge-wrap">
                    <svg className="risk-gauge-svg" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="68" className="risk-gauge-bg" />
                      <circle cx="80" cy="80" r="68"
                        className={`risk-gauge-fill ${category}`}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        stroke={strokeColor}
                      />
                    </svg>
                    <div className="risk-gauge-center">
                      <span className="risk-percentage">{pct}%</span>
                      <span className="risk-label">Risk Score</span>
                    </div>
                  </div>

                  <div className={`risk-category-badge ${category}`}>
                    {{ low: '✅ Low Risk', moderate: '⚠️ Moderate Risk', high: '🔴 High Risk' }[category]}
                  </div>

                  <div className="confidence-bar-wrap">
                    <div className="confidence-bar-header">
                      <span className="confidence-bar-label">Model Confidence</span>
                      <span className="confidence-bar-val">{result.confidence}%</span>
                    </div>
                    <div className="confidence-bar">
                      <div className="confidence-bar-fill" style={{ width: `${result.confidence}%` }} />
                    </div>
                  </div>

                  <div className="confidence-bar-wrap">
                    <div className="confidence-bar-header">
                      <span className="confidence-bar-label">Prediction Probability</span>
                      <span className="confidence-bar-val">{pct}%</span>
                    </div>
                    <div className="confidence-bar">
                      <div className="confidence-bar-fill" style={{ width: `${pct}%`, background: strokeColor }} />
                    </div>
                  </div>

                  <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                    Assessed {result.timestamp}
                  </p>
                </>
              )}
            </div>

            {result && !loading && (
              <div className="prediction-card">
                <div className="recommendation-panel">
                  <h4 className="rec-title">💡 Clinical Recommendations</h4>
                  <ul className="rec-list">
                    {result.recommendations.map((r, i) => (
                      <li key={i} className="rec-item">
                        <div className="rec-item-dot" />{r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="prediction-card"
                style={{ background: 'linear-gradient(135deg,rgba(30,136,229,0.04),rgba(38,166,154,0.04))' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  ⚠️ Disclaimer
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
                  For research and educational purposes only. Always consult a qualified healthcare
                  professional for medical advice.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
