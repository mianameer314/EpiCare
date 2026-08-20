import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { dashboardApi } from '../../api/dashboard';
import { seizuresApi } from '../../api/seizures';
import { RiskIndicator } from './components/RiskIndicator';
import { MedicationCountdown } from './components/MedicationCountdown';
import { SeizureChart } from './components/SeizureChart';
import { SOSButton } from './components/SOSButton';
import { SessionsPreview } from './components/SessionsPreview';
import { useAuth } from '../../hooks/useAuth';
import {
  Activity,
  Moon,
  BrainCircuit,
  ShieldCheck,
  CalendarDays,
  ClipboardCheck,
  ArrowUpRight,
  CheckCircle2,
  ClipboardPlus,
  MessageSquareText,
  ArrowRight,
  Zap,
  FileSearch,
  Pill,
  HeartHandshake,
  Lightbulb,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationPermissionBanner } from '../../components/shared/NotificationPermissionBanner';
import { RecommendationCard } from '../recommendations/components/RecommendationCard';
import './PatientDashboard.css';

/* ────────────────────────────────────────────────────
   Patient Dashboard — Bento Grid Layout
   Wired to FastAPI /api/v1/dashboard & /api/v1/eeg/sessions
   ──────────────────────────────────────────────────── */

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ── Quick Actions Data ── */
const quickActions = [
  {
    to: '/eeg',
    icon: <BrainCircuit size={18} />,
    label: 'Upload EEG',
    color: 'var(--color-secondary)',
    bg: 'var(--color-secondary-50)',
  },
  {
    to: '/lifestyle',
    icon: <ClipboardPlus size={18} />,
    label: 'Log Seizure',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-bg)',
  },
  {
    to: '/medications',
    icon: <Pill size={18} />,
    label: 'Medications',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-50)',
  },
  {
    to: '/network',
    icon: <HeartHandshake size={18} />,
    label: 'Care Network',
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)',
  },
  {
    to: '/insights',
    icon: <Lightbulb size={18} />,
    label: 'Care Insights',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
  },
  {
    to: '/chat',
    icon: <MessageSquareText size={18} />,
    label: 'AI Chat',
    color: '#0969da',
    bg: 'rgba(9, 105, 218, 0.08)',
  },
];

export function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['eeg', 'sessions', 'recent'],
    queryFn: () => dashboardApi.getRecentSessions(1, 5),
  });

  const { data: seizureLogs } = useQuery({
    queryKey: ['seizures', 'manual'],
    queryFn: async () => {
      try {
        return await seizuresApi.getManualLogs();
      } catch {
        return [];
      }
    },
  });

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const greeting = getTimeGreeting();
  const displayName = user?.full_name?.toUpperCase() || 'PATIENT';
  const medicationAdherence = stats?.medication_adherence_percent ?? 0;
  const lastSeizureSummary = stats?.days_since_last_seizure == null
    ? 'No event logged'
    : stats.days_since_last_seizure === 0
      ? 'Today'
      : `${stats.days_since_last_seizure} days ago`;
  const primaryRecommendation = stats?.recommendations?.find(
    (recommendation) => recommendation.is_active && !recommendation.is_dismissed && Boolean(recommendation.action_url)
  );
  const recommendationIcon = primaryRecommendation?.action_url?.includes('/medications')
    ? <Pill size={17} />
    : primaryRecommendation?.action_url?.includes('/eeg')
      ? <BrainCircuit size={17} />
      : primaryRecommendation?.action_url?.includes('/insights')
        ? <Lightbulb size={17} />
        : <ClipboardCheck size={17} />;

  return (
    <div className="dashboard-page">
      {/* ── Push Notification Permission Prompt ── */}
      <NotificationPermissionBanner />

      {/* ── Header / Care Pulse ── */}
      <motion.div
        className="dashboard-hero-shell"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="dashboard-greeting">
          <div className="dashboard-pre-title">
            <span className="live-status-dot" />
            <span>YOUR CARE CONSOLE · PRIVATE &amp; SECURE</span>
          </div>
          <h1>
            {greeting}, <span className="hero-patient-name">{displayName}</span>
          </h1>
          <p className="dashboard-hero-sub">
            A calm overview of your recorded activity, medication routine, and care team support.
          </p>
          <div className="dashboard-context-row" aria-label="Dashboard status">
            <span className="dashboard-context-chip"><ShieldCheck size={14} /> Data protected</span>
            <span className="dashboard-context-chip"><CalendarDays size={14} /> Updated today</span>
            <span className="dashboard-context-chip"><CheckCircle2 size={14} /> Care plan active</span>
          </div>
        </div>
        <aside className="dashboard-care-pulse" aria-label="Care pulse summary">
          <div className="care-pulse-orbit" aria-hidden="true"><Activity size={20} /></div>
          <div className="care-pulse-copy">
            <span className="care-pulse-eyebrow"><Activity size={13} /> Care pulse</span>
            <strong>{statsLoading ? 'Preparing your view' : 'Your dashboard is up to date'}</strong>
            <span className="care-pulse-caption">Based on your latest recorded activity</span>
          </div>
          <div className="care-pulse-metrics">
            <div><span>Medication</span><strong>{medicationAdherence}%</strong></div>
            <div><span>Last event</span><strong>{lastSeizureSummary}</strong></div>
          </div>
        </aside>
      </motion.div>

      {primaryRecommendation && (
        <motion.div
          className="dashboard-next-step"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
        >
          <div className="next-step-icon">{recommendationIcon}</div>
          <div className="next-step-copy">
            <span className="next-step-label">{primaryRecommendation.category}</span>
            <strong>{primaryRecommendation.title}</strong>
            <span>{primaryRecommendation.body}</span>
          </div>
          <button
            type="button"
            className="next-step-action"
            onClick={() => primaryRecommendation.action_url && navigate(primaryRecommendation.action_url)}
          >
            <span>View action</span>
            <ArrowUpRight size={15} />
          </button>
        </motion.div>
      )}

      {/* ── AI Recommendation Bar (if available) ── */}
      {stats?.recommendations && stats.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {stats.recommendations.map(rec => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
            />
          ))}
        </motion.div>
      )}

      {/* ── Unified Seizure & Sleep Telemetry Summary Card ── */}
      <motion.div
        className="dashboard-unified-summary-card glass-card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {/* Metric 1: Manual Seizures */}
        <div className="dash-summary-item">
          <div className="dash-stat-icon" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            <ClipboardPlus size={20} />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Manual Seizures</span>
            <span className="dash-stat-value">{stats?.manual_seizures_all_time ?? 0}</span>
            <span className="dash-stat-hint">Self-reported events</span>
          </div>
        </div>

        <div className="dash-summary-divider" />

        {/* Metric 2: EEG-Detected Seizures */}
        <div className="dash-summary-item">
          <div className="dash-stat-icon" style={{ background: 'var(--color-secondary-50)', color: 'var(--color-secondary)' }}>
            <FileSearch size={20} />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">EEG Detected</span>
            <span className="dash-stat-value">{stats?.detected_seizures_all_time ?? 0}</span>
            <span className="dash-stat-hint">AI-classified from EEG</span>
          </div>
        </div>

        <div className="dash-summary-divider" />

        {/* Metric 3: Total Seizures */}
        <div className="dash-summary-item dash-summary-highlight">
          <div className="dash-stat-icon" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
            <Zap size={20} />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Total Seizures</span>
            <span className="dash-stat-value" style={{ color: 'var(--color-error)' }}>{stats?.total_seizures_all_time ?? 0}</span>
            <span className="dash-stat-hint">All-time combined</span>
          </div>
        </div>

        <div className="dash-summary-divider" />

        {/* Metric 4: Avg Sleep */}
        <div className="dash-summary-item">
          <div className="dash-stat-icon" style={{ background: 'rgba(124, 58, 237, 0.08)', color: '#7c3aed' }}>
            <Moon size={20} />
          </div>
          <div className="dash-stat-content">
            <span className="dash-stat-label">Avg Sleep</span>
            <span className="dash-stat-value">
              {stats && stats.avg_sleep_hours > 0 ? `${stats.avg_sleep_hours}h` : '—'}
            </span>
            <span className="dash-stat-hint">Past 30 days / night</span>
          </div>
        </div>
      </motion.div>

      {/* ── Care workspace ── */}
      <div className="dashboard-section-heading">
        <div>
          <span className="dashboard-section-kicker">Care workspace</span>
          <h2>See what matters, then choose your next move.</h2>
        </div>
        <span className="dashboard-section-note">Your records stay in your control.</span>
      </div>

      <motion.div

        className="bento-grid dashboard-grid"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Module A (2×2): EEG Sessions Preview */}
        <motion.div
          className="bento-hero bento-item glass-card"
          variants={cardVariant}
        >
          <SessionsPreview
            sessions={sessions?.items || []}
            totalSessions={sessions?.total || 0}
            isLoading={sessionsLoading}
          />
        </motion.div>

        {/* Module B (2×1): AI Risk Assessment */}
        <motion.div
          className="bento-feature bento-item glass-card"
          variants={cardVariant}
        >
          <RiskIndicator
            seizures30d={stats?.total_seizures_past_30_days ?? 0}
            daysSinceLastSeizure={stats?.days_since_last_seizure ?? null}
            isLoading={statsLoading}
          />
        </motion.div>

        {/* Module C (1×1): Medication Adherence & Streak */}
        <motion.div
          className="bento-standard bento-item glass-card"
          variants={cardVariant}
        >
          <MedicationCountdown
            adherencePercent={stats?.medication_adherence_percent ?? 0}
            dosesTaken={stats?.medications_taken ?? 0}
            dosesMissed={stats?.medications_missed ?? 0}
            streakDays={stats?.medication_streak ?? 0}
            isLoading={statsLoading}
          />
        </motion.div>

        {/* Module D (1×1): SOS Button */}
        <motion.div
          className="bento-standard bento-item glass-card sos-module"
          variants={cardVariant}
        >
          <SOSButton />
        </motion.div>

        {/* Module E (4×1): Seizure Frequency Chart */}
        <motion.div
          className="bento-feature bento-item glass-card bento-full-width"
          variants={cardVariant}
        >
          <SeizureChart logs={seizureLogs || []} />
        </motion.div>
      </motion.div>



      {/* ── Quick Actions — Full-Width Horizontal Row at Bottom ── */}
      <motion.div
        className="dashboard-quick-row"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        <div className="dash-quick-header">
          <h3>Quick Actions</h3>
        </div>
        <div className="dash-quick-grid">
          {quickActions.map((action) => (
            <button
              key={action.to}
              className="dash-quick-btn"
              onClick={() => navigate(action.to)}
              aria-label={action.label}
            >
              <div
                className="dash-quick-icon"
                style={{ background: action.bg, color: action.color }}
              >
                {action.icon}
              </div>
              <span className="dash-quick-label">{action.label}</span>
              <ArrowRight size={14} className="dash-quick-arrow" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
