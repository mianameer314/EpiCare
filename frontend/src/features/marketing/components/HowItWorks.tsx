/**
 * HowItWorks — 3-step editorial scroll narrative with skeuomorphic preview cards
 */
import { useState } from 'react';
import { UploadCloud, Activity, CalendarCheck2, ChevronRight, Check } from 'lucide-react';
import { Reveal } from './MarketingMotion';

const STEPS = [
  {
    id: 1,
    icon: UploadCloud,
    badge: 'Step 01 — Validation',
    title: 'Bring your EEG into focus',
    description:
      'Upload standard EDF or CSV recordings and review real-time channel validation details before AI-assisted processing.',
    preview: {
      label: 'EDF Telemetry Validation',
      tag: 'Format: European Data Format',
      items: [
        { name: '19-Channel 10-20 Montage', status: 'Verified' },
        { name: 'Sampling Rate: 256 Hz', status: 'Optimal' },
        { name: 'Duration: 22 Minutes', status: 'Complete' },
        { name: 'Signal Quality Score', status: '98.4%' },
      ],
      note: 'Ready for AI-assisted pattern summarization',
    },
  },
  {
    id: 2,
    icon: Activity,
    badge: 'Step 02 — Signal Analysis',
    title: 'See the signal more clearly',
    description:
      'Receive structured, non-diagnostic AI summaries designed to highlight notable waveform patterns for doctor discussion.',
    preview: {
      label: 'AI-Assisted Signal Summary',
      tag: 'Model Context: Spectral Telemetry',
      items: [
        { name: 'Interictal Spike Activity', status: 'Context Logged' },
        { name: 'Dominant Rhythms (Alpha/Theta)', status: 'Quantified' },
        { name: 'Data Confidence Metric', status: 'High (0.94)' },
        { name: 'Physician Report PDF', status: 'Ready to Export' },
      ],
      note: 'Designed for review with your neurologist',
    },
  },
  {
    id: 3,
    icon: CalendarCheck2,
    badge: 'Step 03 — Lifestyle Context',
    title: 'Connect the everyday context',
    description:
      'Log AED medications, sleep duration, stress factors, and potential triggers to build a comprehensive history.',
    preview: {
      label: 'Patient Care History',
      tag: 'Unified Timeline',
      items: [
        { name: 'AED Adherence Streak', status: '14 Days 100%' },
        { name: 'Sleep Average (7-Day)', status: '7h 42m Stabilized' },
        { name: 'Identified Triggers Logged', status: '3 Factor Notes' },
        { name: 'Doctor Network Sharing', status: 'Encrypted Sync' },
      ],
      note: 'Notice lifestyle correlations with confidence',
    },
  },
] as const;

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(1);

  return (
    <section id="how-it-works" className="mk-how-section" aria-labelledby="how-heading">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-header">
            <div className="mk-eyebrow-badge">
              <span>Intuitive Workflow</span>
            </div>
            <h2 id="how-heading" className="mk-section-title">
              From complex signal to calm understanding,<br className="mk-br-desktop" /> in three clear steps.
            </h2>
          </div>
        </Reveal>

        <div className="mk-how-grid">
          {/* Left: Step navigation tabs */}
          <div className="mk-how-nav" role="tablist" aria-label="Steps">
            {STEPS.map((step) => (
              <Reveal key={step.id} delay={step.id * 0.08}>
                <button
                  role="tab"
                  aria-selected={activeStep === step.id}
                  aria-controls={`step-panel-${step.id}`}
                  className={`mk-how-step mk-skeuo-tab ${activeStep === step.id ? 'mk-how-step--active' : ''}`}
                  onClick={() => setActiveStep(step.id)}
                >
                  <div className="mk-how-step-number">
                    <span>0{step.id}</span>
                  </div>
                  <div className="mk-how-step-content">
                    <span className="mk-how-step-badge">{step.badge}</span>
                    <h3 className="mk-how-step-title">{step.title}</h3>
                    <p className="mk-how-step-desc">{step.description}</p>
                  </div>
                  <ChevronRight
                    size={16}
                    className="mk-how-step-arrow"
                    aria-hidden="true"
                  />
                </button>
              </Reveal>
            ))}
          </div>

          {/* Right: Skeuomorphic Preview panel */}
          <Reveal className="mk-how-preview-wrap" delay={0.2}>
            {STEPS.map((step) => (
              <div
                key={step.id}
                id={`step-panel-${step.id}`}
                role="tabpanel"
                aria-labelledby={`step-tab-${step.id}`}
                className={`mk-how-preview ${activeStep === step.id ? 'mk-how-preview--active' : ''}`}
              >
                <div className="mk-how-preview-card mk-skeuo-card">
                  <div className="mk-how-preview-header">
                    <div className="mk-how-preview-title-row">
                      <div className="mk-card-icon-pill mk-icon-emerald">
                        <step.icon size={16} />
                      </div>
                      <div>
                        <span className="mk-how-preview-label">{step.preview.label}</span>
                        <span className="mk-how-preview-tag">{step.preview.tag}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mk-how-preview-body">
                    {step.preview.items.map((item) => (
                      <div key={item.name} className="mk-how-preview-row">
                        <div className="mk-how-item-name">
                          <Check size={14} className="mk-how-check-icon" />
                          <span>{item.name}</span>
                        </div>
                        <span className="mk-how-status-badge">{item.status}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mk-how-preview-footer">
                    <span className="mk-how-note-dot" />
                    <span>{step.preview.note}</span>
                  </div>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
