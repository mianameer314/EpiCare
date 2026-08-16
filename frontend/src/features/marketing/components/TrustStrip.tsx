/**
 * TrustStrip — 4 compact value propositions with skeuomorphic tactile depth
 */
import { FileCheck2, LayoutDashboard, TrendingUp, ShieldCheck } from 'lucide-react';
import { Reveal } from './MarketingMotion';

const VALUES = [
  { icon: FileCheck2, label: 'Structured AI-assisted reports', desc: 'Understandable signal summaries' },
  { icon: LayoutDashboard, label: 'Centralized health tracking', desc: 'Medications, logs & lifestyle' },
  { icon: TrendingUp, label: 'Longitudinal trend clarity', desc: 'Notice triggers and patterns over time' },
  { icon: ShieldCheck, label: 'Privacy-conscious design', desc: 'Encrypted & patient-controlled' },
] as const;

export function TrustStrip() {
  return (
    <section className="mk-trust-strip" aria-label="Product values">
      <Reveal className="mk-container">
        <div className="mk-trust-grid">
          {VALUES.map((v) => (
            <div key={v.label} className="mk-trust-item mk-skeuo-card">
              <div className="mk-trust-icon-wrap" aria-hidden="true">
                <v.icon size={20} />
              </div>
              <div className="mk-trust-text">
                <span className="mk-trust-label">{v.label}</span>
                <span className="mk-trust-desc">{v.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
