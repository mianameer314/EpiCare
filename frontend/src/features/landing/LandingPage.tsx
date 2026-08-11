import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Shield, HeartPulse, BrainCircuit, ChevronRight } from 'lucide-react';
import './LandingPage.css';

// Animation variants for scroll reveals
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

export function LandingPage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <header className="landing-nav glass-panel">
        <div className="nav-container">
          <div className="nav-logo">
            <HeartPulse className="nav-logo-icon" aria-hidden="true" />
            <span>EpiCare</span>
          </div>
          <nav aria-label="Main Navigation">
            <Link to="/auth" className="nav-link">Sign In</Link>
            <Link to="/auth" tabIndex={-1}>
              <Button variant="primary" size="sm">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <motion.div 
            initial="hidden" 
            animate="visible" 
            variants={staggerContainer}
          >
            <motion.h1 variants={fadeInUp} className="hero-title">
              Your Health, <br/>
              <span className="text-gradient">Our Priority</span>
            </motion.h1>
            <motion.p variants={fadeInUp} className="hero-subtitle">
              Compassionate, data-driven epilepsy care for you and your family. 
              Monitor EEG sessions, connect with doctors, and manage your health journey.
            </motion.p>
            <motion.div variants={fadeInUp} className="hero-actions">
              <Link to="/auth" tabIndex={-1}>
                <Button size="lg" variant="primary">
                  Start Your Journey <ChevronRight size={18} style={{ marginLeft: 8 }} />
                </Button>
              </Link>
              <Link to="#features" tabIndex={-1}>
                <Button size="lg" variant="outline">Learn More</Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Placeholder for Medical Hero Image/3D Object */}
        <div className="hero-visual">
          <div className="media-placeholder" aria-label="Illustration of a doctor and patient interacting warmly">
            <p className="placeholder-text">
              [PLACEHOLDER: hero_medical.jpg]<br/>
              Source: High-quality photo of doctor & patient.<br/>
              Folder: <code>public/images/</code>
            </p>
          </div>
        </div>
      </section>

      {/* Features Section (Bento Grid) */}
      <section id="features" className="features-section">
        <motion.div 
          className="section-header"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
        >
          <h2>Advanced Care Services</h2>
          <p>Everything you need to manage epilepsy in one unified platform.</p>
        </motion.div>

        <motion.div 
          className="bento-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
        >
          {/* Card 1 */}
          <motion.div className="bento-card glass-panel" variants={fadeInUp}>
            <div className="card-icon-wrapper">
              <BrainCircuit className="card-icon" />
            </div>
            <h3>EEG Analysis</h3>
            <p>Upload and analyze EEG sessions with advanced ML models for accurate seizure prediction.</p>
          </motion.div>

          {/* Card 2 */}
          <motion.div className="bento-card glass-panel" variants={fadeInUp}>
            <div className="card-icon-wrapper">
              <Shield className="card-icon" />
            </div>
            <h3>Secure Records</h3>
            <p>Your medical data is encrypted and securely shared only with authorized caretakers.</p>
          </motion.div>

          {/* Card 3 - Image Card */}
          <motion.div className="bento-card bento-card-image glass-panel" variants={fadeInUp}>
            <div className="media-placeholder" aria-label="Dashboard preview showing EEG graphs">
              <p className="placeholder-text">
                [PLACEHOLDER: dashboard_preview.png]<br/>
                Folder: <code>public/images/</code>
              </p>
            </div>
            <div className="card-content-overlay">
              <h3>Real-time Tracking</h3>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Mission / About Section */}
      <section className="mission-section">
        <motion.div 
          className="mission-content glass-panel"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
        >
          <h2>Brought to Your Home</h2>
          <p>
            EpiCare is designed to bridge the gap between clinical excellence and daily life. 
            We believe that proactive monitoring and seamless doctor-patient connections lead to better outcomes and peace of mind.
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="nav-logo">
            <HeartPulse className="nav-logo-icon" />
            <span>EpiCare</span>
          </div>
          <p>&copy; 2026 EpiCare Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
