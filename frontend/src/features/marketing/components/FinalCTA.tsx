/**
 * FinalCTA — Calm closing call-to-action with skeuomorphic radiant forest styling
 */
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Activity } from 'lucide-react';
import { Reveal } from './MarketingMotion';

export function FinalCTA() {
  return (
    <section className="mk-final-section" aria-labelledby="final-heading">
      <div className="mk-container mk-final-container">
        <Reveal>
          <div className="mk-final-card mk-skeuo-card">
            <div className="mk-final-badge">
              <Activity size={15} aria-hidden="true" />
              <span>Begin Your Journey</span>
            </div>

            <h2 id="final-heading" className="mk-final-title">
              Take the next clear step toward calmer, data-informed care.
            </h2>
            <p className="mk-final-body">
              Start organizing the health information that helps you understand your care patterns and communicate with your medical team with confidence.
            </p>
            <div className="mk-final-actions">
              <Link to="/auth?mode=register" className="mk-btn mk-btn-primary mk-btn-lg mk-btn-skeuo">
                <span>Create your free account</span>
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
                <span>Explore features</span>
                <ChevronRight size={16} aria-hidden="true" />
              </a>
            </div>

            {/* Abstract waveform */}
            <div className="mk-final-signal" aria-hidden="true">
              <svg viewBox="0 0 600 80" fill="none">
                <path
                  d="M0 40 Q50 15 100 40 T200 40 T300 25 T350 55 T400 35 T500 40 T600 40"
                  stroke="var(--mk-primary)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  opacity="0.25"
                />
              </svg>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
