/**
 * FAQ — Accessible accordion with tactile skeuomorphic cards and clear clinical answers
 */
import { useState, useCallback } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Reveal } from './MarketingMotion';

const FAQ_ITEMS = [
  {
    q: 'What can EpiCare help me manage on a daily basis?',
    a: 'EpiCare helps you organize validated EEG recordings, AED medication schedules, sleep duration and quality, stress metrics, and personal trigger logs in one unified workspace. It empowers you to see longitudinal trends and prepare structured summaries for appointments with your neurologist.',
  },
  {
    q: 'Does EpiCare diagnose epilepsy or confirm seizures?',
    a: 'No. EpiCare is an AI-assisted management and data tracking platform. It does not diagnose epilepsy, confirm seizure occurrences, or predict onset times. AI-assisted analysis provides structured pattern summaries to aid conversations with your licensed healthcare provider.',
  },
  {
    q: 'What EEG file formats can I upload and analyze?',
    a: 'EpiCare supports standard European Data Format (EDF/EDF+) files and standardized CSV EEG time-series recordings. Every upload passes through a preliminary signal validation engine to verify channel montage, duration, and sampling frequency before analysis.',
  },
  {
    q: 'How are AI-assisted EEG results structured?',
    a: 'Results are compiled into clear clinical summaries displaying signal quality scores, prominent rhythm observations (Alpha/Theta/Delta), identified spike morphology context, and model confidence ratings—all accompanied by clear limitation notices.',
  },
  {
    q: 'Can I log medications and track dose adherence?',
    a: 'Yes. You can enter active antiepileptic prescriptions (e.g., Levetiracetam, Lamotrigine, Valproate), configure AM/PM schedules, record daily intake with a single tap, and maintain adherence streaks to support treatment stability.',
  },
  {
    q: 'What should I do during an acute medical emergency?',
    a: 'In an acute emergency (such as a seizure lasting more than 5 minutes, repeated seizures without recovery, or difficulty breathing), call emergency medical services immediately (1122 or your local emergency dispatch).',
  },
  {
    q: 'How does the Emergency SOS feature work?',
    a: 'The Emergency SOS tool in this version of EpiCare is a simulated patient-safety utility. It enables quick one-tap alerts to pre-saved caretaker contacts with GPS coordinates, but does not connect directly to governmental 1122 dispatchers. Direct phone calls are always required in emergencies.',
  },
] as const;

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <section id="faq" className="mk-faq-section" aria-labelledby="faq-heading">
      <div className="mk-container mk-faq-container">
        <Reveal>
          <div className="mk-section-header">
            <div className="mk-eyebrow-badge">
              <HelpCircle size={14} aria-hidden="true" />
              <span>Frequently Asked Questions</span>
            </div>
            <h2 id="faq-heading" className="mk-section-title">
              Clear answers regarding privacy, capabilities, and safety.
            </h2>
          </div>
        </Reveal>

        <div className="mk-faq-list" role="list">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            const headingId = `faq-q-${i}`;
            const panelId = `faq-a-${i}`;

            return (
              <Reveal key={headingId} delay={i * 0.04}>
                <div className={`mk-faq-item mk-skeuo-card ${isOpen ? 'mk-faq-item--active' : ''}`} role="listitem">
                  <button
                    id={headingId}
                    className="mk-faq-trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(i)}
                  >
                    <span className="mk-faq-question">{item.q}</span>
                    <ChevronDown
                      size={18}
                      className={`mk-faq-chevron ${isOpen ? 'mk-faq-chevron--open' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headingId}
                    className={`mk-faq-panel ${isOpen ? 'mk-faq-panel--open' : ''}`}
                  >
                    <p className="mk-faq-answer">{item.a}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
