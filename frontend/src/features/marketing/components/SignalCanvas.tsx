/**
 * SignalCanvas — Abstract decorative waveform
 * CSS stroke-dashoffset draw animation, static for reduced-motion.
 * Purely decorative: aria-hidden="true".
 */
import { useReducedMotion } from 'framer-motion';

export function SignalCanvas({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      className={`mk-signal-canvas ${className || ''}`}
      viewBox="0 0 600 160"
      fill="none"
      aria-hidden="true"
      style={{ width: '100%', height: 'auto' }}
    >
      {/* Primary signal line */}
      <path
        d="M0 80 Q30 40 60 80 T120 80 T180 45 T210 105 T240 65 T300 80 T360 55 T420 95 T480 75 T540 80 T600 80"
        stroke="var(--mk-primary, #4F46E5)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
        className={reduceMotion ? '' : 'mk-signal-draw'}
      />
      {/* Secondary signal line — offset */}
      <path
        d="M0 95 Q40 65 80 95 T160 95 T240 70 T280 110 T320 85 T400 95 T480 80 T560 95 T600 95"
        stroke="var(--mk-teal, #0F9F98)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.2"
        className={reduceMotion ? '' : 'mk-signal-draw mk-signal-draw--delayed'}
      />
      {/* Soft glow dot at a stable point */}
      <circle
        cx="300"
        cy="80"
        r="4"
        fill="var(--mk-primary, #4F46E5)"
        opacity="0.25"
      />
    </svg>
  );
}
