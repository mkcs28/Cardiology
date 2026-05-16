import '../styles/calculator.css';

const team = [
  { icon: '👨‍💻', title: 'AI/ML Engineering', desc: 'Deep learning model architecture, training pipelines, and performance optimization using PyTorch and TensorFlow.' },
  { icon: '🏥', title: 'Clinical Validation', desc: 'Rigorous clinical testing and validation of predictions against expert cardiologist assessments.' },
  { icon: '📊', title: 'Data Science', desc: 'Large-scale ECG dataset curation, preprocessing, feature engineering and statistical analysis.' },
];

const tech = [
  { icon: '⚛️', name: 'React + Vite', desc: 'Modern frontend framework with lightning-fast build tooling.' },
  { icon: '🤖', name: 'Transformer Models', desc: 'TE and GAT transformer architectures for ECG signal understanding.' },
  { icon: '🧠', name: 'Deep Learning', desc: 'Advanced neural network architectures for cardiac risk prediction.' },
  { icon: '📈', name: 'Signal Processing', desc: 'Digital signal processing algorithms for ECG waveform analysis.' },
  { icon: '🔬', name: 'Clinical AI', desc: 'AI systems designed to clinical standards for healthcare applications.' },
  { icon: '📱', name: 'Responsive Design', desc: 'Accessible on desktop, tablet, and mobile devices.' },
];

export default function About() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="container">
          <span className="section-label">ℹ️ About</span>
          <h1 className="about-hero-title">About <span className="gradient-text">CardioAI</span></h1>
          <p className="about-hero-subtitle">
            A research-grade AI platform for cardiovascular risk prediction and ECG arrhythmia detection, built with state-of-the-art deep learning models.
          </p>
        </div>
      </div>

      <section className="about-section">
        <div className="container">
          <div className="section-header">
            <span className="section-label">🎯 Mission</span>
            <h2 className="section-title">Our Research Mission</h2>
            <p className="section-subtitle">
              We aim to democratize cardiovascular diagnostics through accessible, accurate, and explainable AI.
            </p>
          </div>
          <div className="about-cards">
            {team.map((t, i) => (
              <div key={i} className="about-card">
                <div className="about-card-icon">{t.icon}</div>
                <h3 className="about-card-title">{t.title}</h3>
                <p className="about-card-desc">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section" style={{background:'var(--bg)',paddingTop:60}}>
        <div className="container">
          <div className="section-header">
            <span className="section-label">⚙️ Technology</span>
            <h2 className="section-title">Technology Stack</h2>
          </div>
          <div className="about-cards" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}>
            {tech.map((t, i) => (
              <div key={i} className="about-card" style={{textAlign:'left'}}>
                <div style={{fontSize:'1.6rem',marginBottom:12}}>{t.icon}</div>
                <h3 className="about-card-title">{t.name}</h3>
                <p className="about-card-desc">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section" style={{background:'linear-gradient(135deg,var(--blue),var(--teal))'}}>
        <div className="container" style={{textAlign:'center'}}>
          <h2 style={{fontSize:'2rem',fontWeight:700,color:'white',marginBottom:16}}>
            Open Source Research
          </h2>
          <p style={{fontSize:'1rem',color:'rgba(255,255,255,0.85)',maxWidth:540,margin:'0 auto 28px',lineHeight:1.7}}>
            This project is open source and available on GitHub. Contributions, feedback, and collaboration from the research community are welcome.
          </p>
          <a href="#" className="btn-primary" style={{background:'white',color:'var(--blue)'}}>
            🐙 View on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
