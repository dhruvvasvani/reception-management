import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Header() {
  const navigate = useNavigate();
  return (
    <nav className="landing-nav glass-nav">
      <div className="nav-logo" style={{cursor: 'pointer'}} onClick={() => navigate('/')}>
        <Activity size={28} className="accent-color" />
        <span style={{fontWeight: 800, fontSize: '1.25rem'}}>Queue Cure '26</span>
      </div>
      <div className="nav-actions">
        <button className="nav-login" onClick={() => navigate('/demo')} style={{marginRight: '0.5rem', color: 'var(--primary-color)'}}>Demo</button>
        <button className="nav-login" onClick={() => navigate('/auth')}>Login</button>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="nav-cta primary-gradient-btn"
          onClick={() => navigate('/auth')}
        >
          Get Started
        </motion.button>
      </div>
    </nav>
  );
}
