import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useParams, useNavigate } from 'react-router-dom';
import ReceptionistScreen from './ReceptionistScreen';
import LiveDisplayScreen from './LiveDisplayScreen';
import PatientScreen from './PatientScreen';

const BASE_URL = import.meta.env.PROD ? 'https://reception-management.onrender.com' : 'http://localhost:3001';

export default function DemoIsolatedView({ view }) {
  const { clinic_id } = useParams();
  const navigate = useNavigate();
  const [authToken, setAuthToken] = useState(null);
  const [clinicData, setClinicData] = useState(null);
  const [socket, setSocket] = useState(null);
  const [queueState, setQueueState] = useState(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/demo-login`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicNumber: clinic_id || 1 })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setAuthToken(data.token);
          setClinicData({ id: data.clinic_id, name: data.clinic_name });
        }
      });
  }, [clinic_id]);

  useEffect(() => {
    if (!authToken) return;

    const newSocket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: authToken }
    });

    newSocket.on('queue_updated', (data) => {
      setQueueState(data);
    });

    setSocket(newSocket);
    return () => newSocket.disconnect();
  }, [authToken]);

  if (!queueState || !socket || !clinicData) {
    return (
      <div className="flex-center h-screen" style={{ flexDirection: 'column' }}>
        <div className="loader"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Initializing {view} View...</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'auto', background: 'var(--bg-color)', padding: view === 'receptionist' ? '2rem' : '0' }}>
      {view === 'receptionist' && (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{marginBottom: '1rem', display: 'flex', justifyContent: 'space-between'}}>
             <button onClick={() => navigate('/demo')} style={{background: 'none', border: 'none', color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer'}}>
               ← Back to Clinics
             </button>
             <span style={{fontWeight: 'bold', color: 'var(--primary-color)'}}>{clinicData.name} (Isolated)</span>
          </div>
          <ReceptionistScreen data={queueState} socket={socket} clinicId={clinicData.id} isDemo={true} />
        </div>
      )}
      {view === 'tv' && (
        <LiveDisplayScreen data={queueState} />
      )}
      {view === 'patient' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', height: '100vh', borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)' }}>
          <PatientScreen data={queueState} />
        </div>
      )}
    </div>
  );
}
