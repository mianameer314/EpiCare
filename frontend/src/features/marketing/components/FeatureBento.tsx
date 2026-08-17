/**
 * FeatureBento — Responsive GSAP Pinned Stacked-Card Scrollytelling
 * ===================================================================
 * Desktop (1024px+): True GSAP ScrollTrigger pinned scrollytelling with clean card focus (no ghost cards behind).
 * Mobile (<1024px):   Sequential vertical card flow with whileInView reveals.
 * Reduced Motion:     Accessible static layout.
 */
import { useRef, useState, useLayoutEffect } from 'react';
import {
  Activity, FileText, Pill, HeartHandshake, Moon, TreePine,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Reveal } from './MarketingMotion';
import { RemoteImage } from './RemoteMedia';
import { media } from '../media';
import type { LucideIcon } from 'lucide-react';
import type { RemoteMediaItem } from '../media';

gsap.registerPlugin(ScrollTrigger);

/* ── Card Data with 6 Verified HD Photos & Chips ── */
interface StoryCard {
  id: string;
  step: string;
  icon: LucideIcon;
  badge: string;
  title: string;
  desc: string;
  image: RemoteMediaItem;
  chips: string[];
}

const STORY_CARDS: StoryCard[] = [
  {
    id: 'eeg',
    step: '01',
    icon: Activity,
    badge: 'Core Telemetry',
    title: 'EEG analysis, made easier to review',
    desc: 'Upload supported EDF/CSV files and follow a clear validation-to-report flow designed for calm clinician review.',
    image: media.eegBento,
    chips: ['19 Channels', '256 Hz Frequency', 'EDF+ 10-20 Standard'],
  },
  {
    id: 'reports',
    step: '02',
    icon: FileText,
    badge: 'Documentation',
    title: 'Structured clinical reports',
    desc: 'See data quality metrics, model context, and key observations summarized without overwhelming medical jargon.',
    image: media.reportsBento,
    chips: ['99.2% Artifact Filter', '0.94 Confidence', 'Baseline Stabilized'],
  },
  {
    id: 'meds',
    step: '03',
    icon: Pill,
    badge: 'Medication Safety',
    title: 'AED adherence & schedule routines',
    desc: 'Log prescriptions, set refill alerts, and track consistency streaks to stay organized every single day.',
    image: media.medsBento,
    chips: ['🔥 14-Day Streak', 'Keppra 500mg (AM)', 'Lamictal 200mg (PM)'],
  },
  {
    id: 'lifestyle',
    step: '04',
    icon: HeartHandshake,
    badge: 'Holistic Context',
    title: 'Lifestyle & trigger journaling',
    desc: 'Log stress factors, hydration, and sensory triggers in seconds to connect everyday habits to your wellbeing.',
    image: media.lifestyleBento,
    chips: ['💧 2.4L Hydration', '☀️ 45m Daylight', '🧘 Stress: Low'],
  },
  {
    id: 'sleep',
    step: '05',
    icon: Moon,
    badge: 'Threshold Stability',
    title: 'Sleep quality & rest patterns',
    desc: 'Monitor sleep duration and circadian consistency to protect and stabilize your personal seizure threshold.',
    image: media.sleepBento,
    chips: ['🌙 7h 48m Rest', '📈 94% Consistency', 'Restorative Sleep'],
  },
  {
    id: 'wellness',
    step: '06',
    icon: TreePine,
    badge: 'Mindful Care',
    title: 'Daily routine & calm movement',
    desc: 'Track gentle exercise, outdoor light, and recovery days for long-term health tracking.',
    image: media.natureWalk,
    chips: ['🌲 35m Nature Walk', '✨ Cortisol Reset', 'Gentle Movement'],
  },
];

/* ── Card Content Body ── */
function CardBody({ card }: { card: StoryCard }) {
  const Icon = card.icon;
  return (
    <>
      <div className="sc-card-top">
        <div className="mk-card-icon-pill mk-icon-emerald" aria-hidden="true">
          <Icon size={17} />
        </div>
        <span className="sc-card-badge">{card.badge}</span>
      </div>

      <h3 className="sc-card-title">{card.title}</h3>
      <p className="sc-card-desc">{card.desc}</p>

      {/* Crystal Clear High-Res Image Frame with Floating Chips */}
      <div className="sc-visual-image-wrap">
        <RemoteImage media={card.image} className="sc-visual-image" />
        <div className="sc-visual-image-overlay">
          <div className="sc-image-chips">
            {card.chips.map((chip, i) => (
              <span key={i} className="sc-chip">{chip}</span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════
   DESKTOP — GSAP Pinned Stacked Scrollytelling
   ════════════════════════════════════════════════ */
function DesktopPinnedStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (prefersReducedMotion) return;

    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 1024px)', () => {
        const cards = gsap.utils.toArray<HTMLElement>('.sc-desktop-card', stage);
        const totalCards = cards.length;

        // Position initial cards: card 0 in place, rest offscreen below with 0 opacity
        cards.forEach((card, i) => {
          if (i > 0) {
            gsap.set(card, { yPercent: 110, opacity: 0, zIndex: i });
          } else {
            gsap.set(card, { yPercent: 0, opacity: 1, zIndex: 10 });
          }
        });

        const restDuration = 0.8;
        const transitionDuration = 1.0;
        let currentTime = 0;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=3200', // Increased scroll distance for smoother reads
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const cycle = restDuration + transitionDuration;
              const totalTime = totalCards * restDuration + (totalCards - 1) * transitionDuration;
              const time = self.progress * totalTime;
              const idx = Math.min(
                totalCards - 1,
                Math.max(0, Math.round(time / cycle))
              );
              setActiveIndex(idx);
            },
          },
        });

        // Rest for card 0
        tl.to({}, { duration: restDuration }, currentTime);
        currentTime += restDuration;

        // Add timeline steps for remaining cards
        for (let i = 1; i < totalCards; i++) {
          // Bring in card i smoothly
          tl.fromTo(
            cards[i],
            { yPercent: 110, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              zIndex: 10 + i,
              ease: 'power2.out',
              duration: transitionDuration,
            },
            currentTime
          );

          // Completely fade out the previous card
          tl.to(
            cards[i - 1],
            {
              yPercent: -10,
              scale: 0.96,
              opacity: 0,
              ease: 'power2.out',
              duration: transitionDuration * 0.9,
            },
            currentTime
          );

          currentTime += transitionDuration;

          // Rest for card i
          tl.to({}, { duration: restDuration }, currentTime);
          currentTime += restDuration;
        }
      });

      return () => mm.revert();
    }, sectionRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  // Handle both click and hover on 1-6 module steps
  const handleStepJump = (index: number) => {
    setActiveIndex(index);
    if (!sectionRef.current) return;
    const st = ScrollTrigger.getAll().find((t) => t.trigger === sectionRef.current);
    if (st) {
      const restDuration = 0.8;
      const transitionDuration = 1.0;
      const cycle = restDuration + transitionDuration;
      const totalCards = STORY_CARDS.length;
      const totalTime = totalCards * restDuration + (totalCards - 1) * transitionDuration;
      
      // Target the center of the rest period for the hovered/clicked card
      const targetTime = index * cycle + (restDuration / 2);
      const progress = targetTime / totalTime;
      
      const scrollPos = st.start + progress * (st.end - st.start);
      window.scrollTo({ top: scrollPos, behavior: 'smooth' });
    }
  };

  return (
    <section
      ref={sectionRef}
      className="sc-desktop-section"
      aria-label="Interactive Care Modules"
    >
      <div className="sc-desktop-layout">
        {/* Left Column: Heading & Interactive Stepper */}
        <div className="sc-desktop-text-col">
          <div className="mk-eyebrow-badge">
            <span>Comprehensive Care Modules</span>
          </div>
          <h2 className="mk-section-title sc-desktop-heading">
            Everything in one calm place,<br /> designed with tactile clarity.
          </h2>
          <p className="sc-desktop-sub">
            Scroll smoothly or hover over any module to explore your neurology telemetry stack.
          </p>

          <div className="sc-step-nav" role="tablist">
            {STORY_CARDS.map((card, i) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleStepJump(i)}
                onMouseEnter={() => handleStepJump(i)}
                className={`sc-step-item ${i === activeIndex ? 'sc-step-item--active' : ''}`}
                aria-selected={i === activeIndex}
                role="tab"
              >
                <span className="sc-step-num">{card.step}</span>
                <span className="sc-step-label">{card.title}</span>
              </button>
            ))}
          </div>

          <div className="sc-stepper-counter">
            <span className="sc-stepper-count">MODULE {activeIndex + 1} OF {STORY_CARDS.length}</span>
          </div>
        </div>

        {/* Right Column: Stacked Card Stage */}
        <div className="sc-desktop-stage-col">
          <div ref={stageRef} className="sc-card-stage">
            {STORY_CARDS.map((card) => (
              <div
                key={card.id}
                className="sc-desktop-card mk-skeuo-card"
              >
                <CardBody card={card} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════
   MOBILE — Sequential Vertical Card Flow
   ════════════════════════════════════════════════ */
function MobileStoryCard({ card }: { card: StoryCard }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.35,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="sc-mobile-card mk-skeuo-card"
    >
      <span className="sc-mobile-step">MODULE {card.step}</span>
      <CardBody card={card} />
    </motion.article>
  );
}

function MobileSequentialStory() {
  return (
    <section className="sc-mobile-section" aria-labelledby="sc-mobile-heading">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-header">
            <div className="mk-eyebrow-badge">
              <span>Comprehensive Care Modules</span>
            </div>
            <h2 id="sc-mobile-heading" className="mk-section-title">
              Everything in one calm place,<br /> designed with tactile clarity.
            </h2>
          </div>
        </Reveal>

        <div className="sc-mobile-list">
          {STORY_CARDS.map((card) => (
            <MobileStoryCard key={card.id} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════
   EXPORT — Responsive Shell
   ════════════════════════════════════════════════ */
export function FeatureBento() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <MobileSequentialStory />;
  }

  return (
    <section id="features" className="sc-features-root">
      {/* Desktop GSAP Pinned Story — Active at 1024px+ */}
      <div className="sc-show-desktop">
        <DesktopPinnedStory />
      </div>

      {/* Mobile/Tablet Sequential Flow — Active below 1024px */}
      <div className="sc-show-mobile">
        <MobileSequentialStory />
      </div>
    </section>
  );
}
