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
                  <div className="dropdown-item-icon cardio">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{fontWeight:600,fontSize:'0.88rem',color:'var(--text-primary)'}}>Cardio Risk Calculator</div>
                    <div style={{fontSize:'0.76rem',color:'var(--text-muted)',marginTop:2}}>Cardiovascular risk assessment</div>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <div className="dropdown-item" onClick={() => navigate('/ecg-calculator')}>
                  <div className="dropdown-item-icon ecg">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C4.22 3 3 4.22 3 5.5v13C3 19.78 4.22 21 5.5 21h15c1.28 0 2.5-1.22 2.5-2.5v-13C23 4.22 21.78 3 20.5 3z"/>
                    </svg>
                  </div>
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
        <Link to="/" className="mobile-menu-link">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className="mobile-link-icon">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          Home
        </Link>
        <Link to="/cardio-calculator" className="mobile-menu-link">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className="mobile-link-icon">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
          Cardio Risk Calculator
        </Link>
        <Link to="/ecg-calculator" className="mobile-menu-link">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className="mobile-link-icon">
            <path d="M9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4zm2.5 2.1h-15V5h15v14.1zm0-16.1h-15C4.22 3 3 4.22 3 5.5v13C3 19.78 4.22 21 5.5 21h15c1.28 0 2.5-1.22 2.5-2.5v-13C23 4.22 21.78 3 20.5 3z"/>
          </svg>
          ECG Calculator
        </Link>
        <Link to="/about" className="mobile-menu-link">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className="mobile-link-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
          </svg>
          About
        </Link>
        <Link to="/contact" className="mobile-menu-link">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" className="mobile-link-icon">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          Contact
        </Link>
      </div>
    </>
  );
}
