import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  HeartHandshake,
  Users,
  Activity,
  Moon,
  Siren,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Lock,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { connectionsApi, type ConnectedPatient } from '../../api/connections';
import { dashboardApi } from '../../api/dashboard';
import { seizuresApi, type ManualSeizureLogCreate } from '../../api/seizures';
import { lifestyleApi, type SleepLogCreate } from '../../api/lifestyle';
import { emergencyApi, type SosEvent } from '../../api/emergency';
import { EmergencyProtocolOverlay } from '../emergency/components/EmergencyProtocolOverlay';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../hooks/useAuth';
import { getAccurateLocation } from '../../utils/geolocation';
import { NotificationPermissionBanner } from '../../components/shared/NotificationPermissionBanner';
import './CaretakerWorkspace.css';

/* ────────────────────────────────────────────────────
   Emergency Tone Synthesizer & Browser Autoplay Unlock
   ──────────────────────────────────────────────────── */
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

function playEmergencyBeep() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const playTone = (freq: number, offset: number, dur: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.35, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + dur);
    };

    // Urgent high-attention medical siren pattern
    playTone(950, 0.0, 0.25);
    playTone(1300, 0.3, 0.35);
    playTone(950, 0.7, 0.25);
    playTone(1300, 1.0, 0.45);
  } catch (e) {
    console.warn('Audio alert fallback:', e);
  }
}

let emergencyAlarmInterval: any = null;

function startEmergencyAlarmLoop() {
  if (emergencyAlarmInterval) return;
  playEmergencyBeep();
  emergencyAlarmInterval = setInterval(() => {
    playEmergencyBeep();
  }, 1800);
}

function stopEmergencyAlarmLoop() {
  if (emergencyAlarmInterval) {
    clearInterval(emergencyAlarmInterval);
    emergencyAlarmInterval = null;
  }
  if (sharedAudioCtx) {
    try {
      sharedAudioCtx.close().catch(() => {});
    } catch {}
    sharedAudioCtx = null;
  }
}

// Persistent tracking of acknowledged SOS events
const dismissedSet = new Set<number>();
try {
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem('epicare_dismissed_sos');
    if (cached) {
      JSON.parse(cached).forEach((id: number) => dismissedSet.add(id));
    }
  }
} catch {}

function isSosDismissed(id: number): boolean {
  return dismissedSet.has(id);
}

function markSosDismissed(id: number) {
  dismissedSet.add(id);
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('epicare_dismissed_sos', JSON.stringify(Array.from(dismissedSet)));
    }
  } catch {}
}

/* ────────────────────────────────────────────────────
   Caretaker Clinical Console — Proxy Logging & Assistance
   ──────────────────────────────────────────────────── */

export function CaretakerWorkspace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [logSeizureModalOpen, setLogSeizureModalOpen] = useState(false);
  const [logSleepModalOpen, setLogSleepModalOpen] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [, setDismissTick] = useState(0);
  const [activeEmergencyAlert, setActiveEmergencyAlert] = useState<SosEvent | null>(null);

  const handleAcknowledgeAlert = () => {
    if (activeEmergencyAlert) {
      markSosDismissed(activeEmergencyAlert.id);
      setActiveEmergencyAlert(null);
    }
    setDismissTick(t => t + 1);
    stopEmergencyAlarmLoop();
  };

  // Clean up alarm if component unmounts
  useEffect(() => {
    return () => {
      stopEmergencyAlarmLoop();
    };
  }, []);

  // Seizure form state
  const [seizureForm, setSeizureForm] = useState<ManualSeizureLogCreate>({
    occurred_at: new Date().toISOString().slice(0, 16),
    duration_seconds: 60,
    seizure_type: 'Generalized Tonic-Clonic',
    notes: '',
  });

  // Sleep form state
  const [sleepForm, setSleepForm] = useState<SleepLogCreate>({
    slept_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 16),
    woke_at: new Date().toISOString().slice(0, 16),
    quality: 4,
    notes: '',
  });

  // Queries
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ['caretaker', 'pending-invites'],
    queryFn: connectionsApi.getCaretakerPendingInvites,
  });

  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['caretaker', 'patients'],
    queryFn: connectionsApi.getCaretakerPatients,
  });

  const activePatient = patients.find((p: ConnectedPatient) => p.patient?.id === selectedPatientId) || patients[0];
  const targetPatientUserId = activePatient?.patient?.id;

  // Real-time polling for active SOS emergency triggers (every 3s)
  const { data: recentSosData } = useQuery({
    queryKey: ['caretaker', 'live-sos-events', targetPatientUserId],
    queryFn: () => emergencyApi.getSOSEvents({ limit: 1, patient_user_id: targetPatientUserId }),
    enabled: !!targetPatientUserId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (recentSosData?.items?.length) {
      const latest = recentSosData.items[0];
      const triggeredTime = new Date(latest.triggered_at).getTime();
      const now = Date.now();
      // If triggered within the last 15 minutes and not dismissed
      if (now - triggeredTime < 15 * 60 * 1000 && !isSosDismissed(latest.id)) {
        if (!activeEmergencyAlert || activeEmergencyAlert.id !== latest.id) {
          setActiveEmergencyAlert(latest);
          startEmergencyAlarmLoop();
        }
      } else if (activeEmergencyAlert) {
        setActiveEmergencyAlert(null);
        stopEmergencyAlarmLoop();
      }
    } else if (activeEmergencyAlert) {
      setActiveEmergencyAlert(null);
      stopEmergencyAlarmLoop();
    }
  }, [recentSosData, activeEmergencyAlert]);

  const { data: patientStats, isLoading: statsLoading } = useQuery({
    queryKey: ['caretaker', 'patient-stats', targetPatientUserId],
    queryFn: () => dashboardApi.getStats({ patient_user_id: targetPatientUserId }),
    enabled: !!targetPatientUserId,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (connectionId: number) => connectionsApi.approveCaretakerInvite(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretaker'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (connectionId: number) => connectionsApi.disconnectCaretaker(connectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caretaker'] });
    },
  });

  const logSeizureMutation = useMutation({
    mutationFn: (data: ManualSeizureLogCreate) =>
      seizuresApi.logManualSeizure(data, { patient_user_id: targetPatientUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seizures'] });
      setLogSeizureModalOpen(false);
      showSuccess(`Seizure event recorded for ${activePatient?.patient?.full_name}.`);
    },
  });

  const logSleepMutation = useMutation({
    mutationFn: (data: SleepLogCreate) =>
      lifestyleApi.logSleep(data, { patient_user_id: targetPatientUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lifestyle'] });
      setLogSleepModalOpen(false);
      showSuccess(`Sleep log recorded for ${activePatient?.patient?.full_name}.`);
    },
  });

  const triggerSosMutation = useMutation({
    mutationFn: async () => {
      const geo = await getAccurateLocation();
      return emergencyApi.triggerSOS({
        latitude: geo.latitude,
        longitude: geo.longitude,
        location_available: geo.location_available,
        patient_user_id: targetPatientUserId,
      });
    },
    onSuccess: () => {
      setSosActive(true);
      queryClient.invalidateQueries({ queryKey: ['caretaker', 'live-sos-events'] });
    },
  });

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 4000);
  };

  const canProxy = activePatient?.can_proxy ?? false;

  return (
    <div className="caretaker-workspace">
      {/* ── Header ── */}
      <div className="caretaker-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-primary-50)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <HeartHandshake size={24} />
          </div>
          <div>
            <h1>Caretaker Care Console</h1>
            <p>Welcome, {user?.full_name || 'Caregiver'}. Manage and assist your designated patients.</p>
          </div>
        </div>
      </div>

      {/* ── Push Notification Permission Prompt ── */}
      <NotificationPermissionBanner />

      {/* ── Real-Time Live Emergency SOS Banner ── */}
      {activeEmergencyAlert && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="live-sos-banner"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#dc2626',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Siren size={22} className="animate-bounce" />
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#991b1b', fontSize: 'var(--text-base)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                🚨 ACTIVE SEIZURE EMERGENCY: {activePatient?.patient?.full_name || 'Patient'}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: '#b91c1c' }}>
                Triggered at {new Date(activeEmergencyAlert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Live GPS Location Available
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {activeEmergencyAlert.latitude && activeEmergencyAlert.longitude && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  window.open(`https://maps.google.com/?q=${activeEmergencyAlert.latitude},${activeEmergencyAlert.longitude}`, '_blank');
                  handleAcknowledgeAlert();
                }}
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <MapPin size={14} /> Open Google Maps
              </button>
            )}
            <button
              className="btn btn-sm btn-outline"
              onClick={handleAcknowledgeAlert}
              style={{ borderColor: '#ef4444', color: '#991b1b' }}
            >
              Acknowledge
            </button>
          </div>
        </motion.div>
      )}

      {actionSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </motion.div>
      )}

      {/* ── Pending Invites Queue ── */}
      {pendingInvites.length > 0 && (
        <div className="glass-card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)', background: 'var(--color-warning-bg)' }}>
          <div style={{ fontWeight: 'bold', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            Pending Patient Care Invitations ({pendingInvites.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {pendingInvites.map((inv: ConnectedPatient) => (
              <div
                key={inv.connection_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-md)',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{inv.patient?.full_name}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{inv.patient?.email} · Proxy Write: {inv.can_proxy ? 'Enabled' : 'Read-Only'}</div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => rejectMutation.mutate(inv.connection_id)}
                    disabled={rejectMutation.isPending}
                    style={{ color: 'var(--color-error)' }}
                  >
                    <XCircle size={14} /> Decline
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => approveMutation.mutate(inv.connection_id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 size={14} /> Accept Invite
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div className="caretaker-grid">
        {/* Left: Assigned Patients List */}
        <div className="glass-card" style={{ padding: 'var(--space-5)', height: 'fit-content' }}>
          <div className="bento-header" style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Users size={18} style={{ color: 'var(--color-primary)' }} />
              <h3>My Assigned Patients</h3>
            </div>
            <span className="glass-badge">{patients.length} Total</span>
          </div>

          {patientsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
            </div>
          ) : patients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              No assigned patients yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {patients.map((p: ConnectedPatient) => {
                const isSelected = p.patient?.id === activePatient?.patient?.id;
                return (
                  <div
                    key={p.connection_id}
                    onClick={() => setSelectedPatientId(p.patient?.id)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-lg)',
                      background: isSelected ? 'var(--color-primary-50)' : 'var(--color-surface)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border-subtle)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-text-main)' }}>
                        {p.patient?.full_name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {p.can_proxy ? 'Proxy Write Access' : 'Read-Only View'}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-placeholder)' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Patient Care Hub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {activePatient ? (
            <>
              <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px' }}>
                      <span className="glass-badge" style={{ color: 'var(--color-primary)', fontSize: '11px' }}>
                        Patient Focus
                      </span>
                      {canProxy ? (
                        <span className="glass-badge" style={{ color: 'var(--color-success)', fontSize: '11px' }}>
                          <ShieldCheck size={12} /> Proxy Logging Enabled
                        </span>
                      ) : (
                        <span className="glass-badge" style={{ color: '#d97706', fontSize: '11px' }}>
                          <Lock size={12} /> Read-Only Caregiver View
                        </span>
                      )}
                    </div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'bold', margin: '4px 0 2px' }}>
                      {activePatient.patient?.full_name}
                    </h2>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      Patient Email: {activePatient.patient?.email}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setLogSleepModalOpen(true)}
                      disabled={!canProxy}
                      title={!canProxy ? 'Disabled: Patient must check Proxy Write Access in Care Network' : 'Log sleep'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        opacity: !canProxy ? 0.6 : 1,
                        cursor: !canProxy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {!canProxy ? <Lock size={13} /> : <Moon size={14} />}
                      <span>Log Sleep</span>
                    </button>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setLogSeizureModalOpen(true)}
                      disabled={!canProxy}
                      title={!canProxy ? 'Disabled: Patient must check Proxy Write Access in Care Network' : 'Log seizure event'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        opacity: !canProxy ? 0.6 : 1,
                        cursor: !canProxy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {!canProxy ? <Lock size={13} /> : <Activity size={14} />}
                      <span>Log Seizure Event</span>
                    </button>

                    <button
                      className="btn btn-md"
                      onClick={() => triggerSosMutation.mutate()}
                      disabled={!canProxy || triggerSosMutation.isPending}
                      title={!canProxy ? 'Disabled: Proxy permission required' : 'Trigger SOS'}
                      style={{
                        background: 'var(--color-error)',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        opacity: !canProxy ? 0.6 : 1,
                        cursor: !canProxy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <Siren size={16} />
                      <span>Trigger Patient SOS</span>
                    </button>
                  </div>
                </div>

                {/* Read-Only Notice if Proxy is False */}
                {!canProxy && (
                  <div
                    style={{
                      marginTop: 'var(--space-4)',
                      padding: 'var(--space-3) var(--space-4)',
                      background: 'var(--color-warning-bg)',
                      border: '1px solid var(--color-warning-glow)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <Lock size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                    <span>
                      Proxy Write Access is disabled by the patient. {activePatient.patient?.full_name} can enable this checkbox anytime in their <strong>Care Network</strong> tab to allow you to log seizures and sleep.
                    </span>
                  </div>
                )}

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Seizures (Past 30d)</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-error)' }}>
                      {statsLoading ? '...' : patientStats?.total_seizures_past_30_days ?? 0}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Medication Adherence</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {statsLoading ? '...' : `${patientStats?.medication_adherence_percent ?? 0}%`}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Medication Streak</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: '#d97706' }}>
                      {statsLoading ? '...' : `${patientStats?.medication_streak ?? 0} days`}
                    </div>
                  </div>

                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Days Seizure-Free</div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-success)' }}>
                      {statsLoading ? '...' : patientStats?.days_since_last_seizure ?? '30+'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card" style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <Users size={48} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
              <h3>No Assigned Patients</h3>
              <p style={{ fontSize: 'var(--text-sm)' }}>When patients invite your caretaker account, their profile will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Log Seizure Modal ── */}
      {logSeizureModalOpen && (
        <div className="glass-backdrop" onClick={() => setLogSeizureModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', zIndex: 1000 }}>
          <motion.div className="glass-modal" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <h3>Log Seizure for {activePatient?.patient?.full_name}</h3>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); logSeizureMutation.mutate(seizureForm); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Select
                id="c_seizure_type"
                label="Seizure Type"
                value={seizureForm.seizure_type}
                onChange={(val) => setSeizureForm(p => ({ ...p, seizure_type: val }))}
                options={[
                  { value: 'Generalized Tonic-Clonic', label: 'Generalized Tonic-Clonic' },
                  { value: 'Absence Seizure', label: 'Absence Seizure' },
                  { value: 'Focal Seizure', label: 'Focal Seizure' },
                ]}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                <Input
                  id="c_seizure_time"
                  type="datetime-local"
                  label="Occurred At"
                  required
                  value={seizureForm.occurred_at}
                  onChange={(e) => setSeizureForm(p => ({ ...p, occurred_at: e.target.value }))}
                />
                <Input
                  id="c_seizure_dur"
                  type="number"
                  label="Duration (Seconds)"
                  min={1}
                  required
                  value={seizureForm.duration_seconds}
                  onChange={(e) => setSeizureForm(p => ({ ...p, duration_seconds: Number(e.target.value) }))}
                />
              </div>

              <Input
                id="c_seizure_notes"
                label="Observations / Symptoms"
                placeholder="Observed jerking, confused for 5 mins..."
                value={seizureForm.notes || ''}
                onChange={(e) => setSeizureForm(p => ({ ...p, notes: e.target.value }))}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline btn-md" onClick={() => setLogSeizureModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-md" disabled={logSeizureMutation.isPending}>
                  {logSeizureMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Save Record</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── Log Sleep Modal ── */}
      {logSleepModalOpen && (
        <div className="glass-backdrop" onClick={() => setLogSleepModalOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', zIndex: 1000 }}>
          <motion.div className="glass-modal" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', padding: 'var(--space-6)', borderRadius: 'var(--radius-xl)' }}>
            <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
              <h3>Log Sleep for {activePatient?.patient?.full_name}</h3>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); logSleepMutation.mutate(sleepForm); }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                <Input
                  id="c_sleep_at"
                  type="datetime-local"
                  label="Bedtime"
                  required
                  value={sleepForm.slept_at}
                  onChange={(e) => setSleepForm(p => ({ ...p, slept_at: e.target.value }))}
                />
                <Input
                  id="c_wake_at"
                  type="datetime-local"
                  label="Wake Time"
                  required
                  value={sleepForm.woke_at}
                  onChange={(e) => setSleepForm(p => ({ ...p, woke_at: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-outline btn-md" onClick={() => setLogSleepModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-md" disabled={logSleepMutation.isPending}>
                  {logSleepMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  <span>Log Sleep</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ── High-Priority Real-Time Emergency SOS Modal ── */}
      {activeEmergencyAlert && (
        <div className="emergency-alert-overlay" onClick={() => {}}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="emergency-alert-card"
          >
            <div className="emergency-alert-header">
              <h2>
                <Siren size={28} className="animate-bounce" />
                <span style={{ color: '#ffffff', letterSpacing: '0.8px' }}>CRITICAL SEIZURE ALERT</span>
              </h2>
              <p style={{ margin: '8px 0 0', color: '#ffffff', fontWeight: 600, fontSize: 'var(--text-base)', opacity: 1, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {activePatient?.patient?.full_name || 'Designated Patient'} triggered an Emergency SOS!
              </p>
            </div>

            <div className="emergency-alert-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)', background: '#f8fafc', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', color: '#64748b' }}>Patient Account:</span>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#0f172a' }}>{activePatient?.patient?.full_name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: '#64748b' }}>Time of Trigger:</span>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#dc2626' }}>
                    {new Date(activeEmergencyAlert.triggered_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {activeEmergencyAlert.latitude && activeEmergencyAlert.longitude ? (
                <div className="emergency-location-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <MapPin size={20} color="#dc2626" />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#991b1b' }}>Patient Live Location Tagged</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: '#7f1d1d' }}>
                          Instant 1-tap turn-by-turn navigation
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${activeEmergencyAlert.latitude},${activeEmergencyAlert.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm"
                      style={{ background: '#dc2626', color: '#ffffff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      <span>Open Live Map</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="emergency-location-box" style={{ textAlign: 'center', color: '#64748b', fontSize: 'var(--text-xs)' }}>
                  Location was not available or disabled on patient device at time of trigger.
                </div>
              )}

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', margin: 'var(--space-4) 0' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: '#166534', marginBottom: 'var(--space-2)' }}>
                  🛡️ EPILEPSY FIRST-AID PROTOCOL:
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: 'var(--text-xs)', color: '#15803d', lineHeight: '1.6' }}>
                  <li>Ease the patient gently onto their side (recovery position) to keep airway clear.</li>
                  <li>Clear all sharp, hard, or dangerous objects away from them.</li>
                  <li>Do NOT restrain movement and do NOT place anything in their mouth.</li>
                  <li>If seizure lasts longer than 5 minutes, immediately call local emergency services.</li>
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  className="btn-emergency-ack"
                  onClick={handleAcknowledgeAlert}
                >
                  <CheckCircle2 size={18} />
                  <span>I Acknowledge & Am Responding to this Seizure</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Active SOS Overlay ── */}
      {sosActive && (
        <EmergencyProtocolOverlay
          contacts={[]}
          onDeactivate={() => setSosActive(false)}
        />
      )}
    </div>
  );
}
