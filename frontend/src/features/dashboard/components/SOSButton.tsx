import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, Phone, X, Check, Loader2 } from 'lucide-react';
import { emergencyApi } from '../../../api/emergency';
import './SOSButton.css';

/* ────────────────────────────────────────────────────
   SOS Button — High-visibility emergency trigger
   with confirmation dialog and backend wiring.
   ──────────────────────────────────────────────────── */

type SOSState = 'idle' | 'confirming' | 'loading' | 'success' | 'error';

export function SOSButton() {
  const [state, setState] = useState<SOSState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleTrigger = () => {
    setState('confirming');
  };

  const handleConfirm = async () => {
    setState('loading');
    setErrorMessage('');

    try {
      await emergencyApi.triggerSOS();
      setState('success');
      setTimeout(() => setState('idle'), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send SOS. Try calling emergency services directly.');
      setState('error');
      setTimeout(() => setState('idle'), 4000);
    }
  };

  const handleCancel = () => {
    setState('idle');
    setErrorMessage('');
  };

  return (
    <div className="sos-container" role="region" aria-label="Emergency SOS">
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.button
            key="idle"
            className="sos-btn"
            onClick={handleTrigger}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Trigger emergency SOS alert"
          >
            <Siren size={28} />
            <span className="sos-label">SOS</span>
            <span className="sos-sublabel">Emergency Alert</span>
          </motion.button>
        )}

        {state === 'confirming' && (
          <motion.div
            key="confirm"
            className="sos-confirm"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <p className="sos-confirm-text">Send SOS alert to your emergency contacts?</p>
            <div className="sos-confirm-actions">
              <button className="sos-confirm-yes" onClick={handleConfirm} aria-label="Confirm SOS">
                <Phone size={18} />
                Send SOS
              </button>
              <button className="sos-confirm-no" onClick={handleCancel} aria-label="Cancel SOS">
                <X size={18} />
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {state === 'loading' && (
          <motion.div
            key="loading"
            className="sos-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-error)' }} />
            <span style={{ color: 'var(--color-text-main)', fontWeight: 600 }}>Sending alerts...</span>
          </motion.div>
        )}

        {state === 'success' && (
          <motion.div
            key="success"
            className="sos-state"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div style={{
              width: 48, height: 48,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-success-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-success)',
            }}>
              <Check size={24} />
            </div>
            <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 'var(--text-sm)', textAlign: 'center' }}>
              SOS sent to all contacts
            </span>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            className="sos-state"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: 'var(--text-sm)', textAlign: 'center' }}>
              {errorMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
