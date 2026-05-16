import { useState } from 'react';
import '../styles/calculator.css';

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
              <p className="section-label">✉️ Contact</p>
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
                {[
                  { icon: '📧', label: 'Email', value: 'research@cardioai.dev' },
                  { icon: '🐙', label: 'GitHub', value: 'github.com/cardioai-research' },
                  { icon: '🐦', label: 'Twitter', value: '@CardioAI_Dev' },
                  { icon: '📍', label: 'Institution', value: 'Healthcare AI Research Lab' },
                ].map((item, i) => (
                  <div key={i} className="contact-item">
                    <div className="contact-item-icon">{item.icon}</div>
                    <div>
                      <div className="contact-item-label">{item.label}</div>
                      <div className="contact-item-value">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="contact-form-card">
              <h3 className="contact-form-title">Send a Message</h3>
              {sent ? (
                <div style={{textAlign:'center',padding:'40px 20px'}}>
                  <div style={{fontSize:'3rem',marginBottom:16}}>✅</div>
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
                  <button type="submit" className="calc-submit-btn">
                    ✉️ Send Message
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
