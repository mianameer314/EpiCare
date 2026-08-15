import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import './RiskIndicator.css';

/* ────────────────────────────────────────────────────
   Risk Indicator — Glowing aura showing seizure threat
   Calculated from recent 30-day seizure events & logs
   ──────────────────────────────────────────────────── */

interface RiskIndicatorProps {
  seizures30d: number;
  daysSinceLastSeizure: number | null;
  isLoading: boolean;
}

type RiskLevel = 'low' | 'medium' | 'high';

function getRiskLevel(seizures30d: number): RiskLevel {
  if (seizures30d === 0) return 'low';
  if (seizures30d <= 2) return 'medium';
  return 'high';
}

const riskConfig = {
  low: {
    label: 'LOW RISK',
    description: 'No seizures recorded in the past 30 days. Brainwave baseline stable.',
    icon: <ShieldCheck size={28} />,
    glowClass: 'glow-risk-low',
  },
  medium: {
    label: 'MODERATE RISK',
    description: 'Recent seizure activity detected. Continue prescribed medication.',
    icon: <ShieldAlert size={28} />,
    glowClass: 'glow-risk-medium',
  },
  high: {
    label: 'ELEVATED RISK',
    description: 'Multiple recent events recorded. Consult your neurologist.',
    icon: <ShieldX size={28} />,
    glowClass: 'glow-risk-high',
  },
};

export function RiskIndicator({
  seizures30d,
  daysSinceLastSeizure,
  isLoading,
}: RiskIndicatorProps) {
  const risk = getRiskLevel(seizures30d);
  const config = riskConfig[risk];

  if (isLoading) {
    return (
      <div className="risk-indicator">
        <div className="bento-header">
          <h3>AI Risk Assessment</h3>
        </div>
        <div className="risk-loading">
          <div className="skeleton skeleton-circle" style={{ width: 64, height: 64 }} />
          <div className="skeleton skeleton-text" style={{ width: '60%', height: '1.2em' }} />
          <div className="skeleton skeleton-text" style={{ width: '80%', height: '0.9em' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="risk-indicator">
      <div className="bento-header">
        <h3>AI Risk Assessment</h3>
        <span className="glass-badge risk-stat">
          {daysSinceLastSeizure !== null
            ? `${daysSinceLastSeizure} days seizure-free`
            : '30+ days clear'}
        </span>
      </div>

      <div className="risk-body">
        <motion.div
          className={`risk-aura ${config.glowClass}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className={`risk-icon risk-${risk}`}>
            {config.icon}
          </div>
        </motion.div>

        <div className="risk-info">
          <motion.span
            className={`risk-label risk-${risk}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {config.label}
          </motion.span>
          <p className="risk-description">{config.description}</p>
          <span className="risk-confidence glass-badge">
            {seizures30d === 0 ? 'Optimal Stability' : `${seizures30d} events / 30d`}
          </span>
        </div>
      </div>
    </div>
  );
}
