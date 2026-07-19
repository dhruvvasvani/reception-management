import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Activity, Clock, Users, Zap, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';

export default function LandingPage() {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const yHero = useTransform(scrollYProgress, [0, 1], [0, 300]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const features = [
    {
      icon: <Smartphone size={40} className="feature-icon" />,
      title: "Mobile Real-time Queue",
      description: "Patients can watch the queue update instantly on their own phones via Socket.io."
    },
    {
      icon: <Activity size={40} className="feature-icon" />,
      title: "Zero Duplicate Joins",
      description: "Robust architecture prevents duplicate entries, reconnects gracefully, and handles stale state."
    },
    {
      icon: <ShieldCheck size={40} className="feature-icon" />,
      title: "Secure Multi-tenant Data",
      description: "Each clinic gets isolated data environments, secured by bcrypt and strict socket rooms."
    }
  ];

  const steps = [
    {
      step: "01",
      title: "Register your Clinic",
      description: "Sign up in seconds and get an exclusive dashboard to manage your incoming patients."
    },
    {
      step: "02",
      title: "Add Patients",
      description: "Receptionists add patients to the queue. The system automatically assigns a secure, real-time token."
    },
    {
      step: "03",
      title: "Patients Monitor Live",
      description: "Patients scan a QR code and track their exact wait time on a beautifully designed mobile view."
    }
  ];

  return (
    <div className="landing-container">
      {/* Navbar */}
      <Header />

      {/* Hero Section */}
      <section className="hero-section">
        <motion.div 
          className="hero-content"
          style={{ y: yHero, opacity: opacityHero }}
        >
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="badge">Next Generation Queue Management</div>
            <h1 className="hero-title">
              Cure the <span className="text-gradient">Waiting Room</span>
            </h1>
            <p className="hero-subtitle">
              Replace physical waiting lines with an intelligent, real-time queue. Let patients watch updates on their own phones while you manage everything effortlessly.
            </p>
            <div className="hero-buttons">
              <motion.button 
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(99, 102, 241, 0.5)" }}
                whileTap={{ scale: 0.95 }}
                className="primary-gradient-btn large-btn"
                onClick={() => navigate('/auth')}
              >
                Start Your Free Clinic <ArrowRight size={20} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>


      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header">
          <h2 className="section-title">Built for Performance</h2>
          <p className="section-subtitle">Handling the unglamorous parts of real-time syncing so you don't have to.</p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="feature-card glass-card"
            >
              <div className="icon-wrapper">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it Works Section */}
      <section className="steps-section">
        <div className="section-header">
          <h2 className="section-title">How it Works</h2>
        </div>
        
        <div className="steps-container">
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className={`step-row ${i % 2 !== 0 ? 'reverse' : ''}`}
            >
              <div className="step-number">{step.step}</div>
              <div className="step-content glass-card">
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="cta-card"
        >
          <h2>Ready to upgrade your clinic?</h2>
          <p>Join Queue Cure '26 today and provide a premium waiting experience for your patients.</p>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="primary-gradient-btn large-btn"
            onClick={() => navigate('/auth')}
          >
            Create Account Now
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
