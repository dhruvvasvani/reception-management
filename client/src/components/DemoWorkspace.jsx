import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Monitor, Smartphone, Users, ExternalLink } from 'lucide-react';

const BASE_URL = import.meta.env.PROD ? 'https://reception-management.onrender.com' : 'http://localhost:3001';

export default function DemoWorkspace() {
  const { clinic_id } = useParams();
  const navigate = useNavigate();
  const [clinicData, setClinicData] = useState(null);

  useEffect(() => {
    // We just fetch to ensure it's a valid demo clinic and get the name
    fetch(`${BASE_URL}/api/demo-login`, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicNumber: clinic_id || 1 })
    })
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setClinicData({ id: data.clinic_id, name: data.clinic_name });
        }
      });
  }, [clinic_id]);

  if (!clinicData) {
    return (
      <div className="flex-center h-screen" style={{ flexDirection: 'column' }}>
        <div className="loader"></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading Demo Workspace...</p>
      </div>
    );
  }

  const views = [
    {
      id: 'receptionist',
      name: 'Receptionist Control',
      desc: 'Manage the queue, add patients, and share tracking links.',
      icon: <Users size={48} color="var(--primary-color)" />
    },
    {
      id: 'tv',
      name: 'Live TV Display',
      desc: 'The large waiting room screen showing real-time token status.',
      icon: <Monitor size={48} color="var(--primary-color)" />
    },
    {
      id: 'patient',
      name: 'Patient Mobile App',
      desc: 'The live tracking screen patients see on their phones.',
      icon: <Smartphone size={48} color="var(--primary-color)" />
    }
  ];

  return (
    <div className="flex-center h-screen" style={{ background: 'var(--bg-color)', flexDirection: 'column' }}>
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: '3rem' }}
      >
        <h1 style={{ fontSize: '3rem', color: 'var(--text-color)', marginBottom: '0.5rem' }}>{clinicData.name} Workspace</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Welcome to your demo environment. Open these 3 views in separate tabs to see how they sync together in real-time without refreshing.
        </p>
        <button onClick={() => navigate('/demo')} style={{ marginTop: '1.5rem', background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 'bold' }}>
          ← Back to Clinic Selection
        </button>
      </motion.div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {views.map((view, index) => (
          <motion.a
            key={view.id}
            href={`/demo/${clinic_id}/${view.id}`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -10, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="glass-card"
            style={{ 
              padding: '3rem 2rem', width: '300px', textAlign: 'center', 
              cursor: 'pointer', border: '2px solid transparent', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div style={{ position: 'absolute', top: '15px', right: '15px', color: 'var(--text-muted)' }}>
              <ExternalLink size={20} />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>{view.icon}</div>
            <h2 style={{ margin: 0, color: 'var(--text-color)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>{view.name}</h2>
            <p style={{ color: 'var(--text-muted)' }}>{view.desc}</p>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
