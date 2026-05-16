import '../styles/calculator.css';

// Material Icons as inline SVGs
const IconCode = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
  </svg>
);

const IconLocalHospital = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z"/>
  </svg>
);

const IconBarChart = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C4.22 3 3 4.22 3 5.5v13C3 19.78 4.22 21 5.5 21h15c1.28 0 2.5-1.22 2.5-2.5v-13C23 4.22 21.78 3 20.5 3z"/>
  </svg>
);

const IconAtom = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 11c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm7.71-3.71C18.29 5.85 16.32 5 14.35 5c-1.08 0-2.19.28-3.22.87L9.6 4.34C10.89 3.48 12.4 3 14.03 3c2.47 0 4.93 1.03 6.68 2.78l-1 1.51zm-1.42 1.42l-1.5 1C17.5 10.5 18 11.71 18 13c0 2.76-2.24 5-5 5-1.29 0-2.5-.5-3.29-1.29l-1 1.5C9.78 19.37 10.86 20 12 20c3.87 0 7-3.13 7-7 0-1.64-.57-3.17-1.71-4.29zM4.29 7.29C5.71 5.87 7.68 5 9.65 5c1.08 0 2.19.28 3.22.87l1.53-1.53C13.11 3.48 11.6 3 9.97 3 7.5 3 5.04 4.03 3.29 5.78l1 1.51zm1.42 1.42l1.5 1C6.5 10.5 6 11.71 6 13c0 2.76 2.24 5 5 5 1.29 0 2.5-.5 3.29-1.29l1 1.5C14.22 19.37 13.14 20 12 20c-3.87 0-7-3.13-7-7 0-1.64.57-3.17 1.71-4.29z"/>
  </svg>
);

const IconSmartToy = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zM9 14c-.83 0-1.5-.67-1.5-1.5S8.17 11 9 11s1.5.67 1.5 1.5S9.83 14 9 14zm6 0c-.83 0-1.5-.67-1.5-1.5S14.17 11 15 11s1.5.67 1.5 1.5S15.83 14 15 14z"/>
  </svg>
);

const IconShowChart = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
  </svg>
);

const IconBiotech = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M7 19c-1.1 0-2 .9-2 2h14c0-1.1-.89-2-2-2h-4v-2h3c1.1 0 2-.9 2-2h-8c-1.66 0-3-1.34-3-3 0-1.09.59-2.04 1.46-2.56C8.17 9.03 8 8.54 8 8c0-.21.04-.42.09-.62C6.28 8.13 5 9.92 5 12c0 2.76 2.24 5 5 5v2H7z"/>
  </svg>
);

const IconPhoneAndroid = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z"/>
  </svg>
);

const IconInfo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

const IconTarget = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-12.5c-2.49 0-4.5 2.01-4.5 4.5S9.51 16.5 12 16.5s4.5-2.01 4.5-4.5S14.49 7.5 12 7.5zm0 5.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
);

const IconGithub = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
  </svg>
);

const team = [
  { Icon: IconCode, title: 'AI/ML Engineering', desc: 'Deep learning model architecture, training pipelines, and performance optimization using PyTorch and TensorFlow.' },
  { Icon: IconLocalHospital, title: 'Clinical Validation', desc: 'Rigorous clinical testing and validation of predictions against expert cardiologist assessments.' },
  { Icon: IconBarChart, title: 'Data Science', desc: 'Large-scale ECG dataset curation, preprocessing, feature engineering and statistical analysis.' },
];

const tech = [
  { Icon: IconAtom, name: 'React + Vite', desc: 'Modern frontend framework with lightning-fast build tooling.' },
  { Icon: IconSmartToy, name: 'Transformer Models', desc: 'TE and GAT transformer architectures for ECG signal understanding.' },
  { Icon: IconBiotech, name: 'Deep Learning', desc: 'Advanced neural network architectures for cardiac risk prediction.' },
  { Icon: IconShowChart, name: 'Signal Processing', desc: 'Digital signal processing algorithms for ECG waveform analysis.' },
  { Icon: IconBiotech, name: 'Clinical AI', desc: 'AI systems designed to clinical standards for healthcare applications.' },
  { Icon: IconPhoneAndroid, name: 'Responsive Design', desc: 'Accessible on desktop, tablet, and mobile devices.' },
];

export default function About() {
  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="container">
          <span className="section-label" style={{display:'inline-flex',alignItems:'center',gap:6}}>
            <IconInfo /> About
          </span>
          <h1 className="about-hero-title">About <span className="gradient-text">CardioAI</span></h1>
          <p className="about-hero-subtitle">
            A research-grade AI platform for cardiovascular risk prediction and ECG arrhythmia detection, built with state-of-the-art deep learning models.
          </p>
        </div>
      </div>

      <section className="about-section">
        <div className="container">
          <div className="section-header">
            <span className="section-label" style={{display:'inline-flex',alignItems:'center',gap:6,justifyContent:'center'}}>
              <IconTarget /> Mission
            </span>
            <h2 className="section-title">Our Research Mission</h2>
            <p className="section-subtitle">
              We aim to democratize cardiovascular diagnostics through accessible, accurate, and explainable AI.
            </p>
          </div>
          <div className="about-cards">
            {team.map(({ Icon, title, desc }, i) => (
              <div key={i} className="about-card">
                <div className="about-card-icon"><Icon /></div>
                <h3 className="about-card-title">{title}</h3>
                <p className="about-card-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-section" style={{background:'var(--bg)',paddingTop:60}}>
        <div className="container">
          <div className="section-header">
            <span className="section-label" style={{display:'inline-flex',alignItems:'center',gap:6,justifyContent:'center'}}>
              <IconSettings /> Technology
            </span>
            <h2 className="section-title">Technology Stack</h2>
          </div>
          <div className="about-cards" style={{gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}>
            {tech.map(({ Icon, name, desc }, i) => (
              <div key={i} className="about-card" style={{textAlign:'left'}}>
                <div style={{marginBottom:12,color:'var(--blue)'}}><Icon /></div>
                <h3 className="about-card-title">{name}</h3>
                <p className="about-card-desc">{desc}</p>
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
          <a href="#" className="btn-primary" style={{background:'white',color:'var(--blue)',display:'inline-flex',alignItems:'center',gap:8}}>
            <IconGithub /> View on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
