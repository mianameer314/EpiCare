import { Pill, Flame, CheckCircle2 } from 'lucide-react';

/* ────────────────────────────────────────────────────
   Medication Summary — adherence percentage & streak
   ──────────────────────────────────────────────────── */

interface MedicationCountdownProps {
  adherencePercent: number;
  dosesTaken: number;
  dosesMissed: number;
  streakDays: number;
  isLoading: boolean;
}

export function MedicationCountdown({
  adherencePercent,
  dosesTaken,
  dosesMissed,
  streakDays,
  isLoading,
}: MedicationCountdownProps) {
  if (isLoading) {
    return (
      <div className="med-countdown">
        <div className="bento-header">
          <h3>Medications</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', flex: 1, justifyContent: 'center' }}>
          <div className="skeleton skeleton-circle" style={{ width: 48, height: 48 }} />
          <div className="skeleton skeleton-text" style={{ width: '50%' }} />
        </div>
      </div>
    );
  }

  const hasData = dosesTaken > 0 || dosesMissed > 0;

  return (
    <div className="med-countdown" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="bento-header">
        <h3>Medication</h3>
        {hasData && (
          <span className="glass-badge" style={{ color: 'var(--color-primary)' }}>
            {adherencePercent}% Adherence
          </span>
        )}
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--radius-full)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-primary-50)',
          color: 'var(--color-primary)',
          transition: 'all var(--transition-normal)',
        }}>
          {streakDays > 0 ? <Flame size={26} color="#d97706" /> : hasData ? <CheckCircle2 size={26} /> : <Pill size={26} />}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-family-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-main)',
            letterSpacing: 'var(--tracking-wide)',
          }}>
            {streakDays > 0 ? `${streakDays} Day Streak` : hasData ? `${dosesTaken} Doses Taken` : 'Daily Tracker'}
          </div>
          <p style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
            margin: 'var(--space-1) 0 0',
          }}>
            {hasData
              ? `${dosesTaken} taken · ${dosesMissed} missed`
              : 'Log your prescriptions & doses'}
          </p>
        </div>
      </div>
    </div>
  );
}
