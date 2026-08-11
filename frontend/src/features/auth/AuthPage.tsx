import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoginForm } from './components/LoginForm';
import { SignupForm } from './components/SignupForm';
import { Button } from '../../components/ui/Button';
import './AuthPage.css';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  // Accessible switching
  const handleToggle = () => setIsLogin(!isLogin);

  return (
    <main className="auth-page-bg">
      <div className="auth-split-card glass-panel">
        
        {/* Background Forms Layer */}
        <div className="auth-forms-layer">
          {/* Sign Up Form (Left Side) */}
          <div className="auth-form-half auth-signup-side">
            <AnimatePresence>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="auth-form-content"
                >
                  <SignupForm />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Login Form (Right Side) */}
          <div className="auth-form-half auth-login-side">
            <AnimatePresence>
              {isLogin && (
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="auth-form-content"
                >
                  <LoginForm />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sliding Overlay Panel (Foreground) */}
        <motion.div 
          className="auth-overlay-panel"
          initial={false}
          animate={{
            x: isLogin ? '0%' : '100%',
            borderTopRightRadius: isLogin ? '250px' : '0px',
            borderBottomRightRadius: isLogin ? '250px' : '0px',
            borderTopLeftRadius: isLogin ? '0px' : '250px',
            borderBottomLeftRadius: isLogin ? '0px' : '250px',
          }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          {/* High Quality Video Background */}
          <video 
            className="auth-overlay-video"
            autoPlay 
            muted 
            loop 
            playsInline
            aria-hidden="true"
          >
            <source src="/first.mp4" type="video/mp4" />
          </video>
          
          <div className="auth-overlay-content">
            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div 
                  key="login-prompt"
                  className="overlay-text"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2>New to EpiCare?</h2>
                  <p>Join us and take control of your health journey with advanced, compassionate care.</p>
                  <Button variant="outline" className="overlay-btn" onClick={handleToggle}>
                    Sign Up Now
                  </Button>
                </motion.div>
              ) : (
                <motion.div 
                  key="signup-prompt"
                  className="overlay-text"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2>Welcome Back!</h2>
                  <p>To keep connected with us, please login with your personal information.</p>
                  <Button variant="outline" className="overlay-btn" onClick={handleToggle}>
                    Sign In
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
