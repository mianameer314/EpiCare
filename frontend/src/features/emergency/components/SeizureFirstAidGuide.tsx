import { ShieldCheck, ShieldAlert, AlertOctagon, HeartHandshake } from 'lucide-react';

/* ────────────────────────────────────────────────────
   Seizure First Aid Reference Guide
   ──────────────────────────────────────────────────── */

export function SeizureFirstAidGuide() {
  return (
    <div className="glass-card" style={{ padding: 'var(--space-6)' }}>
      <div className="bento-header" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <HeartHandshake size={20} style={{ color: 'var(--color-primary)' }} />
          <h3>Seizure First-Aid & Emergency Action Plan</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
        {/* DO's */}
        <div style={{ background: 'var(--color-success-bg)', border: '1px solid rgba(26, 127, 55, 0.2)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-success)', fontWeight: 'bold', marginBottom: 'var(--space-3)' }}>
            <ShieldCheck size={20} />
            <span>WHAT TO DO (STAY, SAFE, SIDE)</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-main)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li><strong>Stay Calm:</strong> Stay with the person until the seizure ends and consciousness returns.</li>
            <li><strong>Keep Safe:</strong> Ease them to the floor. Move away hard, sharp, or hazardous items.</li>
            <li><strong>Cushion Head:</strong> Put something soft and flat, like a folded jacket, under their head.</li>
            <li><strong>Turn on Side:</strong> Roll them gently onto one side (recovery position) to keep the airway clear.</li>
            <li><strong>Time the Event:</strong> Check your watch to measure the exact duration.</li>
          </ul>
        </div>

        {/* DON'Ts */}
        <div style={{ background: 'var(--color-error-bg)', border: '1px solid rgba(207, 34, 46, 0.2)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-error)', fontWeight: 'bold', marginBottom: 'var(--space-3)' }}>
            <ShieldAlert size={20} />
            <span>WHAT NOT TO DO (CRITICAL)</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-main)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li><strong>DO NOT hold the person down:</strong> Never restrain movement or try to stop jerking.</li>
            <li><strong>DO NOT put anything in their mouth:</strong> A person cannot swallow their tongue. Forcing objects can chip teeth or block airway.</li>
            <li><strong>DO NOT give CPR:</strong> People breathe on their own after a seizure ends.</li>
            <li><strong>DO NOT offer food or water:</strong> Wait until they are completely awake and alert.</li>
          </ul>
        </div>
      </div>

      {/* When to Call 911 / 1122 */}
      <div style={{
        marginTop: 'var(--space-4)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--color-warning-bg)',
        border: '1px solid var(--color-warning-glow)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
      }}>
        <AlertOctagon size={24} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', color: 'var(--color-text-main)', margin: '0 0 var(--space-1)' }}>
            When to Call Emergency Services (1122 / 911):
          </h4>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
            • Seizure lasts <strong>longer than 5 minutes</strong> (status epilepticus).<br />
            • A second seizure begins immediately without regaining consciousness.<br />
            • The person is injured, pregnant, in water, or has difficulty breathing afterward.<br />
            • It is the person's first known seizure.
          </p>
        </div>
      </div>
    </div>
  );
}
