import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import ReceptionistScreen from './components/ReceptionistScreen';
import PatientScreen from './components/PatientScreen';
import LiveBackground from './components/LiveBackground';
import './index.css';

const socket = io('http://localhost:3001'); // Our backend URL

function Navigation() {
  const location = useLocation();
  const isPatientScreen = location.pathname === '/patient';

  if (isPatientScreen) return null;

  return (
    <div className="app-container" style={{paddingBottom: 0}}>
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
        <Route path="/" element={<div className="app-container"><h1 className="hero-text" style={{textAlign: 'center', marginTop: '20vh'}}>Demo Clinic Portal<br/><span style={{fontSize: '1.2rem', color: 'var(--text-muted)', background: 'none', WebkitTextFillColor: 'initial', fontWeight: 'normal'}}>Please select a view above</span></h1></div>} />
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
