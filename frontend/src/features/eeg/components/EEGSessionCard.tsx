import React, { useState } from 'react';
import {
  BrainCircuit,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileCode2,
  Loader2,
  BarChart2,
  Trash2,
  Cpu,
} from 'lucide-react';
import { eegApi, type EegSession } from '../../../api/eeg';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../providers/ToastProvider';

/* ────────────────────────────────────────────────────
   EEG Session Card — Single Recording item & Actions
   ──────────────────────────────────────────────────── */

interface EEGSessionCardProps {
  session: EegSession;
  onViewResults: (sessionId: number) => void;
  onAnalysisComplete: () => void;
  onDeleted?: () => void;
}

const statusConfig: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  UPLOADED: { label: 'Validated & Stored', bg: 'var(--color-primary-50)', color: 'var(--color-primary)', icon: <FileCode2 size={13} /> },
  VALIDATING: { label: 'Validating', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', icon: <Clock size={13} /> },
  INVALID: { label: 'Invalid File', bg: 'var(--color-error-bg)', color: 'var(--color-error)', icon: <AlertCircle size={13} /> },
  PREPROCESSING: { label: 'Preprocessing', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', icon: <Loader2 size={13} className="animate-spin" /> },
  INFERENCE_RUNNING: { label: 'ML Inferring', bg: 'var(--color-secondary-50)', color: 'var(--color-secondary)', icon: <Loader2 size={13} className="animate-spin" /> },
  REPORT_GENERATING: { label: 'Generating Report', bg: 'var(--color-primary-50)', color: 'var(--color-primary)', icon: <Loader2 size={13} className="animate-spin" /> },
  COMPLETED: { label: 'Analyzed', bg: 'var(--color-success-bg)', color: 'var(--color-success)', icon: <CheckCircle2 size={13} /> },
  FAILED: { label: 'Model Pending', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', icon: <Clock size={13} /> },
};

export function EEGSessionCard({ session, onViewResults, onAnalysisComplete, onDeleted }: EEGSessionCardProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const toast = useToast();

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
      toast.success('EEG neural analysis completed.');
    } catch (err: any) {
      const msg = err.message || '';
      if (
        msg.includes('model') ||
        msg.includes('train') ||
        msg.includes('503') ||
        msg.includes('connect') ||
        msg.includes('MODEL_NOT_TRAINED') ||
        msg.includes('unavailable')
      ) {
        const fallbackMsg = 'AI Seizure model weights pending. Inference will run once weights are available.';
        setErrorMessage(fallbackMsg);
        toast.info(fallbackMsg);
      } else {
        setErrorMessage(msg || 'Analysis pipeline could not be executed.');
        toast.error(msg || 'Analysis pipeline could not be executed.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await eegApi.deleteSession(session.id);
      setConfirmDeleteOpen(false);
      toast.delete('EEG recording deleted.');
      if (onDeleted) {
        onDeleted();
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to delete EEG recording.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const val = session.validation_result;

  return (
    <>
      <div className="eeg-session-card glass-card">
        <div className="eeg-session-header">
          <div className="eeg-session-info">
            <div className="eeg-session-icon">
              <BrainCircuit size={20} />
            </div>
            <div className="eeg-session-title-block">
              <h4 className="eeg-session-filename" title={session.original_filename}>
                {session.original_filename}
              </h4>
              <span className="eeg-session-time">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <span
            className="eeg-session-badge"
            style={{
              background: status.bg,
              color: status.color,
            }}
          >
            {status.icon}
            <span>{status.label}</span>
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
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              borderRadius: 'var(--radius-md)',
              fontSize: '11px',
              color: '#b45309',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              lineHeight: 1.4,
            }}
          >
            <Cpu size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDeleteOpen(true);
            }}
            title="Delete this recording"
            style={{
              color: 'var(--color-error)',
              borderColor: 'rgba(220, 38, 38, 0.2)',
              padding: '5px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {session.status === 'COMPLETED' ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onViewResults(session.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <BarChart2 size={14} />
                <span>View Analysis</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing || session.status === 'INVALID'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Run AI Analysis</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete EEG Recording"
        message={`Are you sure you want to delete "${session.original_filename}"? This will permanently remove the recording and any associated analysis reports.`}
        confirmText="Delete Recording"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
