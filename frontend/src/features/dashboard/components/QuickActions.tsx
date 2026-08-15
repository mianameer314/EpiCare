import { useNavigate } from 'react-router-dom';
import { BrainCircuit, ClipboardPlus, MessageSquareText, ArrowRight } from 'lucide-react';
import './QuickActions.css';

/* ────────────────────────────────────────────────────
   Quick Actions — mini action cards for common tasks
   ──────────────────────────────────────────────────── */

const actions = [
  {
    to: '/eeg',
    icon: <BrainCircuit size={20} />,
    label: 'Upload EEG',
    description: 'Analyze a new recording',
    color: 'var(--color-secondary)',
    bg: 'var(--color-secondary-50)',
  },
  {
    to: '/lifestyle',
    icon: <ClipboardPlus size={20} />,
    label: 'Log Seizure',
    description: 'Record a seizure event',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
  },
  {
    to: '/chat',
    icon: <MessageSquareText size={20} />,
    label: 'AI Chat',
    description: 'Ask a health question',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-50)',
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="quick-actions">
      <div className="bento-header">
        <h3>Quick Actions</h3>
      </div>

      <div className="quick-actions-grid">
        {actions.map((action) => (
          <button
            key={action.to}
            className="quick-action-card"
            onClick={() => navigate(action.to)}
            aria-label={action.label}
          >
            <div
              className="quick-action-icon"
              style={{ background: action.bg, color: action.color }}
            >
              {action.icon}
            </div>
            <div className="quick-action-info">
              <span className="quick-action-label">{action.label}</span>
              <span className="quick-action-desc">{action.description}</span>
            </div>
            <ArrowRight size={16} className="quick-action-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
