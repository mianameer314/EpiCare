/**
 * SafetySection — AI transparency section with deep forest green background
 * and skeuomorphic dark glass cards.
 */
import { Eye, Brain, Stethoscope, ShieldCheck } from 'lucide-react';
import { Reveal } from './MarketingMotion';

const COLUMNS = [
  {
    icon: Eye,
    title: 'What EpiCare helps you organize',
    items: [
      'Raw EDF & CSV EEG files with channel validation status',
      'Daily AED medication schedules & adherence streaks',
      'Sleep metrics, circadian consistency & rest duration',
      'Personal seizure logs, auras & subjective trigger notes',
    ],
  },
  {
    icon: Brain,
    title: 'What AI-assisted summaries indicate',
    items: [
      'Structured observations of prominent waveform patterns',
      'Data quality indicators and signal-to-noise confidence',
      'Correlation overviews between sleep, stress and logged events',
      'Clear highlight summaries formatted for your next appointment',
    ],
  },
  {
    icon: Stethoscope,
    title: 'What requires professional care',
    items: [
      'Clinical diagnosis of epilepsy or neurological conditions',
      'Adjusting or prescribing antiepileptic medications (AEDs)',
      'Immediate emergency medical intervention or status epilepticus triage',
      'Definitive clinical interpretation of diagnostic EEG recordings',
    ],
  },
] as const;

export function SafetySection() {
  return (
    <section id="safety" className="mk-safety-section" aria-labelledby="safety-heading">
      <div className="mk-container">
        <Reveal>
          <div className="mk-safety-header">
            <div className="mk-safety-badge">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Ethical AI Boundaries &amp; Clinical Safety</span>
            </div>
            <h2 id="safety-heading" className="mk-safety-title">
              AI should make information clearer—<br className="mk-br-desktop" />never make clinical decisions for you.
            </h2>
          </div>
        </Reveal>

        <div className="mk-safety-grid">
          {COLUMNS.map((col, i) => (
            <Reveal key={col.title} delay={i * 0.1} className="mk-safety-col mk-skeuo-dark-card">
              <div className="mk-safety-col-icon" aria-hidden="true">
                <col.icon size={20} />
              </div>
              <h3 className="mk-safety-col-title">{col.title}</h3>
              <ul className="mk-safety-col-list">
                {col.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mk-safety-disclaimer mk-skeuo-dark-glass">
            <p>
              <strong>Important Medical Notice:</strong> EpiCare is an AI-assisted health tracking and data organization platform. It does not provide medical diagnoses, confirm seizures, predict onset times, or replace qualified neurologists and emergency services. In an emergency, always call 1122 or your local emergency dispatch.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div className="mk-safety-cta">
            <a href="#faq" className="mk-btn mk-btn-outline-light mk-btn-skeuo">
              <span>Read complete safety &amp; FAQ guidelines</span>
            </a>
          </div>
        </Reveal>

        {/* Ambient forest waveform */}
        <div className="mk-safety-signal" aria-hidden="true">
          <svg viewBox="0 0 800 100" fill="none">
            <path
              d="M0 50 Q50 20 100 50 T200 50 T300 30 T350 70 T400 45 T500 50 T600 40 T700 55 T800 50"
              stroke="rgba(198, 231, 208, 0.12)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </section>
  );
}
