/**
 * AnnouncementBar — Subtle top strip with clinical security badge
 */
import { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="mk-announcement" role="banner">
      <div className="mk-container mk-announcement-inner">
        <p>
          <ShieldCheck size={15} className="mk-announcement-icon" aria-hidden="true" />
          <span>Built for clearer everyday epilepsy management and grounded insights.</span>
          <a href="#safety" className="mk-announcement-link">
            Learn about safety &amp; limits
          </a>
        </p>
        <button
          onClick={() => setVisible(false)}
          className="mk-announcement-close"
          aria-label="Dismiss announcement"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
