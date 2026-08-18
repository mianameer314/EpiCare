import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { requestPushNotificationPermission } from '../../services/firebase';
import './NotificationPermissionBanner.css';

/**
 * Banner that prompts the user to enable push notifications.
 *
 * Browsers require `Notification.requestPermission()` to be called from a
 * user-gesture (click handler).  Calling it from useEffect on mount is
 * silently ignored, which is why caretakers never received FCM push alerts
 * before — only email.
 *
 * This component:
 *  1. Checks if push is supported and permission is not yet granted.
 *  2. Renders a non-intrusive banner with an "Enable" button.
 *  3. On click, requests permission, obtains the FCM token, and registers
 *     it with the backend.
 *  4. Can be dismissed; won't show again for 24 hours.
 */
const DISMISS_KEY = 'epicare_push_dismissed_until';

export function NotificationPermissionBanner() {
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Don't show if browser doesn't support push
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    // Don't show if permission already granted
    if (Notification.permission === 'granted') {
      return;
    }

    // Don't show if user recently dismissed
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    setVisible(true);
  }, []);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const token = await requestPushNotificationPermission();
      if (token) {
        setDone(true);
        setVisible(false);
      } else {
        // Permission was denied or token failed
        setEnabling(false);
      }
    } catch {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    // Don't show again for 24 hours
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setVisible(false);
  };

  if (!visible || done) return null;

  return (
    <div className="notif-banner" role="alert">
      <div className="notif-banner-icon">
        {Notification.permission === 'denied' ? (
          <BellOff size={18} />
        ) : (
          <Bell size={18} />
        )}
      </div>
      <div className="notif-banner-text">
        <strong>Enable Emergency Push Notifications</strong>
        <span>
          {Notification.permission === 'denied'
            ? 'Notifications are blocked by your browser. Please enable them in your browser settings to receive SOS alerts.'
            : 'Get instant SOS alerts on your phone even when the app is closed or your screen is off.'}
        </span>
      </div>
      <div className="notif-banner-actions">
        {Notification.permission !== 'denied' && (
          <button
            className="notif-banner-enable-btn"
            onClick={handleEnable}
            disabled={enabling}
          >
            {enabling ? 'Enabling…' : 'Enable Now'}
          </button>
        )}
        <button className="notif-banner-dismiss-btn" onClick={handleDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
