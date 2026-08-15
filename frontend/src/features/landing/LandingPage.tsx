import { motion, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Shield, HeartPulse, BrainCircuit, ChevronRight } from 'lucide-react';
import './LandingPage.css';

// Animation variants for scroll reveals
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } 
  }
};

const staggerContainer: Variants = {
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
        
        {/* Clinical Telemetry Preview Card */}
        <div className="hero-visual">
          <motion.div 
            className="hero-telemetry-card glass-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="telemetry-header">
              <div className="telemetry-badge">
                <span className="pulse-dot" />
                <span>Live Neuro-Monitoring</span>
              </div>
              <span className="telemetry-status">Optimal Stability</span>
            </div>

            {/* EEG Waveform Simulation */}
            <div className="telemetry-wave-box">
              <svg viewBox="0 0 400 80" className="telemetry-wave-svg" aria-label="EEG brainwave monitoring signal">
                <path
                  d="M 0 40 Q 20 20 40 40 T 80 40 T 120 15 T 140 65 T 160 30 T 180 45 T 220 40 T 260 25 T 280 55 T 300 40 T 340 40 T 380 35 L 400 40"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Clinical Telemetry Grid */}
            <div className="telemetry-stats-grid">
              <div className="telemetry-stat">
                <div className="stat-label">AED Adherence</div>
                <div className="stat-val text-gradient">100% Streak</div>
              </div>
              <div className="telemetry-stat">
                <div className="stat-label">AI Seizure Risk</div>
                <div className="stat-val" style={{ color: 'var(--color-success)' }}>Minimal (0.02)</div>
              </div>
              <div className="telemetry-stat">
                <div className="stat-label">Doctor Network</div>
                <div className="stat-val">Verified PMDC</div>
              </div>
              <div className="telemetry-stat">
                <div className="stat-label">Emergency SOS</div>
                <div className="stat-val" style={{ color: 'var(--color-primary)' }}>GPS Armed</div>
              </div>
            </div>
          </motion.div>
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

          {/* Card 3 - Interactive Telemetry Card */}
          <motion.div className="bento-card bento-card-telemetry glass-panel" variants={fadeInUp}>
            <div className="mini-chart-container">
              <div className="mini-chart-bars">
                <div className="mini-bar" style={{ height: '30%' }} />
                <div className="mini-bar" style={{ height: '20%' }} />
                <div className="mini-bar" style={{ height: '40%' }} />
                <div className="mini-bar active" style={{ height: '15%' }} />
                <div className="mini-bar" style={{ height: '25%' }} />
                <div className="mini-bar" style={{ height: '10%' }} />
                <div className="mini-bar" style={{ height: '5%' }} />
              </div>
              <div className="mini-chart-label">7-Day Real-Time Trend</div>
            </div>
            <div className="card-content-overlay">
              <h3>Real-time Tracking</h3>
              <p style={{ fontSize: 'var(--text-xs)', opacity: 0.9, margin: '4px 0 0' }}>
                Instant notifications, emergency dispatch, and daily dosing logs.
              </p>
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
