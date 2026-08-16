/**
 * ProductPreview — High-fidelity EpiCare App Dashboard Mockup
 * Matches the actual EpiCare user interface with earthy green sidebar,
 * real telemetry modules, AED medication schedules, and clinical chat.
 */
import {
  Activity, Pill, Moon, Sparkles, MessageSquare,
  FileSpreadsheet, ShieldAlert, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { Reveal } from './MarketingMotion';

export function ProductPreview() {
  return (
    <section className="mk-preview-section" aria-labelledby="preview-heading">
      <div className="mk-container">
        <Reveal>
          <div className="mk-section-header">
            <div className="mk-eyebrow-badge">
              <span>Real Platform Preview</span>
            </div>
            <h2 id="preview-heading" className="mk-section-title">
              A clearer view of the information<br className="mk-br-desktop" /> you choose to track.
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mk-browser-frame mk-skeuo-card">
            {/* Browser chrome with tactile controls */}
            <div className="mk-browser-bar" aria-hidden="true">
              <div className="mk-browser-dots">
                <span className="dot-red" /><span className="dot-yellow" /><span className="dot-green" />
              </div>
              <div className="mk-browser-url">
                <span className="mk-url-lock">🔒</span>
                <span>https://epicare.health/dashboard</span>
              </div>
              <div className="mk-browser-actions-mock" />
            </div>

            {/* Dashboard grid matching authentic EpiCare App */}
            <div className="mk-dashboard-mock">
              {/* Authentic EpiCare Sidebar */}
              <div className="mk-mock-sidebar" aria-hidden="true">
                <div className="mk-mock-sidebar-logo">
                  <Activity size={18} strokeWidth={2.5} />
                  <span>EpiCare</span>
                </div>
                <div className="mk-mock-sidebar-nav">
                  <div className="mk-mock-nav-item mk-mock-nav-item--active">
                    <Activity size={14} />
                    <span>Dashboard</span>
                  </div>
                  <div className="mk-mock-nav-item">
                    <FileSpreadsheet size={14} />
                    <span>EEG Analysis</span>
                  </div>
                  <div className="mk-mock-nav-item">
                    <Pill size={14} />
                    <span>Medications</span>
                  </div>
                  <div className="mk-mock-nav-item">
                    <Moon size={14} />
                    <span>Lifestyle &amp; Sleep</span>
                  </div>
                  <div className="mk-mock-nav-item">
                    <MessageSquare size={14} />
                    <span>AI Assistant</span>
                  </div>
                  <div className="mk-mock-nav-item mk-mock-nav-item--sos">
                    <ShieldAlert size={14} />
                    <span>Emergency SOS</span>
                  </div>
                </div>
              </div>

              {/* Main content area */}
              <div className="mk-mock-main">
                <div className="mk-mock-header">
                  <div>
                    <span className="mk-mock-greeting">Patient Telemetry Overview</span>
                    <span className="mk-mock-subgreeting">Last EEG uploaded Aug 14 · System Stable</span>
                  </div>
                  <div className="mk-mock-status-pill">
                    <span className="mk-live-pulse" />
                    <span>AI Monitor Active</span>
                  </div>
                </div>

                <div className="mk-mock-grid">
                  {/* Card 1: EEG analysis card */}
                  <div className="mk-mock-card mk-mock-card--eeg mk-skeuo-inner">
                    <div className="mk-mock-card-top">
                      <div className="mk-card-icon-pill mk-icon-emerald">
                        <Activity size={14} />
                      </div>
                      <span className="mk-mock-card-title">Latest EEG Analysis</span>
                      <span className="mk-mock-badge-success">Verified</span>
                    </div>
                    <div className="mk-mock-wave-box">
                      <svg viewBox="0 0 240 40" fill="none" className="mk-mock-wave-svg">
                        <path
                          d="M0 20 Q15 5 30 20 T60 20 T90 10 T105 32 T120 15 T150 20 T180 12 T210 28 L240 20"
                          stroke="var(--mk-primary)"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <p className="mk-mock-card-detail">
                      19-ch EDF recording · High signal quality
                    </p>
                    <button className="mk-mock-link" tabIndex={-1} aria-hidden="true">
                      <span>View structured report</span> <ChevronRight size={12} />
                    </button>
                  </div>

                  {/* Card 2: AED Medication schedule */}
                  <div className="mk-mock-card mk-skeuo-inner">
                    <div className="mk-mock-card-top">
                      <div className="mk-card-icon-pill mk-icon-forest">
                        <Pill size={14} />
                      </div>
                      <span className="mk-mock-card-title">Daily AED Regimen</span>
                      <span className="mk-mock-streak">14-day streak</span>
                    </div>
                    <div className="mk-mock-dose-list">
                      <div className="mk-mock-dose-row">
                        <CheckCircle2 size={14} className="mk-dose-check-done" />
                        <span>Levetiracetam (Keppra) 500mg</span>
                        <span className="mk-dose-time">8:00 AM</span>
                      </div>
                      <div className="mk-mock-dose-row mk-dose-row--pending">
                        <div className="mk-dose-circle-pending" />
                        <span>Lamotrigine (Lamictal) 200mg</span>
                        <span className="mk-dose-time">8:00 PM</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Sleep Telemetry Bar Chart */}
                  <div className="mk-mock-card mk-skeuo-inner">
                    <div className="mk-mock-card-top">
                      <div className="mk-card-icon-pill mk-icon-teal">
                        <Moon size={14} />
                      </div>
                      <span className="mk-mock-card-title">Sleep &amp; Seizure Threshold</span>
                    </div>
                    <div className="mk-mock-chart" aria-hidden="true">
                      <div className="mk-mock-bar-wrap">
                        <div className="mk-mock-bar" style={{ height: '70%' }} />
                        <span>M</span>
                      </div>
                      <div className="mk-mock-bar-wrap">
                        <div className="mk-mock-bar" style={{ height: '85%' }} />
                        <span>T</span>
                      </div>
                      <div className="mk-mock-bar-wrap">
                        <div className="mk-mock-bar" style={{ height: '60%' }} />
                        <span>W</span>
                      </div>
                      <div className="mk-mock-bar-wrap">
                        <div className="mk-mock-bar" style={{ height: '90%' }} />
                        <span>T</span>
                      </div>
                      <div className="mk-mock-bar-wrap">
                        <div className="mk-mock-bar mk-mock-bar--active" style={{ height: '78%' }} />
                        <span>F</span>
                      </div>
                      <div className="mk-mock-bar-wrap">
                        <div className="mk-mock-bar" style={{ height: '65%' }} />
                        <span>S</span>
                      </div>
                      <div className="mk-mock-bar-wrap">
                        <div className="mk-mock-bar" style={{ height: '72%' }} />
                        <span>S</span>
                      </div>
                    </div>
                    <p className="mk-mock-card-detail">Weekly Average: 7h 42m continuous rest</p>
                  </div>

                  {/* Card 4: Clinical AI Assistant Preview */}
                  <div className="mk-mock-card mk-mock-card--chat mk-skeuo-inner">
                    <div className="mk-mock-card-top">
                      <div className="mk-card-icon-pill mk-icon-emerald">
                        <MessageSquare size={14} />
                      </div>
                      <span className="mk-mock-card-title">Clinical AI Guidance</span>
                    </div>
                    <div className="mk-mock-chat-bubble mk-mock-chat-bubble--user">
                      How does missed sleep affect seizure threshold?
                    </div>
                    <div className="mk-mock-chat-bubble mk-mock-chat-bubble--ai">
                      Sleep deprivation increases cortical excitability. Maintaining consistent 7–9h sleep stabilizes your threshold.
                    </div>
                  </div>

                  {/* Card 5: Lifestyle & Recommendations */}
                  <div className="mk-mock-card mk-mock-card--sand mk-skeuo-inner">
                    <div className="mk-mock-card-top">
                      <div className="mk-card-icon-pill mk-icon-forest">
                        <Sparkles size={14} />
                      </div>
                      <span className="mk-mock-card-title">Personalized Lifestyle Log</span>
                    </div>
                    <p className="mk-mock-card-rec">
                      Regular meal timing and hydration logged today. Consider tracking any sensory triggers before evening screen time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
