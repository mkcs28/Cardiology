import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../styles/navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
        <div className="container navbar-inner">
          <Link to="/" className="navbar-logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                <path d="M7 12l1.5-3 3 6 1.5-3H20" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="logo-text">Cardio<span>AI</span></span>
          </Link>

          <ul className="navbar-links">
            <li>
              <Link to="/" className={`nav-link${isActive('/') ? ' active' : ''}`}>
                Home
              </Link>
            </li>
            <li className="dropdown-trigger">
              <span className={`nav-link${location.pathname.includes('calculator') ? ' active' : ''}`} style={{cursor:'pointer'}}>
                Risk Calculator
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
              <div className="dropdown">
                <div className="dropdown-item" onClick={() => navigate('/cardio-calculator')}>
                  <div className="dropdown-item-icon cardio">❤️</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:'0.88rem',color:'var(--text-primary)'}}>Cardio Risk Calculator</div>
                    <div style={{fontSize:'0.76rem',color:'var(--text-muted)',marginTop:2}}>Cardiovascular risk assessment</div>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <div className="dropdown-item" onClick={() => navigate('/ecg-calculator')}>
                  <div className="dropdown-item-icon ecg">📊</div>
                  <div>
                    <div style={{fontWeight:600,fontSize:'0.88rem',color:'var(--text-primary)'}}>ECG Calculator</div>
                    <div style={{fontSize:'0.76rem',color:'var(--text-muted)',marginTop:2}}>AI-powered ECG analysis</div>
                  </div>
                </div>
              </div>
            </li>
            <li>
              <Link to="/about" className={`nav-link${isActive('/about') ? ' active' : ''}`}>
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className={`nav-link${isActive('/contact') ? ' active' : ''}`}>
                Contact
              </Link>
            </li>
          </ul>

          <div className="navbar-cta">
            <Link to="/cardio-calculator" className="btn-outline" style={{fontSize:'0.85rem',padding:'9px 20px'}}>
              Try Now
            </Link>
            <div
              className={`hamburger${mobileOpen ? ' open' : ''}`}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu${mobileOpen ? ' open' : ''}`}>
        <Link to="/" className="mobile-menu-link">🏠 Home</Link>
        <Link to="/cardio-calculator" className="mobile-menu-link">❤️ Cardio Risk Calculator</Link>
        <Link to="/ecg-calculator" className="mobile-menu-link">📊 ECG Calculator</Link>
        <Link to="/about" className="mobile-menu-link">ℹ️ About</Link>
        <Link to="/contact" className="mobile-menu-link">✉️ Contact</Link>
      </div>
    </>
  );
}
