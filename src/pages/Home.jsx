import { Link } from 'react-router-dom';
import '../styles/home.css';

// ECG Waveform SVG path
const ECG_PATH = "M0,40 L30,40 L35,40 L40,10 L45,70 L50,40 L55,40 L65,40 L70,38 L75,42 L80,40 L100,40 L105,40 L110,10 L115,70 L120,40 L125,40 L135,40 L140,38 L145,42 L150,40 L170,40 L175,40 L180,10 L185,70 L190,40 L195,40 L205,40 L210,38 L215,42 L220,40 L240,40 L245,40 L250,10 L255,70 L260,40 L265,40 L275,40 L280,38 L285,42 L290,40 L310,40 L315,40 L320,10 L325,70 L330,40 L335,40 L345,40 L350,38 L355,42 L360,40 L380,40 L385,40 L390,10 L395,70 L400,40";

const features = [
  { icon: '❤️', color: 'blue', title: 'Cardio Risk Analysis', desc: 'Advanced cardiovascular risk assessment using clinical parameters and AI-powered prediction models.' },
  { icon: '📈', color: 'teal', title: 'ECG Intelligence', desc: 'Deep learning ECG analysis for arrhythmia detection, waveform classification, and signal interpretation.' },
  { icon: '🤖', color: 'indigo', title: 'Transformer Models', desc: 'State-of-the-art TE and GAT transformer architectures for high-accuracy medical signal processing.' },
  { icon: '🔬', color: 'mint', title: 'AI Diagnostics', desc: 'Multi-model ensemble AI for robust diagnostic support and clinical decision assistance.' },
  { icon: '⚡', color: 'cyan', title: 'Real-Time Analytics', desc: 'Instant risk scoring and probability assessment with confidence metrics and clinical recommendations.' },
];

const stats = [
  { num: '98.7', suffix: '%', label: 'Prediction Accuracy' },
  { num: '120', suffix: 'K+', label: 'ECG Samples Trained' },
  { num: '3', suffix: '', label: 'AI Models' },
  { num: '<1', suffix: 's', label: 'Real-Time Analysis' },
];

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg-orb hero-bg-orb-1" />
        <div className="hero-bg-orb hero-bg-orb-2" />
        <div className="hero-bg-orb hero-bg-orb-3" />
        <div className="container">
          <div className="hero-content">
            <div className="hero-left">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                AI-Powered Healthcare Platform
              </div>
              <h1 className="hero-title">
                AI-Based <span className="highlight">Cardiovascular</span> &amp; ECG Risk Prediction Platform
              </h1>
              <p className="hero-subtitle">
                Advanced AI-powered healthcare analytics and ECG analysis system. Leveraging transformer architectures for clinical-grade cardiovascular risk assessment.
              </p>
              <div className="hero-actions">
                <Link to="/cardio-calculator" className="btn-primary">
                  Get Started →
                </Link>
                <Link to="/ecg-calculator" className="btn-outline">
                  Explore Models
                </Link>
              </div>
              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat-num">98.7%</span>
                  <span className="hero-stat-label">Accuracy</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-num">120K+</span>
                  <span className="hero-stat-label">ECG Samples</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-num">3</span>
                  <span className="hero-stat-label">AI Models</span>
                </div>
              </div>
            </div>

            <div className="hero-right">
              <div className="hero-float-card hero-float-card-1">
                <div className="float-card-icon blue">❤️</div>
                <div className="float-card-info">
                  <span className="float-card-val">Low Risk</span>
                  <span className="float-card-lbl">Cardio Score</span>
                </div>
              </div>

              <div className="hero-ecg-card">
                <div className="hero-ecg-header">
                  <span className="hero-ecg-title">ECG Live Monitor</span>
                  <div className="hero-ecg-live">
                    <div className="live-dot" /> LIVE
                  </div>
                </div>
                <div className="ecg-waveform-container">
                  <svg className="ecg-svg" viewBox="0 0 400 80" preserveAspectRatio="none">
                    {[20, 40, 60].map(y => (
                      <line key={y} x1="0" y1={y} x2="400" y2={y} className="ecg-grid-line" />
                    ))}
                    {[80, 160, 240, 320].map(x => (
                      <line key={x} x1={x} y1="0" x2={x} y2="80" className="ecg-grid-line" />
                    ))}
                    <path d={ECG_PATH} className="ecg-path" strokeDasharray="600" />
                  </svg>
                </div>
                <div className="hero-ecg-metrics">
                  <div className="ecg-metric">
                    <div className="ecg-metric-val">72</div>
                    <div className="ecg-metric-label">BPM</div>
                  </div>
                  <div className="ecg-metric">
                    <div className="ecg-metric-val">0.84s</div>
                    <div className="ecg-metric-label">PR Interval</div>
                  </div>
                  <div className="ecg-metric">
                    <div className="ecg-metric-val">Normal</div>
                    <div className="ecg-metric-label">Rhythm</div>
                  </div>
                </div>
              </div>

              <div className="hero-float-card hero-float-card-2">
                <div className="float-card-icon teal">📊</div>
                <div className="float-card-info">
                  <span className="float-card-val">98.7%</span>
                  <span className="float-card-lbl">Model Accuracy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <span className="section-label">⚡ Capabilities</span>
            <h2 className="section-title">Intelligent Healthcare Features</h2>
            <p className="section-subtitle">
              A comprehensive AI-powered platform combining advanced machine learning with clinical healthcare analytics.
            </p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => (
              <div key={i} className="feature-card">
                <div className={`feature-icon ${f.color}`}>{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            {stats.map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-number">
                  {s.num}<span className="stat-suffix">{s.suffix}</span>
                </div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESEARCH */}
      <section className="research-section">
        <div className="container">
          <div className="research-content">
            <div className="research-left">
              <span className="research-tag">🔬 Research</span>
              <h2 className="research-title">Advanced AI Model Showcase</h2>
              <p className="research-desc">
                Our platform features three state-of-the-art deep learning architectures, each optimized for different aspects of ECG signal analysis and cardiovascular risk prediction.
              </p>
              <div className="research-points">
                {[
                  'TE Transformer for temporal ECG feature extraction',
                  'GAT Transformer leveraging graph attention networks',
                  'Proposed hybrid model achieving highest accuracy',
                  'Multi-class arrhythmia classification',
                ].map((pt, i) => (
                  <div key={i} className="research-point">
                    <div className="research-point-dot" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:32}}>
                <Link to="/ecg-calculator" className="btn-primary">
                  Explore ECG Models →
                </Link>
              </div>
            </div>

            <div className="research-right">
              <div className="model-cards">
                <div className="model-card">
                  <div className="model-card-header">
                    <div className="model-card-icon b">⚡</div>
                    <span className="model-card-name">TE Transformer</span>
                  </div>
                  <div className="model-card-acc">96.2%</div>
                  <div className="model-card-desc">Temporal Encoding transformer for sequence-based ECG analysis</div>
                </div>
                <div className="model-card">
                  <div className="model-card-header">
                    <div className="model-card-icon t">🔗</div>
                    <span className="model-card-name">GAT Transformer</span>
                  </div>
                  <div className="model-card-acc">97.1%</div>
                  <div className="model-card-desc">Graph Attention Networks for relational ECG pattern learning</div>
                </div>
                <div className="model-card featured">
                  <div className="model-card-header">
                    <div className="model-card-icon m">🏆</div>
                    <span className="model-card-name">Proposed Hybrid Model</span>
                  </div>
                  <div className="model-card-acc">98.7%</div>
                  <div className="model-card-desc">Ensemble architecture combining TE + GAT for superior accuracy across all arrhythmia classes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo">
                <div className="footer-logo-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M7 12l1.5-3 3 6 1.5-3H20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="footer-logo-text">CardioAI</span>
              </div>
              <p className="footer-tagline">
                Advanced AI-powered cardiovascular risk prediction and ECG analysis platform for clinical decision support.
              </p>
              <div className="footer-socials">
                {['🐙', '🐦', '💼', '📧'].map((icon, i) => (
                  <a key={i} href="#" className="social-link">{icon}</a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="footer-col-title">Platform</h4>
              <ul className="footer-links">
                <li><Link to="/">Home</Link></li>
                <li><Link to="/cardio-calculator">Cardio Calculator</Link></li>
                <li><Link to="/ecg-calculator">ECG Calculator</Link></li>
                <li><Link to="/about">About</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Research</h4>
              <ul className="footer-links">
                <li><a href="#">TE Transformer</a></li>
                <li><a href="#">GAT Transformer</a></li>
                <li><a href="#">Hybrid Model</a></li>
                <li><a href="#">Publications</a></li>
              </ul>
            </div>

            <div>
              <h4 className="footer-col-title">Links</h4>
              <ul className="footer-links">
                <li><a href="#">GitHub Repository</a></li>
                <li><a href="#">Documentation</a></li>
                <li><Link to="/contact">Contact</Link></li>
                <li><a href="#">Research Paper</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2024 CardioAI. Built for research and educational purposes.</p>
            <p>Powered by React + Vite</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
