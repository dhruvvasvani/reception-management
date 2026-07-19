import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import ReceptionistScreen from './components/ReceptionistScreen';
import PatientScreen from './components/PatientScreen';
import LiveBackground from './components/LiveBackground';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import DemoSelectionScreen from './components/DemoSelectionScreen';
import DemoWorkspace from './components/DemoWorkspace';
import DemoIsolatedView from './components/DemoIsolatedView';
import './index.css';

const BASE_URL = 'http://localhost:3001';

function ThemeManager() {
  useEffect(() => {
    document.body.setAttribute('data-theme', 'light');
  }, []);
  return null;
}

function ProtectedRoute({ children, authToken }) {
  if (!authToken) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function PatientViewWrapper() {
  const { clinic_id } = useParams();
  const [queueState, setQueueState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clinic_id) {
      setError('No clinic ID provided.');
      return;
    }

    const newSocket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      query: { clinic_id }
    });

    newSocket.on('connect_error', (err) => {
      setError(err.message);
    });

    newSocket.on('queue_updated', (data) => {
      setQueueState(data);
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [clinic_id]);

  if (error) {
    return <div className="flex-center h-screen" style={{color:'#f87171'}}>Error: {error}</div>;
  }
  if (!queueState) {
    return <div className="flex-center h-screen"><div className="loader"></div></div>;
  }

  return <PatientScreen data={queueState} />;
}

function DashboardWrapper({ authToken, clinicData }) {
  const [queueState, setQueueState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authToken) return;

    const newSocket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: authToken }
    });

    newSocket.on('connect_error', (err) => {
      setError('Authentication failed. Please login again.');
      localStorage.removeItem('queue_token');
    });

    newSocket.on('queue_updated', (data) => {
      setQueueState(data);
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [authToken]);

  if (error) {
    return (
      <div className="flex-center h-screen" style={{flexDirection: 'column', color: 'var(--text-color)'}}>
        <p>{error}</p>
        <Link to="/auth" className="primary-gradient-btn" style={{marginTop: '1rem', textDecoration: 'none'}}>Go to Login</Link>
      </div>
    );
  }

  if (!queueState || !socket) {
    return <div className="flex-center h-screen"><div className="loader"></div></div>;
  }

  return (
    <div className="app-container">
      <div className="dashboard-header glass-card" style={{display: 'flex', justifyContent: 'space-between', padding: '1.5rem 2rem', marginBottom: '2rem', alignItems: 'center'}}>
        <h2 style={{margin: 0}}>{clinicData?.name || 'Clinic Dashboard'}</h2>
        <div style={{display: 'flex', gap: '1.5rem', alignItems: 'center'}}>
          <span style={{color: 'var(--text-muted)'}}>
            Patient URL: <a href={`/patient/${clinicData?.id}`} target="_blank" style={{color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600}}>{window.location.origin}/patient/{clinicData?.id}</a>
          </span>
          <button 
            onClick={() => { localStorage.removeItem('queue_token'); window.location.href = '/'; }} 
            className="primary-gradient-btn" 
            style={{padding: '0.6rem 1.2rem'}}
          >
            Logout
          </button>
        </div>
      </div>
      <ReceptionistScreen data={queueState} socket={socket} clinicId={clinicData?.id} />
    </div>
  );
}

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('queue_token'));
  const [clinicData, setClinicData] = useState(null);

  useEffect(() => {
    if (authToken) {
      fetch(`${BASE_URL}/api/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject('Invalid token'))
      .then(data => setClinicData({ id: data.id, name: data.clinic_name }))
      .catch(() => {
        localStorage.removeItem('queue_token');
        setAuthToken(null);
      });
    }
  }, [authToken]);

  return (
    <BrowserRouter>
      <ThemeManager />
      <LiveBackground />

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage setAuthToken={setAuthToken} setClinicData={setClinicData} />} />
        <Route path="/demo" element={<DemoSelectionScreen />} />
        <Route path="/demo/:clinic_id" element={<DemoWorkspace />} />
        <Route path="/demo/:clinic_id/receptionist" element={<DemoIsolatedView view="receptionist" />} />
        <Route path="/demo/:clinic_id/tv" element={<DemoIsolatedView view="tv" />} />
        <Route path="/demo/:clinic_id/patient" element={<DemoIsolatedView view="patient" />} />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute authToken={authToken}>
              <DashboardWrapper authToken={authToken} clinicData={clinicData} />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/patient/:clinic_id"
          element={<PatientViewWrapper />}
        />
        
        {/* Legacy redirects for old URLs to prevent 404s */}
        <Route path="/patient" element={<Navigate to="/" replace />} />
        <Route path="/receptionist" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
