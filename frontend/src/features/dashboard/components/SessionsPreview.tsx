import { useNavigate } from 'react-router-dom';
import { BrainCircuit, ChevronRight, FileUp, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { EegSession } from '../../../api/dashboard';
import './SessionsPreview.css';

/* ────────────────────────────────────────────────────
   Sessions Preview — Recent EEG sessions card (2×2)
   ──────────────────────────────────────────────────── */

interface SessionsPreviewProps {
  sessions: EegSession[];
  totalSessions: number;
  isLoading: boolean;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  UPLOADED: { icon: <FileUp size={14} />, label: 'Uploaded', className: 'status-uploaded' },
  PROCESSING: { icon: <Clock size={14} />, label: 'Processing', className: 'status-processing' },
  COMPLETED: { icon: <CheckCircle2 size={14} />, label: 'Completed', className: 'status-completed' },
  FAILED: { icon: <AlertCircle size={14} />, label: 'Failed', className: 'status-failed' },
};

export function SessionsPreview({ sessions, totalSessions, isLoading }: SessionsPreviewProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="sessions-preview">
        <div className="bento-header">
          <h3>EEG Sessions</h3>
        </div>
        <div className="sessions-list">
          {[1, 2, 3].map(i => (
            <div key={i} className="session-skeleton">
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton skeleton-text" style={{ width: '70%' }} />
                <div className="skeleton skeleton-text" style={{ width: '40%', height: '0.7em' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sessions-preview">
      <div className="bento-header">
        <h3>EEG Sessions</h3>
        <span className="glass-badge">{totalSessions} total</span>
      </div>

      {sessions.length === 0 ? (
        <div className="sessions-empty">
          <BrainCircuit size={40} style={{ opacity: 0.3, color: 'var(--color-text-muted)' }} />
          <p>No EEG sessions yet.</p>
          <button
            className="sessions-empty-action"
            onClick={() => navigate('/eeg')}
          >
            <FileUp size={16} />
            Upload your first EEG
          </button>
        </div>
      ) : (
        <>
          <div className="sessions-list">
            {sessions.map(session => {
              const config = statusConfig[session.status] || statusConfig.UPLOADED;
              const date = new Date(session.created_at);

              return (
                <div key={session.id} className="session-row">
                  <div className="session-icon-wrap">
                    <BrainCircuit size={18} />
                  </div>
                  <div className="session-info">
                    <span className="session-name">{session.original_filename}</span>
                    <span className="session-date">
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}
                      {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`session-status ${config.className}`}>
                    {config.icon}
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>

          {totalSessions > 5 && (
            <div className="bento-footer">
              <button className="sessions-view-all" onClick={() => navigate('/eeg')}>
                View all sessions <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
