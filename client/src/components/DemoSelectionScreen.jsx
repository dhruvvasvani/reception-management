import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function DemoSelectionScreen() {
  const navigate = useNavigate();

  const clinics = [
    { id: 1, name: "Demo Clinic 1", desc: "General Practice" },
    { id: 2, name: "Demo Clinic 2", desc: "Specialist Care" },
    { id: 3, name: "Demo Clinic 3", desc: "Urgent Care" },
  ];

  return (
    <div className="flex-center h-screen" style={{ background: 'var(--bg-color)', flexDirection: 'column' }}>
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: '3rem' }}
      >
        <h1 style={{ fontSize: '3rem', color: 'var(--text-color)' }}>Select a Demo Clinic</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Experience Queue Cure '26 from different clinic perspectives.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 'bold' }}>
          ← Back to Home
        </button>
      </motion.div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {clinics.map((clinic, index) => (
          <motion.div
            key={clinic.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -10, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/demo/${clinic.id}`)}
            className="glass-card"
            style={{ 
              padding: '3rem 2rem', width: '280px', textAlign: 'center', 
              cursor: 'pointer', border: '2px solid transparent'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏥</div>
            <h2 style={{ margin: 0, color: 'var(--text-color)' }}>{clinic.name}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{clinic.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
