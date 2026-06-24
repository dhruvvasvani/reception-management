import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { io } from 'socket.io-client';
import ReceptionistScreen from './components/ReceptionistScreen';
import PatientScreen from './components/PatientScreen';
import LiveBackground from './components/LiveBackground';
import './index.css';

const socket = io('https://reception-management.onrender.com', {
  transports: ['websocket', 'polling']
});

function Navigation() {
  const location = useLocation();
  const isPatientScreen = location.pathname === '/patient';
  const isHomeScreen = location.pathname === '/';

  if (isPatientScreen || isHomeScreen) return null;

  return (
    <div className="app-container" style={{ paddingBottom: 0 }}>
      <nav className="nav-container">
        <Link to="/receptionist" className="accent-badge">Reception Desk</Link>
        <Link to="/patient" className="accent-badge">Waiting Room TV</Link>
      </nav>
    </div>
  );
}

function ThemeManager() {
  useEffect(() => {
    document.body.setAttribute('data-theme', 'light');
  }, []);
  return null;
}

function HomeScreen() {
  return (
    <div className="flex-center h-screen" style={{ flexDirection: 'column', position: 'relative', zIndex: 10 }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{
          padding: '4rem 3rem',
          textAlign: 'center',
          maxWidth: '700px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.5)'
        }}
      >
        <h1 className="hero-text tech-font" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', margin: 0, lineHeight: 1.1, textTransform: 'uppercase' }}>
          Welcome Mentors of<br />Queue Cure '26
        </h1>
        <h2 style={{
          fontSize: '1.2rem',
          color: 'var(--text-muted)',
          fontWeight: '600',
          margin: '0 0 2rem 0',
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }}>
          Demo Clinic Webapp
        </h2>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
          <a href="/patient.html" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '1.2rem 2.5rem',
                background: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(99,102,241,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Waiting Room TV
            </motion.button>
          </a>

          <a href="/receptionist.html" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                padding: '1.2rem 2.5rem',
                background: 'var(--success-color)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '1.1rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(16,185,129,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Reception Desk
            </motion.button>
          </a>
        </div>
      </motion.div>
    </div>
  );
}

function App() {
  const [queueState, setQueueState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.on('queue_updated', (data) => {
      setQueueState(data);
      setLoading(false);
    });

    return () => socket.off('queue_updated');
  }, []);

  if (loading || !queueState) {
    return (
      <div className="flex-center h-screen">
        <div className="loader">
          <div className="bar1"></div><div className="bar2"></div><div className="bar3"></div>
          <div className="bar4"></div><div className="bar5"></div><div className="bar6"></div>
          <div className="bar7"></div><div className="bar8"></div><div className="bar9"></div>
          <div className="bar10"></div><div className="bar11"></div><div className="bar12"></div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <ThemeManager />
      <LiveBackground />
      <Navigation />

      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route
          path="/receptionist"
          element={<div className="app-container"><ReceptionistScreen data={queueState} socket={socket} /></div>}
        />
        <Route
          path="/patient"
          element={<PatientScreen data={queueState} />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
