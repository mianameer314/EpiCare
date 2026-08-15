import { useState } from 'react';
import { BrainCircuit, Play, CheckCircle2, AlertCircle, Clock, FileCode2, Loader2, BarChart2 } from 'lucide-react';
import { eegApi, type EegSession } from '../../../api/eeg';

/* ────────────────────────────────────────────────────
   EEG Session Card — Single Recording item & Actions
   ──────────────────────────────────────────────────── */

interface EEGSessionCardProps {
  session: EegSession;
  onViewResults: (sessionId: number) => void;
  onAnalysisComplete: () => void;
}

const statusConfig: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  UPLOADED: { label: 'Uploaded', bg: 'var(--color-info-bg)', color: 'var(--color-info)', icon: <FileCode2 size={13} /> },
  VALIDATING: { label: 'Validating', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', icon: <Clock size={13} /> },
  INVALID: { label: 'Invalid File', bg: 'var(--color-error-bg)', color: 'var(--color-error)', icon: <AlertCircle size={13} /> },
  PREPROCESSING: { label: 'Preprocessing', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', icon: <Loader2 size={13} className="animate-spin" /> },
  INFERENCE_RUNNING: { label: 'ML Inferring', bg: 'var(--color-secondary-50)', color: 'var(--color-secondary)', icon: <Loader2 size={13} className="animate-spin" /> },
  REPORT_GENERATING: { label: 'Generating Report', bg: 'var(--color-primary-50)', color: 'var(--color-primary)', icon: <Loader2 size={13} className="animate-spin" /> },
  COMPLETED: { label: 'Analyzed', bg: 'var(--color-success-bg)', color: 'var(--color-success)', icon: <CheckCircle2 size={13} /> },
  FAILED: { label: 'Failed', bg: 'var(--color-error-bg)', color: 'var(--color-error)', icon: <AlertCircle size={13} /> },
};

export function EEGSessionCard({ session, onViewResults, onAnalysisComplete }: EEGSessionCardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const status = statusConfig[session.status] || statusConfig.UPLOADED;
  const date = new Date(session.created_at);

  const handleRunAnalysis = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnalyzing(true);
    setErrorMessage('');
    try {
      await eegApi.analyzeSession(session.id);
      onAnalysisComplete();
      onViewResults(session.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Analysis pipeline failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const val = session.validation_result;

  return (
    <div
      className="glass-card"
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        transition: 'all var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-secondary-50)',
            color: 'var(--color-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BrainCircuit size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0, color: 'var(--color-text-main)' }}>
              {session.original_filename}
            </h4>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {' · '}
              {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <span
          style={{
            background: status.bg,
            color: status.color,
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            whiteSpace: 'nowrap',
          }}
        >
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* ── Technical Metadata tags ── */}
      {val && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {val.duration_seconds !== null && (
            <span className="glass-badge" style={{ fontSize: 'var(--text-xs)' }}>
              ⏱️ {val.duration_seconds.toFixed(0)}s duration
            </span>
          )}
          {val.sampling_rate !== null && (
            <span className="glass-badge" style={{ fontSize: 'var(--text-xs)' }}>
              ⚡ {val.sampling_rate} Hz
            </span>
          )}
          {val.channels_found !== null && (
            <span className="glass-badge" style={{ fontSize: 'var(--text-xs)' }}>
              🧠 {val.channels_found} channels
            </span>
          )}
        </div>
      )}

      {errorMessage && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)' }}>
          {errorMessage}
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
        {session.status === 'COMPLETED' ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onViewResults(session.id)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            <BarChart2 size={14} />
            View Analysis
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || session.status === 'INVALID'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play size={14} />
                Run AI Analysis
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
