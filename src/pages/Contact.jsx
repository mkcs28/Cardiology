import { useState } from 'react';
import '../styles/calculator.css';

const IconEmail = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  </svg>
);

const IconGithub = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
  </svg>
);

const IconTwitter = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
  </svg>
);

const IconLocationOn = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

const IconMailOutline = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
  </svg>
);

const IconCheckCircle = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" style={{color:'var(--teal)'}}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

const IconErrorOutline = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
  </svg>
);

const contactItems = [
  { Icon: IconEmail, label: 'Email', value: 'research@cardioai.dev' },
  { Icon: IconGithub, label: 'GitHub', value: 'github.com/cardioai-research' },
  { Icon: IconTwitter, label: 'Twitter', value: '@CardioAI_Dev' },
  { Icon: IconLocationOn, label: 'Institution', value: 'Healthcare AI Research Lab' },
];

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="contact-page">
      <div className="page-hero">
        <div className="container">
          <div className="page-hero-inner">
            <div className="page-hero-text">
              <p className="section-label" style={{display:'inline-flex',alignItems:'center',gap:6}}>
                <IconMailOutline /> Contact
              </p>
              <h1 className="page-hero-title">Get In Touch</h1>
              <p className="page-hero-subtitle">Have questions about the platform or research? We'd love to hear from you.</p>
            </div>
          </div>
        </div>
      </div>

      <section className="contact-section">
        <div className="container">
          <div className="contact-grid">
            <div>
              <h2 className="contact-info-title">Let's Connect</h2>
              <p className="contact-info-desc">
                Whether you're a researcher, clinician, or developer interested in our AI cardiovascular platform, we're open to collaboration and feedback.
              </p>
              <div className="contact-items">
                {contactItems.map(({ Icon, label, value }, i) => (
                  <div key={i} className="contact-item">
                    <div className="contact-item-icon"><Icon /></div>
                    <div>
                      <div className="contact-item-label">{label}</div>
                      <div className="contact-item-value">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="contact-form-card">
              <h3 className="contact-form-title">Send a Message</h3>
              {sent ? (
                <div style={{textAlign:'center',padding:'40px 20px'}}>
                  <div style={{marginBottom:16,display:'flex',justifyContent:'center',color:'var(--teal)'}}>
                    <IconCheckCircle />
                  </div>
                  <h4 style={{fontWeight:700,color:'var(--text-primary)',marginBottom:8}}>Message Sent!</h4>
                  <p style={{fontSize:'0.9rem',color:'var(--text-muted)'}}>Thank you for reaching out. We'll get back to you soon.</p>
                  <button className="btn-primary" style={{marginTop:20}} onClick={() => setSent(false)}>
                    Send Another
                  </button>
                </div>
              ) : (
                <form className="contact-form" onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" type="text" placeholder="Dr. John Smith" required
                      value={form.name} onChange={e => set('name', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input className="form-input" type="email" placeholder="john@hospital.org" required
                      value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input className="form-input" type="text" placeholder="Research collaboration"
                      value={form.subject} onChange={e => set('subject', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Message</label>
                    <textarea className="contact-textarea" placeholder="Tell us about your inquiry..."
                      value={form.message} onChange={e => set('message', e.target.value)} />
                  </div>
                  <button type="submit" className="calc-submit-btn" style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
                    <IconSend /> Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
