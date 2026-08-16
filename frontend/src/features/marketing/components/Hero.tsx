/**
 * Hero — Two-column editorial hero section with skeuomorphic depth,
 * authentic remote imagery, and tactile floating telemetry cards.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, CheckCircle2, Moon, Pill, Shield, Activity } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { SignalCanvas } from './SignalCanvas';
import { RemoteImage, ImageCredit } from './RemoteMedia';
import { media } from '../media';

export function Hero() {
  const reduceMotion = useReducedMotion();

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section className="mk-hero" aria-labelledby="hero-heading">
      <div className="mk-container mk-hero-grid">
        {/* Left: Editorial copy */}
        <div className="mk-hero-content">
          <motion.div className="mk-eyebrow-badge" {...fadeUp(0.05)}>
            <Activity size={14} className="mk-eyebrow-icon" aria-hidden="true" />
            <span>AI-Assisted Epilepsy Care</span>
          </motion.div>

          <motion.h1 id="hero-heading" className="mk-hero-title" {...fadeUp(0.15)}>
            Clarity for every part of your epilepsy&nbsp;journey.
          </motion.h1>

          <motion.p className="mk-hero-body" {...fadeUp(0.25)}>
            EpiCare helps you organize daily health information, understand EEG
            analysis results, and notice patterns over time—so your next step
            feels calmer and clearer.
          </motion.p>

          <motion.div className="mk-hero-actions" {...fadeUp(0.35)}>
            <Link to="/auth?mode=register" className="mk-btn mk-btn-primary mk-btn-lg mk-btn-skeuo">
              <span>Get started</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a
              href="#how-it-works"
              className="mk-btn mk-btn-ghost mk-btn-lg"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Explore how it works</span>
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </motion.div>

          <motion.div className="mk-hero-trust" {...fadeUp(0.45)}>
            <div className="mk-hero-trust-badge">
              <Shield size={14} className="mk-trust-shield-icon" aria-hidden="true" />
              <span>Designed to support—not replace—professional medical care.</span>
            </div>
          </motion.div>
        </div>

        {/* Right: Skeuomorphic visual composition with real editorial imagery */}
        <div className="mk-hero-visual">
          <motion.div
            className="mk-hero-frame mk-skeuo-card"
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.95, y: 16 },
                  animate: { opacity: 1, scale: 1, y: 0 },
                  transition: { duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const },
                })}
          >
            {/* Real Editorial Image */}
            <div className="mk-hero-image-wrap">
              <RemoteImage
                media={media.heroPortrait}
                priority={true}
                className="mk-hero-image"
              />
              <div className="mk-hero-image-gradient" />
            </div>

            {/* Subtle waveform overlay */}
            <div className="mk-hero-signal-wrap" aria-hidden="true">
              <SignalCanvas />
            </div>

            {/* Floating Tactile Telemetry Cards with Skeuomorphic Glass */}
            <motion.div
              className="mk-hero-card mk-hero-card--eeg mk-skeuo-glass"
              {...(reduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 20, x: 10 },
                    animate: { opacity: 1, y: 0, x: 0 },
                    transition: { duration: 0.55, delay: 0.5, ease: [0.16, 1, 0.3, 1] as const },
                  })}
            >
              <div className="mk-card-icon-pill mk-icon-emerald">
                <CheckCircle2 size={15} />
              </div>
              <div className="mk-card-text-block">
                <span className="mk-card-title">EEG Analysis Ready</span>
                <span className="mk-card-sub">19 channels · Signal verified</span>
              </div>
            </motion.div>

            <motion.div
              className="mk-hero-card mk-hero-card--med mk-skeuo-glass"
              {...(reduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 20, x: -10 },
                    animate: { opacity: 1, y: 0, x: 0 },
                    transition: { duration: 0.55, delay: 0.65, ease: [0.16, 1, 0.3, 1] as const },
                  })}
            >
              <div className="mk-card-icon-pill mk-icon-forest">
                <Pill size={15} />
              </div>
              <div className="mk-card-text-block">
                <span className="mk-card-title">AED On Schedule</span>
                <span className="mk-card-sub">Morning dose confirmed</span>
              </div>
            </motion.div>

            <motion.div
              className="mk-hero-card mk-hero-card--sleep mk-skeuo-glass"
              {...(reduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 20, x: 10 },
                    animate: { opacity: 1, y: 0, x: 0 },
                    transition: { duration: 0.55, delay: 0.8, ease: [0.16, 1, 0.3, 1] as const },
                  })}
            >
              <div className="mk-card-icon-pill mk-icon-teal">
                <Moon size={15} />
              </div>
              <div className="mk-card-text-block">
                <span className="mk-card-title">Sleep Consistency</span>
                <span className="mk-card-sub">7h 42m avg · Stabilized</span>
              </div>
            </motion.div>

            {/* Photo credit */}
            <div className="mk-hero-photo-credit">
              <ImageCredit credit={media.heroPortrait.credit} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
