import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  ShieldCheck,
  ShieldAlert,
  X,
  Activity,
  BrainCircuit,
  Clock,
  Image as ImageIcon,
  AlertTriangle,
  Layers,
  HeartPulse,
  Stethoscope,
  Pill,
  PhoneCall,
  Info,
  FileCheck,
} from 'lucide-react';
import { eegApi } from '../../../api/eeg';

/* ────────────────────────────────────────────────────
   EEG Analysis Detail — Patient-Centric & Clinical Report
   ──────────────────────────────────────────────────── */

interface EEGAnalysisDetailProps {
  sessionId: number;
  onClose: () => void;
}

export function EEGAnalysisDetail({ sessionId, onClose }: EEGAnalysisDetailProps) {
  const [activeTab, setActiveTab] = useState<'patient' | 'clinical'>('patient');

  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['eeg', 'session', sessionId],
    queryFn: () => eegApi.getSession(sessionId),
  });

  const { data: predictionData, isLoading: predictionLoading } = useQuery({
    queryKey: ['eeg', 'predictions', sessionId],
    queryFn: () => eegApi.getSessionPredictions(sessionId),
  });

  // Load authenticated spectrogram image blob
  const { data: spectrogramBlobUrl, isLoading: spectrogramLoading } = useQuery({
    queryKey: ['eeg', 'spectrogram', sessionId],
    queryFn: () => eegApi.getSpectrogramBlob(sessionId),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const prediction = predictionData?.items?.[0];
  const isSeizure =
    prediction?.predicted_class?.toLowerCase().includes('seizure') &&
    !prediction?.predicted_class?.toLowerCase().includes('non');
  const confidencePercent = prediction ? (prediction.confidence * 100).toFixed(1) : '0.0';

  // Format window probabilities for Recharts AreaChart
  const windowChartData =
    prediction?.window_probabilities?.map((prob, idx) => ({
      window: `W${idx + 1}`,
      minute: ((idx * 10) / 60).toFixed(1),
      index: idx + 1,
      probability: Number((prob * 100).toFixed(1)),
      threshold: Number((prediction.threshold * 100).toFixed(1)),
    })) || [];

  const isLoading = sessionLoading || predictionLoading;

  return (
    <div
      className="glass-backdrop"
      onClick={onClose}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 1000,
      }}
    >
      <motion.div
        className="glass-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-2xl)',
          position: 'relative',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-5)',
            borderBottom: '1px solid var(--color-border-subtle)',
            paddingBottom: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-lg)',
                background: isSeizure ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                color: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSeizure ? <ShieldAlert size={26} /> : <ShieldCheck size={26} />}
            </div>
            <div>
              <h2
                style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 'bold',
                  margin: 0,
                  color: 'var(--color-text-main)',
                }}
              >
                EEG Brainwave Analysis
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

        {/* ── Tab Switcher: Patient View vs Clinical View ── */}
        <div
          style={{
            display: 'flex',
            background: 'var(--color-background-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-5)',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setActiveTab('patient')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              background: activeTab === 'patient' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'patient' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: activeTab === 'patient' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <HeartPulse size={16} /> Patient Summary & Guidance
          </button>

          <button
            onClick={() => setActiveTab('clinical')}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              background: activeTab === 'clinical' ? 'var(--color-surface)' : 'transparent',
              color: activeTab === 'clinical' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              boxShadow: activeTab === 'clinical' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <BrainCircuit size={16} /> Doctor Metrics & Spectrogram
          </button>
        </div>

        {isLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-12)',
              gap: 'var(--space-3)',
            }}
          >
            <div className="skeleton skeleton-circle" style={{ width: 64, height: 64 }} />
            <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        ) : !prediction ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <AlertTriangle
              size={40}
              style={{ color: 'var(--color-warning)', margin: '0 auto var(--space-3)' }}
            />
            <h3>No Prediction Available</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              This session has not yet been processed by the ML inference pipeline.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* ── TAB 1: PATIENT-FRIENDLY SUMMARY & GUIDANCE ── */}
            {activeTab === 'patient' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Visual Status Result Card */}
                <div
                  style={{
                    padding: 'var(--space-5) var(--space-6)',
                    borderRadius: 'var(--radius-xl)',
                    background: isSeizure ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                    border: `1px solid ${
                      isSeizure ? 'rgba(207, 34, 46, 0.25)' : 'rgba(26, 127, 55, 0.25)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-4)',
                  }}
                >
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isSeizure ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}
                  </div>

                  <div style={{ flex: 1 }}>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
                      }}
                    >
                      {isSeizure ? 'Attention Needed' : 'Normal Recording'}
                    </span>
                    <h3
                      style={{
                        margin: '2px 0 4px 0',
                        fontSize: 'var(--text-xl)',
                        color: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
                        fontWeight: 'bold',
                      }}
                    >
                      {isSeizure
                        ? 'Seizure-Related Brainwaves Detected'
                        : 'No Epileptic Seizures Detected'}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {isSeizure
                        ? 'The neural network detected recurring electrical spikes in your brainwaves during this recording that match epileptic seizure activity.'
                        : 'Your brainwave rhythms remained within normal baseline patterns throughout this recording with no sudden epileptic discharges.'}
                    </p>
                  </div>
                </div>

                {/* Plain English "What does this mean for me?" */}
                <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
                  <h4
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-base)',
                      margin: '0 0 var(--space-3) 0',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <Info size={18} style={{ color: 'var(--color-primary)' }} />
                    What does this mean in plain English?
                  </h4>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.6,
                      margin: '0 0 var(--space-4) 0',
                    }}
                  >
                    {isSeizure
                      ? 'Your brain continuously communicates using tiny electrical pulses. In this recording, several intense rhythmic electrical bursts occurred. This does not mean you are having a seizure right this second, but it indicates periods of heightened excitability that your doctor should examine.'
                      : 'Your brainwaves showed healthy, regular electrical flow without the rapid sharp spike patterns commonly associated with epilepsy or seizures.'}
                  </p>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--color-background-secondary)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          marginBottom: '4px',
                        }}
                      >
                        Recording Length
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'bold',
                          color: 'var(--color-text-main)',
                        }}
                      >
                        {prediction.total_windows ? `${(prediction.total_windows * 10) / 60} Minutes (${prediction.total_windows} segments)` : '1 Hour'}
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--color-background-secondary)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--color-text-muted)',
                          marginBottom: '4px',
                        }}
                      >
                        AI Confidence
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 'bold',
                          color: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
                        }}
                      >
                        {confidencePercent}% statistical confidence
                      </div>
                    </div>
                  </div>
                </div>

                {/* Patient Next Steps & Safety Action Plan */}
                <div className="glass-card" style={{ padding: 'var(--space-5)' }}>
                  <h4
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--text-base)',
                      margin: '0 0 var(--space-4) 0',
                      color: 'var(--color-text-main)',
                    }}
                  >
                    <FileCheck size={18} style={{ color: 'var(--color-secondary)' }} />
                    Recommended Next Steps
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-3)',
                        background: 'var(--color-background-secondary)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <Stethoscope
                        size={20}
                        style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-main)',
                          }}
                        >
                          1. Share Report with Your Neurologist
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          Your assigned doctor in the <strong>Care Network</strong> can view these raw signals to adjust therapy or order formal video-EEG monitoring.
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-3)',
                        background: 'var(--color-background-secondary)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <Pill
                        size={20}
                        style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-main)',
                          }}
                        >
                          2. Maintain Prescribed Medication
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          Do not alter or skip your anti-epileptic medication doses without explicit guidance from your healthcare provider.
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 'var(--space-3)',
                        background: 'var(--color-background-secondary)',
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <PhoneCall
                        size={20}
                        style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: '2px' }}
                      />
                      <div>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--color-text-main)',
                          }}
                        >
                          3. Safety & Emergency Precautions
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          Avoid driving, swimming alone, or heavy machinery. In case of an active seizure lasting &gt;5 minutes, use the <strong>Emergency SOS</strong> button immediately.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: CLINICAL DOCTOR METRICS & SPECTROGRAM ── */}
            {activeTab === 'clinical' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {/* ── Diagnosis Banner ── */}
                <div
                  style={{
                    padding: 'var(--space-4) var(--space-6)',
                    borderRadius: 'var(--radius-xl)',
                    background: isSeizure ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                    border: `1px solid ${
                      isSeizure ? 'rgba(207, 34, 46, 0.2)' : 'rgba(26, 127, 55, 0.2)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 'var(--space-4)',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                        color: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      AI Model Classification
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-2xl)',
                        fontWeight: 'bold',
                        color: isSeizure ? 'var(--color-error)' : 'var(--color-success)',
                      }}
                    >
                      {prediction.predicted_class}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      Model: {prediction.model_version || 'CNN-LSTM-v1'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Confidence Score
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-3xl)',
                        fontWeight: 'bold',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      {confidencePercent}%
                    </div>
                  </div>
                </div>

                {/* ── Key Metrics Grid ── */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      <Layers size={14} /> Positive Windows
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'bold',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      {prediction.positive_windows} / {prediction.total_windows}
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      <Activity size={14} /> Peak Probability
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'bold',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      {(prediction.max_probability * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      <BrainCircuit size={14} /> Decision Threshold
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'bold',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      {(prediction.threshold * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="glass-card" style={{ padding: 'var(--space-3)' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      <Clock size={14} /> Mean Probability
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--text-lg)',
                        fontWeight: 'bold',
                        color: 'var(--color-text-main)',
                      }}
                    >
                      {(prediction.mean_probability * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* ── Time-Window Seizure Probability Timeline ── */}
                {windowChartData.length > 0 && (
                  <div className="glass-card" style={{ padding: 'var(--space-4)' }}>
                    <div className="bento-header" style={{ marginBottom: 'var(--space-3)' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>Temporal Window Probabilities</h4>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          Probability trajectory across continuous 10s recording segments
                        </span>
                      </div>
                      <span className="glass-badge">
                        {windowChartData.length} Segmented Windows
                      </span>
                    </div>
                    <div style={{ height: 190, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={windowChartData}>
                          <defs>
                            <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="5%"
                                stopColor={isSeizure ? 'var(--color-error)' : 'var(--color-primary)'}
                                stopOpacity={0.45}
                              />
                              <stop
                                offset="95%"
                                stopColor={isSeizure ? 'var(--color-error)' : 'var(--color-primary)'}
                                stopOpacity={0.0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="index"
                            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                            width={34}
                            unit="%"
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-lg)',
                              fontSize: 'var(--text-xs)',
                            }}
                            formatter={(val: any, _name: any, item: any) => [
                              `${val}% (Minute ${item.payload.minute})`,
                              'Seizure Probability',
                            ]}
                          />
                          <ReferenceLine
                            y={Number((prediction.threshold * 100).toFixed(0))}
                            stroke="var(--color-warning)"
                            strokeDasharray="3 3"
                            label={{
                              value: 'Threshold (30%)',
                              fill: 'var(--color-warning)',
                              fontSize: 10,
                              position: 'insideTopRight',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="probability"
                            stroke={isSeizure ? 'var(--color-error)' : 'var(--color-primary)'}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#probGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* ── STFT Spectrogram Image Viewer ── */}
                <div className="glass-card" style={{ padding: 'var(--space-4)' }}>
                  <div className="bento-header" style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <ImageIcon size={18} style={{ color: 'var(--color-secondary)' }} />
                      <h4 style={{ margin: 0 }}>Short-Time Fourier Transform (STFT) Spectrogram</h4>
                    </div>
                    <span className="glass-badge">1 - 70 Hz Frequency Band</span>
                  </div>

                  <div
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      overflow: 'hidden',
                      background: '#181c1a',
                      textAlign: 'center',
                      padding: 'var(--space-2)',
                      minHeight: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {spectrogramLoading ? (
                      <div style={{ padding: '24px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        Rendering high-resolution STFT spectrogram...
                      </div>
                    ) : spectrogramBlobUrl ? (
                      <img
                        src={spectrogramBlobUrl}
                        alt={`EEG Spectrogram for Session ${sessionId}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '300px',
                          borderRadius: 'var(--radius-md)',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <div style={{ padding: '24px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        Spectrogram visualization generated on server storage.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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
