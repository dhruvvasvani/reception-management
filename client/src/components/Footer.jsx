import React from 'react';
import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        <div className="footer-brand">
          <div className="nav-logo" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={28} className="accent-color" />
            <span style={{fontWeight: 800, fontSize: '1.25rem'}}>Queue Cure '26</span>
          </div>
          <p className="footer-description">
            Modernizing the waiting room experience with real-time queue management for professionals.
          </p>
        </div>
        <div className="footer-links">
          <div className="footer-col">
            <h4>Product</h4>
            <Link to="/">Features</Link>
            <Link to="/">Pricing</Link>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <Link to="/">About</Link>
            <Link to="/">Contact</Link>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <Link to="/">Privacy</Link>
            <Link to="/">Terms</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Queue Cure '26. All rights reserved.</p>
      </div>
    </footer>
  );
}
