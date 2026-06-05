import { Link } from 'react-router-dom';
import '../styles/home.css';

// ECG Waveform SVG path
const ECG_PATH = "M0,40 L30,40 L35,40 L40,10 L45,70 L50,40 L55,40 L65,40 L70,38 L75,42 L80,40 L100,40 L105,40 L110,10 L115,70 L120,40 L125,40 L135,40 L140,38 L145,42 L150,40 L170,40 L175,40 L180,10 L185,70 L190,40 L195,40 L205,40 L210,38 L215,42 L220,40 L240,40 L245,40 L250,10 L255,70 L260,40 L265,40 L275,40 L280,38 L285,42 L290,40 L310,40 L315,40 L320,10 L325,70 L330,40 L335,40 L345,40 L350,38 L355,42 L360,40 L380,40 L385,40 L390,10 L395,70 L400,40";

// Material Icons as inline SVG components
const IconHeart = ({ size = 24, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

const IconTrendingUp = ({ size = 24, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
  </svg>
);

const IconSmartToy = ({ size = 24, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zM9 14c-.83 0-1.5-.67-1.5-1.5S8.17 11 9 11s1.5.67 1.5 1.5S9.83 14 9 14zm6 0c-.83 0-1.5-.67-1.5-1.5S14.17 11 15 11s1.5.67 1.5 1.5S15.83 14 15 14z"/>
  </svg>
);

const IconBiotech = ({ size = 24, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M7 19c-1.1 0-2 .9-2 2h14c0-1.1-.89-2-2-2h-4v-2h3c1.1 0 2-.9 2-2h-8c-1.66 0-3-1.34-3-3 0-1.09.59-2.04 1.46-2.56C8.17 9.03 8 8.54 8 8c0-.21.04-.42.09-.62C6.28 8.13 5 9.92 5 12c0 2.76 2.24 5 5 5v2H7zM14.5 4c.83 0 1.5.67 1.5 1.5 0 .15-.02.29-.06.43l1.44 1.44A3.49 3.49 0 0 0 18 5.5C18 3.57 16.43 2 14.5 2c-1.4 0-2.6.83-3.16 2.02l1.46 1.46c.16-.56.67-.98 1.2-.98z"/>
  </svg>
);

const IconBolt = ({ size = 24, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
  </svg>
);

const IconLink = ({ size = 24, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
  </svg>
);

const IconTrophy = ({ size = 24, color = 'currentColor' }) => (
  <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
    <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
  </svg>
);

const featureIcons = {
  heart: IconHeart,
  trending: IconTrendingUp,
  robot: IconSmartToy,
  biotech: IconBiotech,
  bolt: IconBolt,
};

const features = [
  { iconKey: 'heart', color: 'blue', title: 'Cardio Risk Analysis', desc: 'Advanced cardiovascular risk assessment using clinical parameters and AI-powered prediction models.' },
  { iconKey: 'trending', color: 'teal', title: 'ECG Intelligence', desc: 'Deep learning ECG analysis for arrhythmia detection, waveform classification, and signal interpretation.' },
  { iconKey: 'robot', color: 'indigo', title: 'Transformer Models', desc: 'State-of-the-art TE and GAT transformer architectures for high-accuracy medical signal processing.' },
  { iconKey: 'biotech', color: 'mint', title: 'AI Diagnostics', desc: 'Multi-model ensemble AI for robust diagnostic support and clinical decision assistance.' },
  { iconKey: 'bolt', color: 'cyan', title: 'Real-Time Analytics', desc: 'Instant risk scoring and probability assessment with confidence metrics and clinical recommendations.' },
];

const stats = [
  { num: '98.7', suffix: '%', label: 'Prediction Accuracy' },
  { num: '120', suffix: 'K+', label: 'ECG Samples Trained' },
  { num: '3', suffix: '', label: 'AI Models' },
  { num: '<1', suffix: 's', label: 'Real-Time Analysis' },
];

// Social icons (Material style)
const GithubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
  </svg>
);

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
  </svg>
);

const EmailIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  </svg>
);

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
                <div className="float-card-icon blue">
                  <IconHeart size={20} color="#1E88E5" />
                </div>
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
                <div className="float-card-icon teal">
                  <IconTrendingUp size={20} color="#26A69A" />
                </div>
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
            <span className="section-label" style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}>
              <IconBolt size={16} /> Capabilities
            </span>
            <h2 className="section-title">Intelligent Healthcare Features</h2>
            <p className="section-subtitle">
              A comprehensive AI-powered platform combining advanced machine learning with clinical healthcare analytics.
            </p>
          </div>
          <div className="features-grid">
            {features.map((f, i) => {
              const IconComp = featureIcons[f.iconKey];
              return (
                <div key={i} className="feature-card">
                  <div className={`feature-icon ${f.color}`}>
                    <IconComp size={24} />
                  </div>
                  <h3 className="feature-title">{f.title}</h3>
                  <p className="feature-desc">{f.desc}</p>
                </div>
              );
            })}
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
              <span className="research-tag" style={{display:'flex',alignItems:'center',gap:6}}>
                <IconBiotech size={16} /> Research
              </span>
              <h2 className="research-title">Advanced AI Model Showcase</h2>
              <p className="research-desc">
                Our platform features three state-of-the-art deep learning architectures, each optimized for different aspects of ECG signal analysis and cardiovascular risk prediction.
              </p>
              <div className="research-points">
                {[
                  'TE Transformer for temporal ECG feature extraction',
                  'GAT Transformer leveraging graph attention networks',
                  'Hybrid TE+GAT model achieving highest accuracy',
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
                    <div className="model-card-icon b"><IconBolt size={18} /></div>
                    <span className="model-card-name">TE Transformer</span>
                  </div>
                  <div className="model-card-acc">96.2%</div>
                  <div className="model-card-desc">Temporal Encoding transformer for sequence-based ECG analysis</div>
                </div>
                <div className="model-card">
                  <div className="model-card-header">
                    <div className="model-card-icon t"><IconLink size={18} /></div>
                    <span className="model-card-name">GAT Transformer</span>
                  </div>
                  <div className="model-card-acc">97.1%</div>
                  <div className="model-card-desc">Graph Attention Networks for relational ECG pattern learning</div>
                </div>
                <div className="model-card featured">
                  <div className="model-card-header">
                    <div className="model-card-icon m"><IconTrophy size={18} /></div>
                    <span className="model-card-name">Hybrid TE+GAT</span>
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
                {[GithubIcon, TwitterIcon, LinkedinIcon, EmailIcon].map((Icon, i) => (
                  <a key={i} href="#" className="social-link"><Icon /></a>
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
