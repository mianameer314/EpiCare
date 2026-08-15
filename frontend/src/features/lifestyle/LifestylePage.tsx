import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, Moon, Zap, Monitor, Plus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { seizuresApi, type ManualSeizureLogCreate } from '../../api/seizures';
import { lifestyleApi, type SleepLogCreate, type TriggerLogCreate } from '../../api/lifestyle';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import './LifestylePage.css';

/* ────────────────────────────────────────────────────
   Lifestyle & Seizure Logging Hub
   ──────────────────────────────────────────────────── */

type TabType = 'seizure' | 'sleep' | 'triggers' | 'habits';

export function LifestylePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('seizure');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Seizure form state
  const [seizureForm, setSeizureForm] = useState<ManualSeizureLogCreate>({
    occurred_at: new Date().toISOString().slice(0, 16),
    duration_seconds: 60,
    seizure_type: 'Generalized Tonic-Clonic',
    auras_felt: [],
    post_ictal_symptoms: [],
    notes: '',
  });

  // Sleep form state
  const [sleepForm, setSleepForm] = useState<SleepLogCreate>({
    slept_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 16),
    woke_at: new Date().toISOString().slice(0, 16),
    quality: 4,
    notes: '',
  });

  // Trigger form state
  const [triggerForm, setTriggerForm] = useState<TriggerLogCreate>({
    trigger_name: 'Sleep Deprivation',
    severity: 3,
    occurred_at: new Date().toISOString().slice(0, 16),
    notes: '',
  });

  // Habits form state (Diet + Screen Time)
  const [screenHours, setScreenHours] = useState(4);
  const [nightExposure, setNightExposure] = useState(false);
  const [ketoCompliant, setKetoCompliant] = useState(true);
  const [alcoholConsumed, setAlcoholConsumed] = useState(false);

  // Queries for history
  const { data: seizureLogs = [] } = useQuery({
    queryKey: ['seizures', 'manual'],
    queryFn: () => seizuresApi.getManualLogs(),
  });

  const { data: sleepLogs } = useQuery({
    queryKey: ['lifestyle', 'sleep'],
    queryFn: () => lifestyleApi.getSleepLogs({ limit: 5 }),
  });

  const { data: triggerLogs } = useQuery({
    queryKey: ['lifestyle', 'triggers'],
    queryFn: () => lifestyleApi.getTriggerLogs({ limit: 5 }),
  });

  // Mutations
  const seizureMutation = useMutation({
    mutationFn: (data: ManualSeizureLogCreate) => seizuresApi.logManualSeizure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seizures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Manual seizure event logged successfully.');
    },
    onError: (err: any) => setErrorMessage(err.message || 'Failed to log seizure.'),
  });

  const sleepMutation = useMutation({
    mutationFn: (data: SleepLogCreate) => lifestyleApi.logSleep(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lifestyle', 'sleep'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Sleep log recorded successfully.');
    },
    onError: (err: any) => setErrorMessage(err.message || 'Failed to log sleep.'),
  });

  const triggerMutation = useMutation({
    mutationFn: (data: TriggerLogCreate) => lifestyleApi.logTrigger(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lifestyle', 'triggers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Trigger event logged successfully.');
    },
    onError: (err: any) => setErrorMessage(err.message || 'Failed to log trigger.'),
  });

  const habitsMutation = useMutation({
    mutationFn: async () => {
      await lifestyleApi.logScreenTime({
        duration_hours: screenHours,
        night_exposure: nightExposure,
        occurred_at: new Date().toISOString(),
      });
      await lifestyleApi.logDiet({
        keto_compliant: ketoCompliant,
        alcohol_consumed: alcoholConsumed,
        occurred_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lifestyle'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Daily diet & digital habits logged.');
    },
    onError: (err: any) => setErrorMessage(err.message || 'Failed to log habits.'),
  });

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage('');
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleSeizureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    seizureMutation.mutate({
      ...seizureForm,
      duration_seconds: Number(seizureForm.duration_seconds),
    });
  };

  const handleSleepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    sleepMutation.mutate({
      ...sleepForm,
      quality: Number(sleepForm.quality),
    });
  };

  const handleTriggerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    triggerMutation.mutate({
      ...triggerForm,
      severity: Number(triggerForm.severity),
    });
  };

  return (
    <div className="lifestyle-page">
      {/* ── Header ── */}
      <div className="lifestyle-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-secondary-50)',
            color: 'var(--color-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Activity size={24} />
          </div>
          <div>
            <h1>Health & Lifestyle Tracking</h1>
            <p>Log seizures, sleep duration, environmental triggers, and habits to train personal AI insights.</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="lifestyle-tab-switcher glass-panel">
          <button
            className={`lifestyle-tab-btn ${activeTab === 'seizure' ? 'active' : ''}`}
            onClick={() => setActiveTab('seizure')}
          >
            <Activity size={15} />
            <span>Seizure Log</span>
          </button>
          <button
            className={`lifestyle-tab-btn ${activeTab === 'sleep' ? 'active' : ''}`}
            onClick={() => setActiveTab('sleep')}
          >
            <Moon size={15} />
            <span>Sleep</span>
          </button>
          <button
            className={`lifestyle-tab-btn ${activeTab === 'triggers' ? 'active' : ''}`}
            onClick={() => setActiveTab('triggers')}
          >
            <Zap size={15} />
            <span>Triggers</span>
          </button>
          <button
            className={`lifestyle-tab-btn ${activeTab === 'habits' ? 'active' : ''}`}
            onClick={() => setActiveTab('habits')}
          >
            <Monitor size={15} />
            <span>Diet & Habits</span>
          </button>
        </div>
      </div>

      {/* ── Banners ── */}
      {successMessage && (
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
          <span>{successMessage}</span>
        </motion.div>
      )}

      {errorMessage && (
        <div className="auth-error-banner" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Main 2-Col Layout: Form + Recent Stream ── */}
      <div className="lifestyle-grid">
        {/* Active Tab Form Card */}
        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
          {activeTab === 'seizure' && (
            <form onSubmit={handleSeizureSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="bento-header" style={{ marginBottom: 'var(--space-2)' }}>
                <h3>Log Seizure Event</h3>
              </div>

              <Select
                id="seizure_type"
                label="Seizure Classification"
                value={seizureForm.seizure_type}
                onChange={(val) => setSeizureForm(p => ({ ...p, seizure_type: val }))}
                options={[
                  { value: 'Generalized Tonic-Clonic', label: 'Generalized Tonic-Clonic (Grand Mal)' },
                  { value: 'Absence Seizure', label: 'Absence Seizure (Petit Mal)' },
                  { value: 'Focal Aware Seizure', label: 'Focal Aware Seizure (Simple Partial)' },
                  { value: 'Focal Impaired Awareness', label: 'Focal Impaired Awareness (Complex Partial)' },
                  { value: 'Myoclonic Seizure', label: 'Myoclonic Seizure' },
                  { value: 'Atonic Seizure', label: 'Atonic (Drop Attack)' },
                ]}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Input
                  id="seizure_time"
                  type="datetime-local"
                  label="Date & Time Occurred"
                  required
                  value={seizureForm.occurred_at}
                  onChange={(e) => setSeizureForm(p => ({ ...p, occurred_at: e.target.value }))}
                />
                <Input
                  id="seizure_duration"
                  type="number"
                  label="Duration (Seconds)"
                  min={1}
                  required
                  value={seizureForm.duration_seconds}
                  onChange={(e) => setSeizureForm(p => ({ ...p, duration_seconds: Number(e.target.value) }))}
                />
              </div>

              <Input
                id="seizure_notes"
                label="Observations & Post-Ictal Symptoms"
                placeholder="e.g. Confusion for 10 mins, felt aura/dizziness beforehand"
                value={seizureForm.notes || ''}
                onChange={(e) => setSeizureForm(p => ({ ...p, notes: e.target.value }))}
              />

              <button type="submit" className="btn btn-primary btn-md" disabled={seizureMutation.isPending} style={{ marginTop: 'var(--space-2)' }}>
                {seizureMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Save Seizure Record</span>
              </button>
            </form>
          )}

          {activeTab === 'sleep' && (
            <form onSubmit={handleSleepSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="bento-header" style={{ marginBottom: 'var(--space-2)' }}>
                <h3>Log Sleep & Rest</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Input
                  id="slept_at"
                  type="datetime-local"
                  label="Time Slept"
                  required
                  value={sleepForm.slept_at}
                  onChange={(e) => setSleepForm(p => ({ ...p, slept_at: e.target.value }))}
                />
                <Input
                  id="woke_at"
                  type="datetime-local"
                  label="Time Woke Up"
                  required
                  value={sleepForm.woke_at}
                  onChange={(e) => setSleepForm(p => ({ ...p, woke_at: e.target.value }))}
                />
              </div>

              <Select
                id="sleep_quality"
                label="Sleep Quality"
                value={String(sleepForm.quality)}
                onChange={(val) => setSleepForm(p => ({ ...p, quality: Number(val) }))}
                options={[
                  { value: '5', label: '5 - Excellent / Deep Rest' },
                  { value: '4', label: '4 - Good Sleep' },
                  { value: '3', label: '3 - Moderate / Few Wakeups' },
                  { value: '2', label: '2 - Poor / Restless' },
                  { value: '1', label: '1 - Severe Insomnia / Disrupted' },
                ]}
              />

              <Input
                id="sleep_notes"
                label="Notes (Optional)"
                placeholder="e.g. Woke up at 3 AM with headache"
                value={sleepForm.notes || ''}
                onChange={(e) => setSleepForm(p => ({ ...p, notes: e.target.value }))}
              />

              <button type="submit" className="btn btn-primary btn-md" disabled={sleepMutation.isPending} style={{ marginTop: 'var(--space-2)' }}>
                {sleepMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Log Sleep Session</span>
              </button>
            </form>
          )}

          {activeTab === 'triggers' && (
            <form onSubmit={handleTriggerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="bento-header" style={{ marginBottom: 'var(--space-2)' }}>
                <h3>Log Suspected Trigger</h3>
              </div>

              <Select
                id="trigger_name"
                label="Trigger Category"
                value={triggerForm.trigger_name}
                onChange={(val) => setTriggerForm(p => ({ ...p, trigger_name: val }))}
                options={[
                  { value: 'Sleep Deprivation', label: 'Sleep Deprivation / Fatigue' },
                  { value: 'Emotional Stress', label: 'High Emotional Stress' },
                  { value: 'Flashing Lights / Strobe', label: 'Photosensitivity / Flashing Lights' },
                  { value: 'Fever or Illness', label: 'Fever / Infection / Illness' },
                  { value: 'Missed Medication Dose', label: 'Missed Medication Dose' },
                  { value: 'Caffeine / Alcohol', label: 'Caffeine / Alcohol Consumption' },
                  { value: 'Dehydration', label: 'Dehydration / Skipping Meals' },
                ]}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Select
                  id="trigger_severity"
                  label="Severity Level (1-5)"
                  value={String(triggerForm.severity)}
                  onChange={(val) => setTriggerForm(p => ({ ...p, severity: Number(val) }))}
                  options={[
                    { value: '1', label: '1 - Very Mild' },
                    { value: '2', label: '2 - Mild' },
                    { value: '3', label: '3 - Moderate' },
                    { value: '4', label: '4 - Strong' },
                    { value: '5', label: '5 - Severe / Pre-Ictal Aura' },
                  ]}
                />
                <Input
                  id="trigger_time"
                  type="datetime-local"
                  label="Time Encountered"
                  required
                  value={triggerForm.occurred_at}
                  onChange={(e) => setTriggerForm(p => ({ ...p, occurred_at: e.target.value }))}
                />
              </div>

              <Input
                id="trigger_notes"
                label="Context & Triggers Notes"
                placeholder="e.g. Gaming for 4 hours late at night"
                value={triggerForm.notes || ''}
                onChange={(e) => setTriggerForm(p => ({ ...p, notes: e.target.value }))}
              />

              <button type="submit" className="btn btn-primary btn-md" disabled={triggerMutation.isPending} style={{ marginTop: 'var(--space-2)' }}>
                {triggerMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Record Trigger</span>
              </button>
            </form>
          )}

          {activeTab === 'habits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div className="bento-header" style={{ marginBottom: 'var(--space-2)' }}>
                <h3>Diet & Screen Habits</h3>
              </div>

              <Input
                id="screen_hours"
                type="number"
                label="Daily Screen Time (Hours)"
                min={0}
                max={24}
                value={screenHours}
                onChange={(e) => setScreenHours(Number(e.target.value))}
              />

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={nightExposure}
                  onChange={(e) => setNightExposure(e.target.checked)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span>Screen exposure late at night (after 10 PM)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ketoCompliant}
                  onChange={(e) => setKetoCompliant(e.target.checked)}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span>Ketogenic diet compliance maintained today</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={alcoholConsumed}
                  onChange={(e) => setAlcoholConsumed(e.target.checked)}
                  style={{ accentColor: 'var(--color-error)' }}
                />
                <span style={{ color: alcoholConsumed ? 'var(--color-error)' : 'inherit' }}>
                  Alcohol consumed (known seizure trigger)
                </span>
              </label>

              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={() => habitsMutation.mutate()}
                disabled={habitsMutation.isPending}
                style={{ marginTop: 'var(--space-2)' }}
              >
                {habitsMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                <span>Log Daily Habits</span>
              </button>
            </div>
          )}
        </div>

        {/* Activity Stream Feed */}
        <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
          <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
            <h3>Recent Health Records</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {seizureLogs.slice(0, 3).map((log) => (
              <div key={log.id} style={{ padding: 'var(--space-3)', background: 'var(--color-error-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(207,34,46,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-error)' }}>
                  <span>⚡ Seizure ({log.seizure_type})</span>
                  <span>{log.duration_seconds}s</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {new Date(log.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}

            {sleepLogs?.items?.slice(0, 2).map((s) => (
              <div key={s.id} style={{ padding: 'var(--space-3)', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-secondary)' }}>
                  <span>🌙 Sleep Session</span>
                  <span>{(s.duration_minutes / 60).toFixed(1)} hrs (Rating {s.quality}/5)</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Woke at {new Date(s.woke_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}

            {triggerLogs?.items?.slice(0, 2).map((t) => (
              <div key={t.id} style={{ padding: 'var(--space-3)', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-warning-glow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                  <span>⚠️ Trigger: {t.trigger_name}</span>
                  <span>Severity {t.severity}/5</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {new Date(t.occurred_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}

            {seizureLogs.length === 0 && (!sleepLogs || sleepLogs.items.length === 0) && (
              <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                No recent health events logged. Use the forms to record data.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
