import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from './components/LoginForm';
import { SignupForm } from './components/SignupForm';
import { Button } from '../../components/ui/Button';
import { BrandLogo } from '../../components/shared/BrandLogo';
import { AuthSignalWave } from './components/AuthSignalWave';
import './AuthPage.css';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const [isLogin, setIsLogin] = useState(() => mode !== 'register' && mode !== 'signup');

  useEffect(() => {
    if (mode === 'register' || mode === 'signup') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }
  }, [mode]);

  // Accessible switching
  const handleToggle = () => setIsLogin(!isLogin);

  return (
    <main className="auth-page-bg">
      <div className="auth-split-card">

        {/* Background Forms Layer */}
        <div className="auth-forms-layer">
          {/* Sign Up Form (Left Side) */}
          <div className="auth-form-half auth-signup-side">
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, x: -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, delay: 0.15 }}
                  className="auth-form-content"
                >
                  <SignupForm onToggleMode={handleToggle} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Login Form (Right Side) */}
          <div className="auth-form-half auth-login-side">
            <AnimatePresence>
              {isLogin && (
                <motion.div
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, delay: 0.15 }}
                  className="auth-form-content"
                >
                  <LoginForm onToggleMode={handleToggle} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sliding Parabolic Overlay Panel (Foreground) */}
        <motion.div
          className="auth-overlay-panel"
          initial={false}
          animate={{
            x: isLogin ? '0%' : '100%',
            borderTopRightRadius: isLogin ? '140px' : '0px',
            borderBottomRightRadius: isLogin ? '140px' : '0px',
            borderTopLeftRadius: isLogin ? '0px' : '140px',
            borderBottomLeftRadius: isLogin ? '0px' : '140px',
          }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
        >
          {/* Alive Kinetic Waveform Canvas Background */}
          <AuthSignalWave isLogin={isLogin} />

          <div className="auth-overlay-content">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div
                  key="login-prompt"
                  className="overlay-text"
                  initial={{ opacity: 0, scale: 0.94, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className="overlay-brand-badge">
                    <BrandLogo size="lg" variant="light" to="/" subtitle="AI Epilepsy Platform" />
                  </div>
                  <h2>New to EpiCare?</h2>
                  <p>AI-assisted epilepsy detection, seizure tracking, and personalized clinical insights — all in one platform.</p>
                  <Button variant="outline" className="overlay-btn" onClick={handleToggle}>
                    Create Account
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="signup-prompt"
                  className="overlay-text"
                  initial={{ opacity: 0, scale: 0.94, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -8 }}
                  transition={{ duration: 0.28 }}
                >
                  <div className="overlay-brand-badge">
                    <BrandLogo size="lg" variant="light" to="/" subtitle="AI Epilepsy Platform" />
                  </div>
                  <h2>Welcome Back!</h2>
                  <p>Your EEG analyses, medication routines, and personalized care insights are waiting for you.</p>
                  <Button variant="outline" className="overlay-btn" onClick={handleToggle}>
                    Sign In to Portal
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

      </div>
    </main>
  );
}
