/**
 * TrustStrip — 4 tactile skeuomorphic block cards that slide in from the right
 * one-by-one with a distinct staggered sequence.
 */
import { FileCheck2, LayoutDashboard, TrendingUp, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const VALUES = [
  {
    icon: FileCheck2,
    label: 'Structured AI-assisted reports',
    desc: 'Understandable signal summaries for your appointments',
  },
  {
    icon: LayoutDashboard,
    label: 'Centralized health tracking',
    desc: 'Medications, daily dosing & lifestyle in one place',
  },
  {
    icon: TrendingUp,
    label: 'Longitudinal trend clarity',
    desc: 'Notice triggers and patterns over days and months',
  },
  {
    icon: ShieldCheck,
    label: 'Privacy-conscious design',
    desc: 'Encrypted telemetry & patient-controlled access',
  },
] as const;

export function TrustStrip() {
  const reduceMotion = useReducedMotion();

  const cardVariants = {
    hidden: reduceMotion ? {} : { opacity: 0, x: 70, y: 10, scale: 0.92 },
    visible: (index: number) => ({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.65,
        delay: reduceMotion ? 0 : 0.2 + index * 0.24,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    }),
  };

  return (
    <section className="mk-trust-strip" aria-label="Key Platform Capabilities">
      <div className="mk-container">
        <div className="mk-trust-grid">
          {VALUES.map((v, i) => (
            <motion.div
              key={v.label}
              className="mk-trust-item mk-trust-block"
              custom={i}
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.2 }}
            >
              <div className="mk-trust-icon-wrap" aria-hidden="true">
                <v.icon size={22} strokeWidth={2.2} />
              </div>
              <div className="mk-trust-text">
                <span className="mk-trust-label">{v.label}</span>
                <span className="mk-trust-desc">{v.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
