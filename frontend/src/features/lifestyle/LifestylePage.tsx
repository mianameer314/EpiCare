import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Moon,
  Zap,
  Monitor,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  BellRing,
  Star,
  ShieldCheck,
  Calendar,
  Flame,
  Check,
  FileText,
  X,
} from 'lucide-react';
import { seizuresApi, type ManualSeizureLogCreate } from '../../api/seizures';
import { lifestyleApi, type SleepLogCreate, type TriggerLogCreate } from '../../api/lifestyle';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useUnsavedChanges } from '../../providers/UnsavedChangesProvider';
import './LifestylePage.css';

/* ────────────────────────────────────────────────────
   Lifestyle & Seizure Logging Hub
   Executive 2026 Medical Design System
   ──────────────────────────────────────────────────── */

type TabType = 'seizure' | 'sleep' | 'triggers' | 'habits';
type HistoryFilterType = 'all' | 'seizures' | 'sleep' | 'triggers';

interface SeizureClassificationInfo {
  name: string;
  summary: string;
  keySigns: string[];
  clinicalTip: string;
}

const CLASSIFICATION_DETAILS: Record<string, SeizureClassificationInfo> = {
  'Generalized Tonic-Clonic': {
    name: 'Generalized Tonic-Clonic (Grand Mal)',
    summary: 'Full-body episode where muscles stiffen (tonic) followed by rhythmic shaking/convulsions (clonic), usually with temporary loss of consciousness.',
    keySigns: ['Loss of consciousness', 'Rhythmic body jerking', 'Possible tongue biting', 'Deep fatigue or confusion afterwards'],
    clinicalTip: 'Note whether the patient fell, how long post-seizure confusion lasted, and if there was deep snoring sleep afterwards.',
  },
  'Absence Seizure': {
    name: 'Absence Seizure (Petit Mal)',
    summary: 'Brief staring spell lasting 5 to 15 seconds where the person stops moving and speaking, then immediately resumes normal activity.',
    keySigns: ['Blank staring into space', 'Brief pause in speech or action', 'Subtle eyelid fluttering', 'No memory of the pause'],
    clinicalTip: 'Note how many seconds the staring lasted and how many times it occurred today.',
  },
  'Focal Aware Seizure': {
    name: 'Focal Aware Seizure (Simple Partial)',
    summary: 'Localized episode where the patient remains fully awake and conscious, but experiences isolated muscle twitching, strange sensory sensations, or a sudden aura.',
    keySigns: ['One-sided arm or facial twitching', 'Pins and needles sensation', 'Sudden wave of deja vu or fear', 'Patient remains awake and aware'],
    clinicalTip: 'Specify which body part moved (e.g. right arm, left cheek) and whether the sensation spread.',
  },
  'Focal Impaired Awareness': {
    name: 'Focal Impaired Awareness (Complex Partial)',
    summary: 'Episode where awareness is clouded or lost. The person may appear confused and perform automatic repetitive movements.',
    keySigns: ['Confusion and delayed response', 'Repetitive lip smacking or swallowing', 'Fumbling with clothing or hands', 'Aimless walking or wandering'],
    clinicalTip: 'Note if the patient could answer their name during the episode and what repetitive actions were seen.',
  },
  'Myoclonic Seizure': {
    name: 'Myoclonic Seizure',
    summary: 'Sudden, shock-like muscle jerks that usually last 1 to 2 seconds, often occurring shortly after waking up in the morning.',
    keySigns: ['Brief shock-like muscle jerk', 'Accidental dropping of cups or objects', 'Most common in the morning', 'No loss of consciousness'],
    clinicalTip: 'Note if objects were dropped and what time of morning the jerks occurred.',
  },
  'Atonic Seizure': {
    name: 'Atonic (Drop Attack)',
    summary: 'Sudden, brief loss of muscle tone causing the head to drop or the person to collapse straight to the floor.',
    keySigns: ['Sudden collapse to ground', 'Sudden head drop', 'Loss of muscle strength', 'Immediate recovery after fall'],
    clinicalTip: 'Note if the fall caused any bruising and whether it happened while walking or standing.',
  },
};

const COMMON_AURAS = [
  'Dizziness / Lightheadedness',
  'Visual Flashes / Bright Spots',
  'Rising Stomach Sensation',
  'Unusual Taste or Smell',
  'Sudden Deja Vu or Anxiety',
  'Numbness or Tingling',
  'Pre-Seizure Headache',
];

const COMMON_POST_ICTAL = [
  'Confusion / Disorientation (10–30 mins)',
  'Deep Sleep / Extreme Fatigue',
  'Severe Headache',
  'Muscle Soreness / Aches',
  'Tongue Biting Wound',
  'Temporary Speech Difficulty',
  'Temporary Limb Weakness',
];

export function LifestylePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('seizure');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilterType>('all');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showLearnMore, setShowLearnMore] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: 'seizure' | 'sleep' | 'trigger'; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Seizure form state
  const [durationMinutes, setDurationMinutes] = useState(1);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [customAuras, setCustomAuras] = useState<string[]>([]);
  const [customAuraInput, setCustomAuraInput] = useState('');
  const [showCustomAuraInput, setShowCustomAuraInput] = useState(false);

  const [customPostIctal, setCustomPostIctal] = useState<string[]>([]);
  const [customPostIctalInput, setCustomPostIctalInput] = useState('');
  const [showCustomPostIctalInput, setShowCustomPostIctalInput] = useState(false);

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

  // Habits form state
  const [screenHours, setScreenHours] = useState(4);
  const [nightExposure, setNightExposure] = useState(false);
  const [ketoCompliant, setKetoCompliant] = useState(true);
  const [alcoholConsumed, setAlcoholConsumed] = useState(false);

  // Unsaved changes tracking
  const isFormDirty = useMemo(() => {
    if (activeTab === 'seizure') {
      return Boolean(
        (seizureForm.notes && seizureForm.notes.trim().length > 0) ||
        (seizureForm.auras_felt && seizureForm.auras_felt.length > 0) ||
        (seizureForm.post_ictal_symptoms && seizureForm.post_ictal_symptoms.length > 0) ||
        durationMinutes !== 1 ||
        durationSeconds !== 0 ||
        seizureForm.seizure_type !== 'Generalized Tonic-Clonic'
      );
    }
    if (activeTab === 'sleep') {
      return Boolean((sleepForm.notes && sleepForm.notes.trim().length > 0) || sleepForm.quality !== 4);
    }
    if (activeTab === 'triggers') {
      return Boolean(
        (triggerForm.notes && triggerForm.notes.trim().length > 0) ||
        triggerForm.trigger_name !== 'Sleep Deprivation' ||
        triggerForm.severity !== 3
      );
    }
    if (activeTab === 'habits') {
      return screenHours !== 4 || nightExposure !== false || alcoholConsumed !== false;
    }
    return false;
  }, [activeTab, seizureForm, durationMinutes, durationSeconds, sleepForm, triggerForm, screenHours, nightExposure, alcoholConsumed]);

  useUnsavedChanges(
    isFormDirty,
    'You have an unsaved health record or observation in progress. Are you sure you want to leave without saving?'
  );

  // Queries for history
  const { data: seizureLogs = [] } = useQuery({
    queryKey: ['seizures', 'manual'],
    queryFn: () => seizuresApi.getManualLogs(),
  });

  const { data: sleepLogs } = useQuery({
    queryKey: ['lifestyle', 'sleep'],
    queryFn: () => lifestyleApi.getSleepLogs({ limit: 50 }),
  });

  const { data: triggerLogs } = useQuery({
    queryKey: ['lifestyle', 'triggers'],
    queryFn: () => lifestyleApi.getTriggerLogs({ limit: 50 }),
  });

  // Mutations
  const seizureMutation = useMutation({
    mutationFn: (data: ManualSeizureLogCreate) => seizuresApi.logManualSeizure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seizures'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Seizure episode recorded successfully.');
      setDurationMinutes(1);
      setDurationSeconds(0);
      setCustomAuras([]);
      setCustomPostIctal([]);
      setShowCustomAuraInput(false);
      setShowCustomPostIctalInput(false);
      setSeizureForm({
        occurred_at: new Date().toISOString().slice(0, 16),
        duration_seconds: 60,
        seizure_type: 'Generalized Tonic-Clonic',
        auras_felt: [],
        post_ictal_symptoms: [],
        notes: '',
      });
    },
    onError: (err: any) => setErrorMessage(err.message || 'Failed to log seizure event.'),
  });

  const sleepMutation = useMutation({
    mutationFn: (data: SleepLogCreate) => lifestyleApi.logSleep(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lifestyle', 'sleep'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Sleep session recorded successfully.');
      setSleepForm({
        slept_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString().slice(0, 16),
        woke_at: new Date().toISOString().slice(0, 16),
        quality: 4,
        notes: '',
      });
    },
    onError: (err: any) => setErrorMessage(err.message || 'Failed to log sleep.'),
  });

  const triggerMutation = useMutation({
    mutationFn: (data: TriggerLogCreate) => lifestyleApi.logTrigger(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lifestyle', 'triggers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      showSuccess('Trigger event logged successfully.');
      setTriggerForm({
        trigger_name: 'Sleep Deprivation',
        severity: 3,
        occurred_at: new Date().toISOString().slice(0, 16),
        notes: '',
      });
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
      showSuccess('Daily diet & digital habits saved.');
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
    const totalDuration = Math.max(1, (Number(durationMinutes) || 0) * 60 + (Number(durationSeconds) || 0));
    seizureMutation.mutate({
      ...seizureForm,
      duration_seconds: totalDuration,
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

  // Toggle Aura Chip
  const toggleAura = (auraText: string) => {
    const current = seizureForm.auras_felt || [];
    const exists = current.includes(auraText);
    const updated = exists ? current.filter((a) => a !== auraText) : [...current, auraText];
    setSeizureForm((p) => ({ ...p, auras_felt: updated }));
  };

  // Custom Aura Handlers
  const handleAddCustomAura = () => {
    const trimmed = customAuraInput.trim();
    if (!trimmed) return;
    if (!customAuras.includes(trimmed) && !COMMON_AURAS.includes(trimmed)) {
      setCustomAuras((prev) => [...prev, trimmed]);
    }
    if (!(seizureForm.auras_felt || []).includes(trimmed)) {
      setSeizureForm((p) => ({ ...p, auras_felt: [...(p.auras_felt || []), trimmed] }));
    }
    setCustomAuraInput('');
    setShowCustomAuraInput(false);
  };

  const handleRemoveCustomAura = (auraToRemove: string) => {
    setCustomAuras((prev) => prev.filter((a) => a !== auraToRemove));
    setSeizureForm((p) => ({ ...p, auras_felt: (p.auras_felt || []).filter((a) => a !== auraToRemove) }));
  };

  // Toggle Post-Ictal Chip
  const togglePostIctal = (symptomText: string) => {
    const current = seizureForm.post_ictal_symptoms || [];
    const exists = current.includes(symptomText);
    const updated = exists ? current.filter((s) => s !== symptomText) : [...current, symptomText];
    setSeizureForm((p) => ({ ...p, post_ictal_symptoms: updated }));
  };

  // Custom Post-Ictal Handlers
  const handleAddCustomPostIctal = () => {
    const trimmed = customPostIctalInput.trim();
    if (!trimmed) return;
    if (!customPostIctal.includes(trimmed) && !COMMON_POST_ICTAL.includes(trimmed)) {
      setCustomPostIctal((prev) => [...prev, trimmed]);
    }
    if (!(seizureForm.post_ictal_symptoms || []).includes(trimmed)) {
      setSeizureForm((p) => ({ ...p, post_ictal_symptoms: [...(p.post_ictal_symptoms || []), trimmed] }));
    }
    setCustomPostIctalInput('');
    setShowCustomPostIctalInput(false);
  };

  const handleRemoveCustomPostIctal = (symToRemove: string) => {
    setCustomPostIctal((prev) => prev.filter((s) => s !== symToRemove));
    setSeizureForm((p) => ({ ...p, post_ictal_symptoms: (p.post_ictal_symptoms || []).filter((s) => s !== symToRemove) }));
  };

  // Preset Duration Setter
  const applyDurationPreset = (mins: number, secs: number) => {
    setDurationMinutes(mins);
    setDurationSeconds(secs);
  };

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'seizure') {
        await seizuresApi.deleteManualSeizure(deleteTarget.id);
        queryClient.invalidateQueries({ queryKey: ['seizures'] });
      } else if (deleteTarget.type === 'sleep') {
        await lifestyleApi.deleteSleepLog(deleteTarget.id);
        queryClient.invalidateQueries({ queryKey: ['lifestyle', 'sleep'] });
      } else if (deleteTarget.type === 'trigger') {
        await lifestyleApi.deleteTriggerLog(deleteTarget.id);
        queryClient.invalidateQueries({ queryKey: ['lifestyle', 'triggers'] });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteTarget(null);
      showSuccess(`Deleted ${deleteTarget.name} record.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Combined Unified History List
  const unifiedHistory = useMemo(() => {
    const list: Array<{
      id: string;
      rawId: number;
      type: 'seizure' | 'sleep' | 'trigger';
      title: string;
      subtitle: string;
      badgeText: string;
      date: Date;
      notes?: string | null;
    }> = [];

    // Seizures
    seizureLogs.forEach((s) => {
      list.push({
        id: `seizure-${s.id}`,
        rawId: s.id,
        type: 'seizure',
        title: `Seizure: ${s.seizure_type}`,
        subtitle: `${s.duration_seconds}s episode`,
        badgeText: `${s.duration_seconds}s`,
        date: new Date(s.occurred_at),
        notes: s.notes,
      });
    });

    // Sleep
    (sleepLogs?.items || []).forEach((sl) => {
      list.push({
        id: `sleep-${sl.id}`,
        rawId: sl.id,
        type: 'sleep',
        title: `Sleep Session (${(sl.duration_minutes / 60).toFixed(1)} hrs)`,
        subtitle: `Quality rating: ${sl.quality || 3}/5`,
        badgeText: `${(sl.duration_minutes / 60).toFixed(1)}h`,
        date: new Date(sl.woke_at),
        notes: sl.notes,
      });
    });

    // Triggers
    (triggerLogs?.items || []).forEach((tr) => {
      list.push({
        id: `trigger-${tr.id}`,
        rawId: tr.id,
        type: 'trigger',
        title: `Trigger: ${tr.trigger_name}`,
        subtitle: `Severity level: ${tr.severity || 1}/5`,
        badgeText: `Level ${tr.severity || 1}/5`,
        date: new Date(tr.occurred_at),
        notes: tr.notes,
      });
    });

    // Sort newest first
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list;
  }, [seizureLogs, sleepLogs, triggerLogs]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'seizures') return unifiedHistory.filter((item) => item.type === 'seizure');
    if (historyFilter === 'sleep') return unifiedHistory.filter((item) => item.type === 'sleep');
    if (historyFilter === 'triggers') return unifiedHistory.filter((item) => item.type === 'trigger');
    return unifiedHistory;
  }, [unifiedHistory, historyFilter]);

  // Pagination (6 items per page)
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedItems = filteredHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  const currentInfo = CLASSIFICATION_DETAILS[seizureForm.seizure_type] || CLASSIFICATION_DETAILS['Generalized Tonic-Clonic'];

  return (
    <div className="lifestyle-page">
      {/* ── Page Header ── */}
      <div className="lifestyle-header">
        <div className="lifestyle-header-title-block">
          <div className="lifestyle-header-icon">
            <Activity size={26} />
          </div>
          <div>
            <h1>Health & Lifestyle Tracking</h1>
            <p>Log clinical seizures, sleep telemetry, environmental triggers, and habits in real time.</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="lifestyle-tab-switcher">
          <button
            className={`lifestyle-tab-btn seizure ${activeTab === 'seizure' ? 'active' : ''}`}
            onClick={() => setActiveTab('seizure')}
          >
            <Activity size={15} />
            <span>Seizure Log</span>
          </button>
          <button
            className={`lifestyle-tab-btn sleep ${activeTab === 'sleep' ? 'active' : ''}`}
            onClick={() => setActiveTab('sleep')}
          >
            <Moon size={15} />
            <span>Sleep</span>
          </button>
          <button
            className={`lifestyle-tab-btn triggers ${activeTab === 'triggers' ? 'active' : ''}`}
            onClick={() => setActiveTab('triggers')}
          >
            <Zap size={15} />
            <span>Triggers</span>
          </button>
          <button
            className={`lifestyle-tab-btn habits ${activeTab === 'habits' ? 'active' : ''}`}
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
            border: '1px solid rgba(26, 127, 55, 0.2)',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </motion.div>
      )}

      {errorMessage && (
        <div
          className="auth-error-banner"
          style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* ── Main Stacked Layout ── */}
      <div className="lifestyle-stack-container">
        {/* Active Tab Master Card */}
        <div className="lifestyle-form-card">
          {/* ══════════════════════════════════════════════
              TAB 1: SEIZURE LOG FORM
             ══════════════════════════════════════════════ */}
          {activeTab === 'seizure' && (
            <form onSubmit={handleSeizureSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {/* Hero Banner inside Card */}
              <div className="lifestyle-form-banner">
                <div className="lifestyle-banner-left">
                  <div className="lifestyle-banner-icon-box">
                    <Activity size={22} />
                  </div>
                  <div>
                    <div className="lifestyle-banner-tag">
                      <span className="lifestyle-pulse-dot" />
                      Clinical Telemetry Input
                    </div>
                    <h2 className="lifestyle-banner-title">Log Seizure Episode</h2>
                    <p className="lifestyle-banner-sub">
                      High-fidelity seizure documentation designed for direct neurologist review and AI trend analysis.
                    </p>
                  </div>
                </div>

                <div className="lifestyle-banner-badges">
                  <span className="lifestyle-meta-badge">
                    <ShieldCheck size={13} style={{ color: 'var(--color-primary)' }} />
                    Neurologist Verified
                  </span>
                  <span className="lifestyle-meta-badge">
                    <Activity size={13} style={{ color: 'var(--color-secondary)' }} />
                    Clinical Telemetry Synced
                  </span>
                </div>
              </div>

              {/* Bento Block 1: Classification & Timing */}
              <div className="lifestyle-bento-block emerald-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill emerald">
                      <Activity size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Classification & Event Timing</span>
                  </div>
                  <span className="lifestyle-bento-sub">Define exact seizure type, timestamp, and duration</span>
                </div>

                {/* Classification Select */}
                <div className="lifestyle-field-group">
                  <Select
                    id="seizure_type"
                    label="Seizure Classification"
                    value={seizureForm.seizure_type}
                    onChange={(val) => setSeizureForm((p) => ({ ...p, seizure_type: val }))}
                    options={[
                      {
                        value: 'Generalized Tonic-Clonic',
                        label: 'Generalized Tonic-Clonic (Grand Mal) — Full-body shaking & loss of consciousness',
                      },
                      {
                        value: 'Absence Seizure',
                        label: 'Absence Seizure (Petit Mal) — Brief staring spell & paused activity (5–15 seconds)',
                      },
                      {
                        value: 'Focal Aware Seizure',
                        label: 'Focal Aware Seizure (Simple Partial) — Local twitching or sensory feeling while awake',
                      },
                      {
                        value: 'Focal Impaired Awareness',
                        label: 'Focal Impaired Awareness (Complex Partial) — Confusion & repetitive movements',
                      },
                      {
                        value: 'Myoclonic Seizure',
                        label: 'Myoclonic Seizure — Sudden shock-like muscle jerks (common in morning)',
                      },
                      {
                        value: 'Atonic Seizure',
                        label: 'Atonic (Drop Attack) — Sudden loss of muscle tone & collapsing to ground',
                      },
                    ]}
                  />

                  {/* Subtle Learn More Toggle */}
                  <button
                    type="button"
                    className="lifestyle-learn-toggle"
                    onClick={() => setShowLearnMore((prev) => !prev)}
                  >
                    <Info size={13} />
                    <span>{showLearnMore ? 'Hide clinical details' : 'Learn more about this classification'}</span>
                    {showLearnMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {/* Expandable Clinical Guide */}
                  <AnimatePresence>
                    {showLearnMore && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="lifestyle-guide-box"
                      >
                        <div className="lifestyle-guide-title">
                          <Info size={14} />
                          <span>{currentInfo.name}</span>
                        </div>
                        <p className="lifestyle-guide-desc">{currentInfo.summary}</p>

                        <div className="lifestyle-guide-pills">
                          {currentInfo.keySigns.map((sign, idx) => (
                            <span key={idx} className="lifestyle-guide-pill">
                              • {sign}
                            </span>
                          ))}
                        </div>

                        <div className="lifestyle-guide-hint">
                          <strong>Clinical Tip:</strong> {currentInfo.clinicalTip}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Date & Time + Duration in Same Row (Symmetrically Aligned) */}
                <div className="lifestyle-row-2col">
                  <div className="lifestyle-field-group">
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '22px' }}>
                      <Calendar size={14} style={{ color: 'var(--color-primary)' }} />
                      <span>Date & Time Occurred</span>
                      <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>

                    <Input
                      id="seizure_time"
                      type="datetime-local"
                      label=""
                      required
                      value={seizureForm.occurred_at}
                      onChange={(e) => setSeizureForm((p) => ({ ...p, occurred_at: e.target.value }))}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', minHeight: '28px' }}>
                      <span className="lifestyle-field-hint">Time the episode began</span>
                    </div>
                  </div>

                  <div className="lifestyle-field-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '22px' }}>
                      <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                        <Clock size={14} style={{ color: 'var(--color-primary)' }} />
                        <span>Episode Duration</span>
                        <span style={{ color: 'var(--color-error)' }}>*</span>
                      </label>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--color-primary-dark)',
                          background: 'rgba(45, 90, 63, 0.08)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid rgba(45, 90, 63, 0.18)',
                        }}
                      >
                        Total: {durationMinutes > 0 ? `${durationMinutes}m ` : ''}{durationSeconds}s ({durationMinutes * 60 + durationSeconds}s)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-3)' }}>
                      <div>
                        <Input
                          id="duration_mins"
                          type="number"
                          label=""
                          min={0}
                          max={120}
                          placeholder="0"
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Math.max(0, Number(e.target.value)))}
                        />
                        <span className="lifestyle-field-hint">Minutes (min)</span>
                      </div>

                      <div>
                        <Input
                          id="duration_secs"
                          type="number"
                          label=""
                          min={0}
                          max={59}
                          placeholder="0"
                          value={durationSeconds}
                          onChange={(e) => setDurationSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
                        />
                        <span className="lifestyle-field-hint">Seconds (sec)</span>
                      </div>
                    </div>

                    {/* Quick Duration Preset Buttons */}
                    <div className="lifestyle-preset-row" style={{ minHeight: '28px', marginTop: '2px' }}>
                      <span className="lifestyle-preset-label">Presets:</span>
                      <button type="button" className="lifestyle-preset-btn" onClick={() => applyDurationPreset(0, 30)}>
                        30s
                      </button>
                      <button type="button" className="lifestyle-preset-btn" onClick={() => applyDurationPreset(1, 0)}>
                        1m
                      </button>
                      <button type="button" className="lifestyle-preset-btn" onClick={() => applyDurationPreset(2, 0)}>
                        2m
                      </button>
                      <button type="button" className="lifestyle-preset-btn" onClick={() => applyDurationPreset(5, 0)}>
                        5m
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bento Block 2: Warning Signs (Auras) */}
              <div className="lifestyle-bento-block amber-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill amber">
                      <BellRing size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Pre-Ictal Warning Signs (Auras)</span>
                  </div>
                  <span className="lifestyle-bento-sub">Select or add sensory sensations experienced prior to the seizure</span>
                </div>

                <div className="lifestyle-chip-group">
                  {/* Default Clinical Auras */}
                  {COMMON_AURAS.map((aura) => {
                    const isSelected = (seizureForm.auras_felt || []).includes(aura);
                    return (
                      <button
                        key={aura}
                        type="button"
                        className={`lifestyle-chip-amber ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleAura(aura)}
                      >
                        {isSelected ? <Check size={13} /> : '+ '}
                        {aura}
                      </button>
                    );
                  })}

                  {/* Custom User Added Auras */}
                  {customAuras.map((aura) => {
                    const isSelected = (seizureForm.auras_felt || []).includes(aura);
                    return (
                      <div
                        key={aura}
                        className={`lifestyle-chip-amber ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleAura(aura)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        {isSelected ? <Check size={13} /> : '+ '}
                        <span>{aura}</span>
                        <button
                          type="button"
                          className="lifestyle-chip-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomAura(aura);
                          }}
                          title="Remove custom aura"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Custom Aura Input / Add Button */}
                  {showCustomAuraInput ? (
                    <div className="lifestyle-custom-input-bar amber">
                      <input
                        type="text"
                        placeholder="Type custom warning sign..."
                        value={customAuraInput}
                        onChange={(e) => setCustomAuraInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomAura();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomAura}
                        className="lifestyle-custom-add-btn amber"
                      >
                        <Plus size={12} /> Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomAuraInput(false);
                          setCustomAuraInput('');
                        }}
                        className="lifestyle-custom-cancel-btn"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="lifestyle-add-custom-chip amber"
                      onClick={() => setShowCustomAuraInput(true)}
                    >
                      <Plus size={13} /> Add Custom Aura
                    </button>
                  )}
                </div>
              </div>

              {/* Bento Block 3: Post-Ictal Recovery Symptoms */}
              <div className="lifestyle-bento-block indigo-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill indigo">
                      <Clock size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Post-Ictal Recovery Symptoms</span>
                  </div>
                  <span className="lifestyle-bento-sub">Select or add physical & cognitive symptoms noticed during recovery</span>
                </div>

                <div className="lifestyle-chip-group">
                  {/* Default Post-Ictal Symptoms */}
                  {COMMON_POST_ICTAL.map((sym) => {
                    const isSelected = (seizureForm.post_ictal_symptoms || []).includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        className={`lifestyle-chip-indigo ${isSelected ? 'selected' : ''}`}
                        onClick={() => togglePostIctal(sym)}
                      >
                        {isSelected ? <Check size={13} /> : '+ '}
                        {sym}
                      </button>
                    );
                  })}

                  {/* Custom User Added Symptoms */}
                  {customPostIctal.map((sym) => {
                    const isSelected = (seizureForm.post_ictal_symptoms || []).includes(sym);
                    return (
                      <div
                        key={sym}
                        className={`lifestyle-chip-indigo ${isSelected ? 'selected' : ''}`}
                        onClick={() => togglePostIctal(sym)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                      >
                        {isSelected ? <Check size={13} /> : '+ '}
                        <span>{sym}</span>
                        <button
                          type="button"
                          className="lifestyle-chip-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCustomPostIctal(sym);
                          }}
                          title="Remove custom symptom"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Custom Post-Ictal Input / Add Button */}
                  {showCustomPostIctalInput ? (
                    <div className="lifestyle-custom-input-bar indigo">
                      <input
                        type="text"
                        placeholder="Type custom recovery symptom..."
                        value={customPostIctalInput}
                        onChange={(e) => setCustomPostIctalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomPostIctal();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomPostIctal}
                        className="lifestyle-custom-add-btn indigo"
                      >
                        <Plus size={12} /> Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomPostIctalInput(false);
                          setCustomPostIctalInput('');
                        }}
                        className="lifestyle-custom-cancel-btn"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="lifestyle-add-custom-chip indigo"
                      onClick={() => setShowCustomPostIctalInput(true)}
                    >
                      <Plus size={13} /> Add Custom Symptom
                    </button>
                  )}
                </div>
              </div>

              {/* Bento Block 4: Notes */}
              <div className="lifestyle-bento-block slate-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill slate">
                      <FileText size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Doctor & Caregiver Observations</span>
                  </div>
                  <span className="lifestyle-bento-sub">Document context, witnesses, or environmental triggers</span>
                </div>

                <Input
                  id="seizure_notes"
                  label=""
                  placeholder="e.g. Occurred during sleep, patient was confused for 15 minutes, witnessed by family member..."
                  value={seizureForm.notes || ''}
                  onChange={(e) => setSeizureForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {/* Form Action Footer */}
              <div className="lifestyle-form-actions">
                <button
                  type="submit"
                  className="lifestyle-submit-btn"
                  disabled={seizureMutation.isPending}
                >
                  {seizureMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Save Seizure Record</span>
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════
              TAB 2: SLEEP LOG FORM
             ══════════════════════════════════════════════ */}
          {activeTab === 'sleep' && (
            <form onSubmit={handleSleepSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div className="lifestyle-form-banner">
                <div className="lifestyle-banner-left">
                  <div className="lifestyle-banner-icon-box" style={{ color: '#4f46e5' }}>
                    <Moon size={22} />
                  </div>
                  <div>
                    <div className="lifestyle-banner-tag" style={{ color: '#4f46e5' }}>
                      <span className="lifestyle-pulse-dot" style={{ background: '#4f46e5', boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.25)' }} />
                      Rest & Circadian Telemetry
                    </div>
                    <h2 className="lifestyle-banner-title">Log Sleep Session</h2>
                    <p className="lifestyle-banner-sub">
                      Consistent nocturnal rest stabilizes neural firing and raises your seizure threshold.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lifestyle-bento-block indigo-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill indigo">
                      <Clock size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Sleep & Wake Timing</span>
                  </div>
                </div>

                <div className="lifestyle-row-2col">
                  <div className="lifestyle-field-group">
                    <Input
                      id="slept_at"
                      type="datetime-local"
                      label="Bedtime / Time Slept"
                      required
                      value={sleepForm.slept_at}
                      onChange={(e) => setSleepForm((p) => ({ ...p, slept_at: e.target.value }))}
                    />
                    <span className="lifestyle-field-hint">Time you fell asleep</span>
                  </div>

                  <div className="lifestyle-field-group">
                    <Input
                      id="woke_at"
                      type="datetime-local"
                      label="Wake Time"
                      required
                      value={sleepForm.woke_at}
                      onChange={(e) => setSleepForm((p) => ({ ...p, woke_at: e.target.value }))}
                    />
                    <span className="lifestyle-field-hint">Time you woke up</span>
                  </div>
                </div>
              </div>

              {/* Interactive Sleep Quality Rating Tiles */}
              <div className="lifestyle-bento-block indigo-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill indigo">
                      <Star size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Sleep Quality Rating</span>
                  </div>
                  <span className="lifestyle-bento-sub">Click a tile to rate depth and continuity</span>
                </div>

                <div className="lifestyle-quality-tiles">
                  {[
                    { val: 1, title: '1 - Severe Insomnia', desc: '< 4 hrs / Disrupted' },
                    { val: 2, title: '2 - Poor Rest', desc: 'Frequent awakenings' },
                    { val: 3, title: '3 - Moderate', desc: 'Woke up 2-3 times' },
                    { val: 4, title: '4 - Good Sleep', desc: '1 minor interruption' },
                    { val: 5, title: '5 - Excellent', desc: 'Deep & uninterrupted' },
                  ].map((tile) => (
                    <div
                      key={tile.val}
                      className={`lifestyle-quality-tile ${sleepForm.quality === tile.val ? 'selected' : ''}`}
                      onClick={() => setSleepForm((p) => ({ ...p, quality: tile.val }))}
                    >
                      <span className="lifestyle-quality-num">{tile.val}★</span>
                      <span className="lifestyle-quality-desc">{tile.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lifestyle-bento-block slate-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill slate">
                      <FileText size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Sleep Observations</span>
                  </div>
                </div>

                <Input
                  id="sleep_notes"
                  label=""
                  placeholder="e.g. Woke up at 3 AM with headache, felt groggy in the morning..."
                  value={sleepForm.notes || ''}
                  onChange={(e) => setSleepForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div className="lifestyle-form-actions">
                <button
                  type="submit"
                  className="lifestyle-submit-btn"
                  disabled={sleepMutation.isPending}
                  style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', boxShadow: '0 6px 20px -4px rgba(79, 70, 229, 0.4)' }}
                >
                  {sleepMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Log Sleep Session</span>
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════
              TAB 3: TRIGGERS FORM
             ══════════════════════════════════════════════ */}
          {activeTab === 'triggers' && (
            <form onSubmit={handleTriggerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div className="lifestyle-form-banner">
                <div className="lifestyle-banner-left">
                  <div className="lifestyle-banner-icon-box" style={{ color: '#d97706' }}>
                    <Flame size={22} />
                  </div>
                  <div>
                    <div className="lifestyle-banner-tag" style={{ color: '#d97706' }}>
                      <span className="lifestyle-pulse-dot" style={{ background: '#d97706', boxShadow: '0 0 0 3px rgba(217, 119, 6, 0.25)' }} />
                      Environmental & Physical Exposure
                    </div>
                    <h2 className="lifestyle-banner-title">Log Suspected Trigger</h2>
                    <p className="lifestyle-banner-sub">
                      Track environmental, dietary, and psychological stress factors that lower seizure threshold.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lifestyle-bento-block amber-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill amber">
                      <Zap size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Trigger Category & Time</span>
                  </div>
                </div>

                <div className="lifestyle-row-2col">
                  <div className="lifestyle-field-group">
                    <Select
                      id="trigger_name"
                      label="Trigger Category"
                      value={triggerForm.trigger_name}
                      onChange={(val) => setTriggerForm((p) => ({ ...p, trigger_name: val }))}
                      options={[
                        { value: 'Sleep Deprivation', label: 'Sleep Deprivation (Late bedtime, inadequate rest)' },
                        { value: 'Emotional Stress', label: 'Emotional Stress (High anxiety, mental tension, panic)' },
                        { value: 'Flashing Lights / Strobe', label: 'Photosensitivity / Flashing Lights (Screen in dark, strobe lights)' },
                        { value: 'Fever or Illness', label: 'Fever or Illness (Infection, elevated body temperature)' },
                        { value: 'Missed Medication Dose', label: 'Missed Medication Dose (Late or skipped prescription)' },
                        { value: 'Dehydration', label: 'Dehydration & Missed Meals (Fasting, inadequate hydration)' },
                        { value: 'Caffeine / Alcohol', label: 'Excessive Caffeine (Heavy tea, coffee, energy drinks)' },
                        { value: 'Physical Exhaustion', label: 'Physical Exhaustion (Overexertion, intense fatigue)' },
                      ]}
                    />
                  </div>

                  <div className="lifestyle-field-group">
                    <Input
                      id="trigger_time"
                      type="datetime-local"
                      label="Time Encountered"
                      required
                      value={triggerForm.occurred_at}
                      onChange={(e) => setTriggerForm((p) => ({ ...p, occurred_at: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Severity Tiles */}
              <div className="lifestyle-bento-block amber-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill amber">
                      <Flame size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Severity Level (1-5)</span>
                  </div>
                  <span className="lifestyle-bento-sub">Select subjective impact level</span>
                </div>

                <div className="lifestyle-severity-tiles">
                  {[
                    { val: 1, title: '1', desc: 'Very Mild' },
                    { val: 2, title: '2', desc: 'Mild' },
                    { val: 3, title: '3', desc: 'Moderate' },
                    { val: 4, title: '4', desc: 'Strong' },
                    { val: 5, title: '5', desc: 'Severe Warning' },
                  ].map((tile) => (
                    <div
                      key={tile.val}
                      className={`lifestyle-severity-tile ${triggerForm.severity === tile.val ? 'selected' : ''}`}
                      onClick={() => setTriggerForm((p) => ({ ...p, severity: tile.val }))}
                    >
                      <span className="lifestyle-severity-num">{tile.val}</span>
                      <span className="lifestyle-severity-desc">{tile.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lifestyle-bento-block slate-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill slate">
                      <FileText size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Context & Notes</span>
                  </div>
                </div>

                <Input
                  id="trigger_notes"
                  label=""
                  placeholder="e.g. Used smartphone for 3 hours in pitch-dark room, had high stress at work..."
                  value={triggerForm.notes || ''}
                  onChange={(e) => setTriggerForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              <div className="lifestyle-form-actions">
                <button
                  type="submit"
                  className="lifestyle-submit-btn"
                  disabled={triggerMutation.isPending}
                  style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', boxShadow: '0 6px 20px -4px rgba(217, 119, 6, 0.4)' }}
                >
                  {triggerMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Record Trigger</span>
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════
              TAB 4: DIET & HABITS FORM
             ══════════════════════════════════════════════ */}
          {activeTab === 'habits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              <div className="lifestyle-form-banner">
                <div className="lifestyle-banner-left">
                  <div className="lifestyle-banner-icon-box">
                    <Monitor size={22} />
                  </div>
                  <div>
                    <div className="lifestyle-banner-tag">
                      <span className="lifestyle-pulse-dot" />
                      Daily Habits & Environment
                    </div>
                    <h2 className="lifestyle-banner-title">Diet & Digital Screen Habits</h2>
                    <p className="lifestyle-banner-sub">
                      Monitor daily screen exposure, meal regularity, and nutritional routine to build AI health telemetry.
                    </p>
                  </div>
                </div>
              </div>

              <div className="lifestyle-bento-block emerald-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill emerald">
                      <Monitor size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Daily Digital Screen Exposure</span>
                  </div>
                </div>

                <div className="lifestyle-field-group">
                  <Input
                    id="screen_hours"
                    type="number"
                    label="Daily Total Screen Time (Hours)"
                    min={0}
                    max={24}
                    value={screenHours}
                    onChange={(e) => setScreenHours(Number(e.target.value))}
                  />
                  <span className="lifestyle-field-hint">Total hours spent on smartphone, computer, or TV today.</span>
                </div>
              </div>

              <div className="lifestyle-bento-block emerald-theme">
                <div className="lifestyle-bento-header">
                  <div className="lifestyle-bento-title-wrap">
                    <div className="lifestyle-bento-icon-pill emerald">
                      <CheckCircle2 size={15} />
                    </div>
                    <span className="lifestyle-bento-title">Daily Compliance Checkboxes</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <label className={`lifestyle-habit-card ${nightExposure ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={nightExposure}
                      onChange={(e) => setNightExposure(e.target.checked)}
                      style={{ accentColor: 'var(--color-primary)', marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px' }}>Screen used late at night in a dark room</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Blue light in darkness stimulates optic pathways and can elevate cortical excitability.
                      </p>
                    </div>
                  </label>

                  <label className={`lifestyle-habit-card ${ketoCompliant ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={ketoCompliant}
                      onChange={(e) => setKetoCompliant(e.target.checked)}
                      style={{ accentColor: 'var(--color-primary)', marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px' }}>Timely meals & medical diet maintained</strong>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Maintained regular meal intervals and followed physician dietary guidelines.
                      </p>
                    </div>
                  </label>

                  <label className={`lifestyle-habit-card ${alcoholConsumed ? 'checked danger' : ''}`}>
                    <input
                      type="checkbox"
                      checked={alcoholConsumed}
                      onChange={(e) => setAlcoholConsumed(e.target.checked)}
                      style={{ accentColor: 'var(--color-error)', marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: alcoholConsumed ? 'var(--color-error)' : 'inherit' }}>
                        Alcohol or high-stimulant energy drinks consumed
                      </strong>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Known neurological irritants that can lower seizure thresholds.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="lifestyle-form-actions">
                <button
                  type="button"
                  className="lifestyle-submit-btn"
                  onClick={() => habitsMutation.mutate()}
                  disabled={habitsMutation.isPending}
                >
                  {habitsMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>Save Daily Habits</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════
            BOTTOM SECTION: RECENT HEALTH HISTORY STREAM
           ══════════════════════════════════════════════ */}
        <div className="lifestyle-history-section">
          <div className="lifestyle-history-header">
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 800 }}>Recent Health History</h3>
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {filteredHistory.length} total clinical entries recorded. Filter by category or navigate past records.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="lifestyle-filter-pills">
              <button
                type="button"
                className={`lifestyle-filter-pill ${historyFilter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setHistoryFilter('all');
                  setHistoryPage(1);
                }}
              >
                All ({unifiedHistory.length})
              </button>
              <button
                type="button"
                className={`lifestyle-filter-pill ${historyFilter === 'seizures' ? 'active' : ''}`}
                onClick={() => {
                  setHistoryFilter('seizures');
                  setHistoryPage(1);
                }}
              >
                ⚡ Seizures ({seizureLogs.length})
              </button>
              <button
                type="button"
                className={`lifestyle-filter-pill ${historyFilter === 'sleep' ? 'active' : ''}`}
                onClick={() => {
                  setHistoryFilter('sleep');
                  setHistoryPage(1);
                }}
              >
                🌙 Sleep ({sleepLogs?.items?.length || 0})
              </button>
              <button
                type="button"
                className={`lifestyle-filter-pill ${historyFilter === 'triggers' ? 'active' : ''}`}
                onClick={() => {
                  setHistoryFilter('triggers');
                  setHistoryPage(1);
                }}
              >
                ⚠️ Triggers ({triggerLogs?.items?.length || 0})
              </button>
            </div>
          </div>

          {/* Records Stream Grid */}
          <div className="lifestyle-history-cards-grid">
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                className={`lifestyle-history-card ${
                  item.type === 'seizure' ? 'seizure-type' : item.type === 'sleep' ? 'sleep-type' : 'trigger-type'
                }`}
              >
                <div className="lifestyle-card-top">
                  <span className={`lifestyle-card-title ${item.type}`}>
                    {item.type === 'seizure' && '⚡ '}
                    {item.type === 'sleep' && '🌙 '}
                    {item.type === 'trigger' && '⚠️ '}
                    {item.title}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      className="glass-badge"
                      style={{
                        fontSize: '10px',
                        padding: '3px 9px',
                        background: '#ffffff',
                        fontWeight: 700,
                        color: item.type === 'seizure' ? '#dc2626' : item.type === 'sleep' ? '#4f46e5' : '#d97706',
                        border: '1px solid rgba(0,0,0,0.08)',
                      }}
                    >
                      {item.badgeText}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          id: item.rawId,
                          type: item.type,
                          name: item.title,
                        })
                      }
                      title="Delete entry"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-text-placeholder)',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 140ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#dc2626';
                        e.currentTarget.style.background = 'rgba(220, 38, 38, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-placeholder)';
                        e.currentTarget.style.background = 'none';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {item.notes && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-text-secondary)',
                      fontStyle: 'italic',
                      lineHeight: 1.4,
                      background: 'rgba(255,255,255,0.85)',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0,0,0,0.04)',
                    }}
                  >
                    "{item.notes}"
                  </div>
                )}

                <div className="lifestyle-card-meta">
                  <span>{item.subtitle}</span>
                  <span>
                    {item.date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    ·{' '}
                    {item.date.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}

            {paginatedItems.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 'var(--space-8)',
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-xs)',
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                No records found for this filter. Use the form above to record new health events.
              </div>
            )}
          </div>

          {/* ── Pagination Navigation Bar ── */}
          {filteredHistory.length > pageSize && (
            <div className="lifestyle-pagination-bar">
              <span>
                Page {historyPage} of {totalPages} ({filteredHistory.length} items)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="lifestyle-page-btn"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage <= 1}
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  className="lifestyle-page-btn"
                  onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                  disabled={historyPage >= totalPages}
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete Health Record"
        description={
          deleteTarget
            ? `Are you sure you want to delete this ${deleteTarget.name} entry? This will remove the record from your clinical telemetry history.`
            : ''
        }
        confirmText="Delete Entry"
        confirmVariant="danger"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
