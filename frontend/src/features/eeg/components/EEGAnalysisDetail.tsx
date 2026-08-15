import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ShieldCheck, ShieldAlert, X, Activity, BrainCircuit, Clock, Image as ImageIcon, AlertTriangle, Layers } from 'lucide-react';
import { eegApi } from '../../../api/eeg';

/* ────────────────────────────────────────────────────
   EEG Analysis Detail — Full Seizure Diagnosis Report
   ──────────────────────────────────────────────────── */

interface EEGAnalysisDetailProps {
  sessionId: number;
  onClose: () => void;
}

export function EEGAnalysisDetail({ sessionId, onClose }: EEGAnalysisDetailProps) {
  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['eeg', 'session', sessionId],
    queryFn: () => eegApi.getSession(sessionId),
  });

  const { data: predictionData, isLoading: predictionLoading } = useQuery({
    queryKey: ['eeg', 'predictions', sessionId],
    queryFn: () => eegApi.getSessionPredictions(sessionId),
  });

  const prediction = predictionData?.items?.[0];
  const spectrogramUrl = eegApi.getSpectrogramUrl(sessionId);

  const isSeizure = prediction?.predicted_class?.toLowerCase().includes('seizure') && !prediction?.predicted_class?.toLowerCase().includes('non');
  const confidencePercent = prediction ? (prediction.confidence * 100).toFixed(1) : '0.0';

  // Format window probabilities for Recharts AreaChart
  const windowChartData = prediction?.window_probabilities?.map((prob, idx) => ({
    window: `W${idx + 1}`,
    index: idx + 1,
    probability: Number((prob * 100).toFixed(1)),
    threshold: Number((prediction.threshold * 100).toFixed(1)),
  })) || [];

  const isLoading = sessionLoading || predictionLoading;

  return (
    <div className="glass-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', zIndex: 1000 }}>
      <motion.div
        className="glass-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        style={{
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-2xl)',
          position: 'relative',
        }}
      >
        {/* ── Modal Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-lg)',
              background: isSeizure ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
              color: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isSeizure ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
            </div>
            <div>
              <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', margin: 0, color: 'var(--color-text-main)' }}>
                EEG Analysis Report
              </h2>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Session #{sessionId} · {sessionData?.original_filename || 'Recording'}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2)',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12)', gap: 'var(--space-3)' }}>
            <div className="skeleton skeleton-circle" style={{ width: 64, height: 64 }} />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        ) : !prediction ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <AlertTriangle size={40} style={{ color: 'var(--color-warning)', margin: '0 auto var(--space-3)' }} />
            <h3>No Prediction Available</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              This session has not yet been processed by the ML inference pipeline.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            {/* ── Diagnosis Banner ── */}
            <div
              style={{
                padding: 'var(--space-4) var(--space-6)',
                borderRadius: 'var(--radius-xl)',
                background: isSeizure ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                border: `1px solid ${isSeizure ? 'rgba(207, 34, 46, 0.2)' : 'rgba(26, 127, 55, 0.2)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 'var(--space-4)',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isSeizure ? 'var(--color-error)' : 'var(--color-success)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  AI Model Classification
                </div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', color: isSeizure ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {prediction.predicted_class}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Model: {prediction.model_version || 'CNN-LSTM-v1'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Confidence Score</div>
                <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                  {confidencePercent}%
                </div>
              </div>
            </div>

            {/* ── Key Metrics Grid ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
              <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  <Layers size={14} /> Positive Windows
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                  {prediction.positive_windows} / {prediction.total_windows}
                </div>
              </div>

              <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  <Activity size={14} /> Peak Probability
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                  {(prediction.max_probability * 100).toFixed(1)}%
                </div>
              </div>

              <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  <BrainCircuit size={14} /> Decision Threshold
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                  {(prediction.threshold * 100).toFixed(0)}%
                </div>
              </div>

              <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  <Clock size={14} /> Mean Probability
                </div>
                <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                  {(prediction.mean_probability * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* ── Time-Window Seizure Probability Timeline ── */}
            {windowChartData.length > 0 && (
              <div className="glass-card" style={{ padding: 'var(--space-4)' }}>
                <div className="bento-header" style={{ marginBottom: 'var(--space-3)' }}>
                  <h4>Temporal Window Probabilities</h4>
                  <span className="glass-badge">{windowChartData.length} Segmented Windows</span>
                </div>
                <div style={{ height: 180, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={windowChartData}>
                      <defs>
                        <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isSeizure ? 'var(--color-error)' : 'var(--color-primary)'} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={isSeizure ? 'var(--color-error)' : 'var(--color-primary)'} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="index" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={30} unit="%" />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-lg)',
                          fontSize: 'var(--text-xs)',
                        }}
                        formatter={(val: any) => [`${val}%`, 'Seizure Probability']}
                      />
                      <ReferenceLine y={Number((prediction.threshold * 100).toFixed(0))} stroke="var(--color-warning)" strokeDasharray="3 3" label={{ value: 'Threshold', fill: 'var(--color-warning)', fontSize: 10, position: 'insideTopRight' }} />
                      <Area type="monotone" dataKey="probability" stroke={isSeizure ? 'var(--color-error)' : 'var(--color-primary)'} strokeWidth={2} fillOpacity={1} fill="url(#probGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Spectrogram Image Viewer ── */}
            <div className="glass-card" style={{ padding: 'var(--space-4)' }}>
              <div className="bento-header" style={{ marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <ImageIcon size={18} style={{ color: 'var(--color-secondary)' }} />
                  <h4>Short-Time Fourier Transform (STFT) Spectrogram</h4>
                </div>
              </div>
              <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-background-secondary)', textAlign: 'center', padding: 'var(--space-2)' }}>
                <img
                  src={spectrogramUrl}
                  alt={`EEG Spectrogram for Session ${sessionId}`}
                  style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 'var(--radius-md)', objectFit: 'contain' }}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent) {
                      parent.innerHTML = '<div style="padding: 24px; color: var(--color-text-muted); font-size: 0.85rem;">Spectrogram visualization generated on server storage.</div>';
                    }
                  }}
                />
              </div>
            </div>

            {/* ── Medical Disclaimer ── */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning-glow)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <strong>Clinical Notice:</strong> This automated EEG analysis is designed as a computer-aided screening tool for neurologists and trained healthcare personnel. It is not an absolute clinical diagnosis. Always consult your qualified neurologist for therapeutic decisions.
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
