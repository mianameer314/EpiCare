/**
 * SafetySection — Ethical AI Boundaries & Clinical Safety
 * =========================================================
 * Deep forest green glass cards on clean site background,
 * row-by-row synchronized checklist tick reveals, and 3D hover interactions.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  Eye, Stethoscope, ShieldCheck, CheckCircle2,
  AlertCircle, Lock, ArrowRight, FileSpreadsheet, Activity
} from 'lucide-react';
import { Reveal } from './MarketingMotion';

const SAFETY_PILLARS = [
  {
    id: 'organize',
    icon: Eye,
    theme: 'emerald',
    badge: 'Telemetry Organization',
    title: 'What EpiCare helps you organize',
    desc: 'Structured ingestion and visualization of your longitudinal health data.',
    items: [
      { text: 'Raw EDF & CSV EEG files with channel validation status', tag: 'Standard 10-20' },
      { text: 'Daily AED medication schedules & adherence streaks', tag: 'Refill Alerts' },
      { text: 'Sleep metrics, circadian consistency & rest duration', tag: 'Trend Tracking' },
      { text: 'Personal seizure logs, auras & subjective trigger notes', tag: 'Zero Loss' },
    ],
    footer: {
      icon: Lock,
      label: 'Local Encryption · HIPAA & GDPR Aligned',
    },
  },
  {
    id: 'summaries',
    icon: FileSpreadsheet,
    theme: 'cyan',
    badge: 'Telemetry Summaries',
    title: 'What AI-assisted summaries indicate',
    desc: 'Statistical feature extraction designed for calm clinical appointment prep.',
    items: [
      { text: 'Structured observations of prominent waveform patterns', tag: 'Confidence 0.94' },
      { text: 'Signal quality indicators and artifact-to-noise filtering', tag: '99.2% Clean' },
      { text: 'Correlation overviews between sleep, stress and logged events', tag: 'Multi-Modal' },
      { text: 'Clear highlight summaries formatted for your next appointment', tag: 'PDF Export' },
    ],
    footer: {
      icon: Activity,
      label: 'Deterministic Models · No Blackbox Guessing',
    },
  },
  {
    id: 'clinical',
    icon: Stethoscope,
    theme: 'amber',
    badge: 'Physician Exclusive',
    title: 'What requires professional care',
    desc: 'Medical authority remains strictly with certified neurologists and physicians.',
    items: [
      { text: 'Clinical diagnosis of epilepsy or neurological disorders', tag: 'Doctor Only' },
      { text: 'Adjusting, starting, or prescribing antiepileptic medications', tag: 'Prescription' },
      { text: 'Immediate emergency medical intervention & status epilepticus', tag: 'Call 1122 / 911' },
      { text: 'Definitive clinical interpretation of diagnostic EEG recordings', tag: 'Board Certified' },
    ],
    footer: {
      icon: AlertCircle,
      label: 'Never Replaces Clinical Neurology Practice',
    },
  },
];

const containerVariants:  Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function SafetySection() {
  const reduceMotion = useReducedMotion();

  // Helper for row-by-row synchronized item stagger
  const getItemDelay = (cardIdx: number, itemIdx: number) => {
    return 0.32 + itemIdx * 0.26 + cardIdx * 0.07;
  };

  return (
    <section id="safety" className="sf-section" aria-labelledby="safety-heading">
      <div className="mk-container sf-content-wrap">
        {/* Header with Live Status Badge */}
        <Reveal>
          <div className="sf-header">
            <div className="mk-eyebrow-badge">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>Ethical AI Boundaries &amp; Clinical Safety</span>
            </div>

            <h2 id="safety-heading" className="mk-section-title sf-title">
              AI should make information clearer—<br className="mk-br-desktop" />
              never make clinical decisions for you.
            </h2>

            <p className="sf-sub">
              EpiCare operates as a transparent telemetry companion. We strictly separate data organization from medical diagnosis.
            </p>
          </div>
        </Reveal>

        {/* 3 Pillars Grid — Cards enter, then points animate row by row */}
        <motion.div
          className="sf-grid"
          variants={reduceMotion ? undefined : containerVariants}
          initial={reduceMotion ? undefined : 'hidden'}
          whileInView={reduceMotion ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.15 }}
        >
          {SAFETY_PILLARS.map((pillar, cardIdx) => {
            const Icon = pillar.icon;
            const FooterIcon = pillar.footer.icon;

            return (
              <motion.article
                key={pillar.id}
                variants={reduceMotion ? undefined : cardVariants}
                whileHover={reduceMotion ? undefined : { y: -8, scale: 1.015 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
                className={`sf-card sf-card--${pillar.theme}`}
              >
                <div className="sf-card-header">
                  <div className={`sf-icon-wrap sf-icon--${pillar.theme}`}>
                    <Icon size={20} />
                  </div>
                  <span className="sf-card-badge">{pillar.badge}</span>
                </div>

                <h3 className="sf-card-title">{pillar.title}</h3>
                <p className="sf-card-desc">{pillar.desc}</p>

                <div className="sf-divider" />

                {/* 4 Points with spring-popping tick icons animated by row */}
                <ul className="sf-list">
                  {pillar.items.map((item, itemIdx) => {
                    const delay = getItemDelay(cardIdx, itemIdx);

                    return (
                      <motion.li
                        key={itemIdx}
                        className="sf-list-item"
                        initial={reduceMotion ? false : { opacity: 0, x: -14 }}
                        whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.1 }}
                        transition={{
                          duration: 0.4,
                          delay,
                          ease: [0.16, 1, 0.3, 1] as const,
                        }}
                      >
                        <motion.div
                          className="sf-item-bullet"
                          initial={reduceMotion ? false : { scale: 0, rotate: -45 }}
                          whileInView={reduceMotion ? undefined : { scale: 1, rotate: 0 }}
                          viewport={{ once: true, amount: 0.1 }}
                          transition={{
                            duration: 0.45,
                            delay,
                            type: 'spring',
                            stiffness: 380,
                            damping: 14,
                          }}
                        >
                          {pillar.theme === 'emerald' && <CheckCircle2 size={16} className="sf-item-icon--emerald" />}
                          {pillar.theme === 'cyan' && <CheckCircle2 size={16} className="sf-item-icon--cyan" />}
                          {pillar.theme === 'amber' && <AlertCircle size={16} className="sf-item-icon--amber" />}
                        </motion.div>

                        <div className="sf-item-content">
                          <span className="sf-item-text">{item.text}</span>
                          <span className="sf-item-tag">{item.tag}</span>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>

                <div className="sf-card-footer">
                  <FooterIcon size={14} className="sf-footer-icon" />
                  <span>{pillar.footer.label}</span>
                </div>
              </motion.article>
            );
          })}
        </motion.div>

        {/* Medical Notice Card */}
        <Reveal delay={1.4}>
          <div className="sf-notice-box">
            <div className="sf-notice-left">
              <div className="sf-notice-icon-box">
                <AlertCircle size={22} className="sf-notice-alert-icon" />
              </div>
              <div className="sf-notice-text">
                <h4 className="sf-notice-heading">Important Medical Notice</h4>
                <p className="sf-notice-body">
                  EpiCare is an AI-assisted health tracking and data organization platform. It does <strong>not</strong> provide medical diagnoses, confirm seizures, predict onset times, or replace qualified neurologists and emergency responders. In an acute emergency, always call <strong>1122</strong> or your local emergency dispatch immediately.
                </p>
              </div>
            </div>

            <div className="sf-notice-right">
              <a href="#faq" className="sf-notice-btn">
                <span>Read FAQ Guidelines</span>
                <ArrowRight size={15} />
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
