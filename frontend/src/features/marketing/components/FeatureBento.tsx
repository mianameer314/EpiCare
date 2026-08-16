/**
 * FeatureBento — Asymmetric 6-card bento grid with rich remote photography,
 * tactile skeuomorphic frosted glass cards, and smooth parallax feel.
 */
import {
  Activity, FileText, Pill, HeartHandshake, Moon, TreePine,
} from 'lucide-react';
import { StaggerReveal, StaggerItem } from './MarketingMotion';
import { RemoteImage, ImageCredit } from './RemoteMedia';
import { media } from '../media';

const FEATURES = [
  {
    id: 'eeg',
    icon: Activity,
    badge: 'Core Telemetry',
    title: 'EEG analysis, made easier to review',
    desc: 'Upload supported EDF/CSV files and follow a clear validation-to-report flow designed for calm clinician review.',
    large: true,
    hasSignal: true,
  },
  {
    id: 'reports',
    icon: FileText,
    badge: 'Documentation',
    title: 'Structured clinical reports',
    desc: 'See data quality metrics, model context, and key observations summarized without overwhelming medical jargon.',
  },
  {
    id: 'meds',
    icon: Pill,
    badge: 'Medication Safety',
    title: 'AED adherence & schedule routines',
    desc: 'Log prescriptions, set refill alerts, and track consistency streaks to stay organized every single day.',
  },
  {
    id: 'lifestyle',
    icon: HeartHandshake,
    badge: 'Holistic Context',
    title: 'Lifestyle & trigger journaling',
    desc: 'Log stress factors, hydration, and sensory triggers in seconds to connect everyday habits to your wellbeing.',
    image: media.lifestyleBento,
  },
  {
    id: 'sleep',
    icon: Moon,
    badge: 'Threshold Stability',
    title: 'Sleep quality & rest patterns',
    desc: 'Monitor sleep duration and circadian consistency to protect and stabilize your personal seizure threshold.',
    image: media.sleepBento,
  },
  {
    id: 'wellness',
    icon: TreePine,
    badge: 'Mindful Care',
    title: 'Daily routine & calm movement',
    desc: 'Track gentle exercise, outdoor light, and recovery days for long-term health tracking.',
    image: media.natureWalk,
  },
] as const;

export function FeatureBento() {
  return (
    <section id="features" className="mk-bento-section" aria-labelledby="features-heading">
      <div className="mk-container">
        <StaggerReveal>
          <StaggerItem>
            <div className="mk-section-header">
              <div className="mk-eyebrow-badge">
                <span>Comprehensive Care Modules</span>
              </div>
              <h2 id="features-heading" className="mk-section-title">
                Everything in one calm place,<br className="mk-br-desktop" /> designed with tactile clarity.
              </h2>
            </div>
          </StaggerItem>
        </StaggerReveal>

        <StaggerReveal className="mk-bento-grid" stagger={0.06}>
          {FEATURES.map((f) => (
            <StaggerItem
              key={f.id}
              className={`mk-bento-card mk-skeuo-card ${f.large ? 'mk-bento-card--large' : ''}`}
            >
              <div className="mk-bento-card-inner">
                {/* Header row */}
                <div className="mk-bento-card-top">
                  <div className="mk-card-icon-pill mk-icon-emerald" aria-hidden="true">
                    <f.icon size={18} />
                  </div>
                  <span className="mk-bento-badge">{f.badge}</span>
                </div>

                <h3 className="mk-bento-title">{f.title}</h3>
                <p className="mk-bento-desc">{f.desc}</p>

                {/* Large card: abstract signal visual */}
                {f.hasSignal && (
                  <div className="mk-bento-signal-box" aria-hidden="true">
                    <div className="mk-bento-telemetry-tags">
                      <span className="mk-tag-pill">EDF+ 10-20 Format</span>
                      <span className="mk-tag-pill">256 Hz Frequency</span>
                      <span className="mk-tag-pill">Confidence 0.94</span>
                    </div>
                    <svg viewBox="0 0 400 50" fill="none" className="mk-bento-wave-svg">
                      <path
                        d="M0 25 Q25 5 50 25 T100 25 T150 12 T175 38 T200 15 T250 25 T300 18 T350 32 L400 25"
                        stroke="var(--mk-primary)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        opacity="0.6"
                      />
                    </svg>
                  </div>
                )}

                {/* Image cards */}
                {f.image && (
                  <div className="mk-bento-image-wrap mk-skeuo-inner">
                    <RemoteImage
                      media={f.image}
                      className="mk-bento-image"
                    />
                    <div className="mk-bento-image-credit">
                      <ImageCredit credit={f.image.credit} />
                    </div>
                  </div>
                )}
              </div>
            </StaggerItem>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}
