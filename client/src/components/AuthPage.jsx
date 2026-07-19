import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Phone, Lock, ArrowRight, Activity, ArrowLeft } from 'lucide-react';

export default function AuthPage({ setAuthToken, setClinicData }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    clinic_name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/login' : '/api/register';
    const baseUrl = import.meta.env.PROD ? 'https://reception-management.onrender.com' : 'http://localhost:3001';

    try {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      localStorage.setItem('queue_token', data.token);
      setAuthToken(data.token);
      setClinicData({ id: data.clinic_id, name: data.clinic_name });
      navigate('/dashboard');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <button className="back-button" onClick={() => navigate('/')}>
        <ArrowLeft size={20} /> Back to Home
      </button>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="auth-card glass-card"
      >
        <div className="auth-header">
          <Activity size={40} className="auth-icon accent-glow" />
          <h2 className="auth-title">{isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
          <p className="auth-subtitle">
            {isLogin ? 'Enter your details to access your dashboard' : 'Join Queue Cure \'26 and streamline your clinic'}
          </p>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="auth-error">
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="input-group">
              <Building2 className="input-icon" size={20} />
              <input 
                type="text" 
                placeholder="Hospital/Clinic Name"
                required
                value={formData.clinic_name}
                onChange={e => setFormData({...formData, clinic_name: e.target.value})}
              />
            </div>
          )}

          <div className="input-group">
            <Mail className="input-icon" size={20} />
            <input 
              type="email" 
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <Phone className="input-icon" size={20} />
              <input 
                type="tel" 
                placeholder="Phone Number"
                required
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          )}

          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input 
              type="password" 
              placeholder="Password"
              required
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="auth-submit-btn primary-gradient-btn"
            disabled={loading}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Register Clinic')}
            {!loading && <ArrowRight size={18} />}
          </motion.button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              type="button" 
              className="toggle-auth-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
