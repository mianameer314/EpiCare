import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { dashboardApi } from '../../api/dashboard';
import { seizuresApi } from '../../api/seizures';
import { RiskIndicator } from './components/RiskIndicator';
import { MedicationCountdown } from './components/MedicationCountdown';
import { SeizureChart } from './components/SeizureChart';
import { SOSButton } from './components/SOSButton';
import { QuickActions } from './components/QuickActions';
import { SessionsPreview } from './components/SessionsPreview';
import { useAuth } from '../../hooks/useAuth';
import { Activity, Sparkles, Moon, BrainCircuit } from 'lucide-react';
import { NotificationPermissionBanner } from '../../components/shared/NotificationPermissionBanner';
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

export function PatientDashboard() {
  const { user } = useAuth();

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
  const firstName = user?.full_name?.split(' ')[0] || '';
  const displayName = user?.full_name?.toUpperCase() || firstName.toUpperCase() || 'PATIENT';

  return (
    <div className="dashboard-page">
      {/* ── Push Notification Permission Prompt ── */}
      <NotificationPermissionBanner />

      {/* ── Header ── */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="dashboard-greeting">
          <div className="dashboard-pre-title">
            <span className="live-status-dot" />
            <span>CLINICAL NEUROLOGY TELEMETRY · PATIENT CONSOLE</span>
          </div>
          <h1>
            {greeting}, <span className="hero-patient-name">{displayName}</span>
          </h1>
          <p className="dashboard-hero-sub">
            Your real-time neural bio-signals, automated seizure risk matrix, and clinical protocols are synchronized.
          </p>
        </div>
        <div className="dashboard-date glass-badge">
          <Activity size={14} className="date-icon-pulse" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </motion.div>

      {/* ── AI Recommendation Bar (if available) ── */}
      {stats?.recommendations && stats.recommendations.length > 0 && (
        <motion.div
          className="dashboard-rec-banner glass-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-4) var(--space-6)',
            marginBottom: 'var(--space-6)',
            background: 'var(--color-primary-50)',
            borderColor: 'var(--color-primary-100)',
          }}
        >
          <Sparkles size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--color-primary-dark)' }}>
            <strong>AI Care Insight:</strong> {stats.recommendations[0]}
          </div>
        </motion.div>
      )}

      {/* ── Bento Grid ── */}
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

        {/* Module E (2×1): Seizure Frequency Chart */}
        <motion.div
          className="bento-feature bento-item glass-card"
          variants={cardVariant}
        >
          <SeizureChart logs={seizureLogs || []} />
        </motion.div>

        {/* Module F (2×1): Quick Actions */}
        <motion.div
          className="bento-feature bento-item glass-card"
          variants={cardVariant}
        >
          <QuickActions />
        </motion.div>
      </motion.div>

      {/* ── Lifestyle Stats Row ── */}
      {stats && (stats.avg_sleep_hours > 0 || stats.avg_stress_level !== null) && (
        <motion.div
          className="dashboard-lifestyle-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-6)',
          }}
        >
          <div className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Moon size={22} style={{ color: 'var(--color-secondary)' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Avg Sleep (Past 30d)</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                {stats.avg_sleep_hours > 0 ? `${stats.avg_sleep_hours} hrs / night` : 'Not recorded'}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <BrainCircuit size={22} style={{ color: 'var(--color-primary)' }} />
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Total Recorded Seizures</div>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'bold', color: 'var(--color-text-main)' }}>
                {stats.total_seizures_all_time} total
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
