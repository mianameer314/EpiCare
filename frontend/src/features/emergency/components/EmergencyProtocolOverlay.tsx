import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, Phone, ShieldCheck, MapPin, X, Activity } from 'lucide-react';
import type { EmergencyContact } from '../../../api/emergency';
import './EmergencyProtocolOverlay.css';

/* ────────────────────────────────────────────────────
   Kinetic Typography Full-Screen Emergency Protocol
   Activated during acute seizure emergencies
   ──────────────────────────────────────────────────── */

interface EmergencyProtocolOverlayProps {
  contacts: EmergencyContact[];
  eventId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  onDeactivate: () => void;
}

const firstAidSteps = [
  {
    step: '01',
    title: 'CLEAR THE IMMEDIATE AREA',
    desc: 'Move sharp objects, hard furniture, and hazardous items away from the person.',
  },
  {
    step: '02',
    title: 'CUSHION THE HEAD',
    desc: 'Place a soft jacket, pillow, or folded cloth gently under their head to prevent injury.',
  },
  {
    step: '03',
    title: 'TURN ONTO SIDE (RECOVERY POSITION)',
    desc: 'Roll the person gently onto their side to keep the airway clear and prevent choking.',
  },
  {
    step: '04',
    title: 'TIME THE SEIZURE DURATION',
    desc: 'If the seizure lasts longer than 5 minutes or repeats, call an ambulance immediately.',
  },
  {
    step: '05',
    title: 'DO NOT RESTRAIN OR INSERT OBJECTS',
    desc: 'Never hold the person down and NEVER force anything into their mouth or between teeth.',
  },
  {
    step: '06',
    title: 'STAY CALM & REASSURE',
    desc: 'Stay with the person until the seizure ends and consciousness is fully regained.',
  },
];

export function EmergencyProtocolOverlay({
  contacts,
  eventId,
  latitude,
  longitude,
  onDeactivate,
}: EmergencyProtocolOverlayProps) {
  const [secondsActive, setSecondsActive] = useState(0);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsActive(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <motion.div
      className="emergency-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alertdialog"
      aria-modal="true"
      aria-label="Emergency SOS Protocol Active"
    >
      <div className="emergency-overlay-container">
        {/* ── Top Bar / HUD ── */}
        <header className="emergency-hud-bar">
          <div className="emergency-status-badge">
            <span className="emergency-pulse-dot" />
            <Siren size={18} />
            <span>SOS ALERT BROADCASTING {eventId ? `(#${eventId})` : ''}</span>
          </div>

          <div className="emergency-timer-box">
            <Activity size={16} />
            <span>ELAPSED: <strong>{formatTimer(secondsActive)}</strong></span>
          </div>

          <button
            className="emergency-dismiss-btn"
            onClick={() => setShowConfirmClose(true)}
            aria-label="Deactivate emergency protocol"
          >
            <X size={18} />
            <span>End Emergency</span>
          </button>
        </header>

        {/* ── Main Kinetic Typography Headline ── */}
        <section className="emergency-hero">
          <motion.div
            className="kinetic-subheading"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            SEIZURE ASSISTANCE IN PROGRESS
          </motion.div>

          <motion.h1
            className="kinetic-heading"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            HELP PROTOCOL ACTIVE
          </motion.h1>

          {/* Location details */}
          {latitude && longitude ? (
            <motion.div
              className="emergency-gps-chip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <MapPin size={16} />
              <span>GPS Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)} (Sent to contacts)</span>
            </motion.div>
          ) : (
            <div className="emergency-gps-chip">
              <MapPin size={16} />
              <span>Location alert sent to emergency contacts</span>
            </div>
          )}
        </section>

        {/* ── Quick Call Contacts Row ── */}
        {contacts.length > 0 && (
          <section className="emergency-contacts-strip">
            <h3 className="strip-title">TAP TO CALL EMERGENCY CONTACTS</h3>
            <div className="contacts-action-grid">
              {contacts.map((c) => (
                <a
                  key={c.id}
                  href={`tel:${c.phone_number}`}
                  className="emergency-call-card"
                  aria-label={`Call ${c.name} (${c.relationship})`}
                >
                  <div className="call-icon-wrap">
                    <Phone size={20} />
                  </div>
                  <div className="call-card-info">
                    <div className="call-card-name">
                      {c.name} {c.is_primary && '★'}
                    </div>
                    <div className="call-card-rel">{c.relationship} · {c.phone_number}</div>
                  </div>
                  <span className="call-action-label">Call Now</span>
                </a>
              ))}

              <a
                href="tel:1122"
                className="emergency-call-card ambulance-card"
                aria-label="Call Emergency Services Ambulance 1122"
              >
                <div className="call-icon-wrap ambulance-icon">
                  <Siren size={20} />
                </div>
                <div className="call-card-info">
                  <div className="call-card-name">Emergency Services</div>
                  <div className="call-card-rel">Rescue 1122 / 911 Ambulance</div>
                </div>
                <span className="call-action-label">Emergency Call</span>
              </a>
            </div>
          </section>
        )}

        {/* ── Staggered Seizure First-Aid Steps ── */}
        <section className="emergency-steps-section">
          <h2 className="steps-main-title">CRITICAL FIRST AID INSTRUCTIONS</h2>
          <div className="emergency-steps-grid">
            {firstAidSteps.map((item, idx) => (
              <motion.div
                key={item.step}
                className="emergency-step-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx, duration: 0.4 }}
              >
                <div className="step-number">{item.step}</div>
                <div className="step-content">
                  <h4 className="step-title">{item.title}</h4>
                  <p className="step-desc">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Confirmation Modal to End SOS ── */}
      <AnimatePresence>
        {showConfirmClose && (
          <div className="emergency-confirm-backdrop">
            <motion.div
              className="emergency-confirm-modal glass-card"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <ShieldCheck size={40} style={{ color: 'var(--color-success)', margin: '0 auto var(--space-3)' }} />
              <h3>End Emergency Protocol?</h3>
              <p>Confirm that the patient is safe and consciousness has been fully regained.</p>
              <div className="confirm-modal-actions">
                <button
                  className="btn btn-primary btn-md"
                  onClick={onDeactivate}
                  style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                >
                  Yes, Patient is Safe
                </button>
                <button
                  className="btn btn-outline btn-md"
                  onClick={() => setShowConfirmClose(false)}
                >
                  Keep Protocol Active
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
