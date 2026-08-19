// Firebase Cloud Messaging Service Worker for background push alerts.
// Delivers SOS + medication reminders even when the app is closed or the
// screen is off. Handles two paths:
//   1. Raw `push` events (always registered — works without page open)
//   2. FCM onBackgroundMessage (initialized by the page via INIT_FIREBASE)
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const ICON = '/icon-192.png';
const BADGE = '/favicon.svg';
const TAG = 'epicare-emergency';

let messaging = null;

function showEpicareNotification(title, body, data = {}) {
  // Aggressive alarm-style vibration pattern: long buzz, short pause, repeat
  // This creates a distinctive emergency feel even on lock screen
  const ALARM_VIBRATE = [
    500, 100, 500, 100, 500, 100,  // 3 long buzzes
    200, 100, 200, 100, 200, 100,  // 3 short buzzes
    500, 100, 500, 100, 500, 100,  // 3 long buzzes again
    200, 100, 200, 100, 200, 100,  // 3 short buzzes again
    800,                             // long final buzz
  ];
  return self.registration.showNotification(title, {
    body,
    icon: ICON,
    badge: BADGE,
    vibrate: ALARM_VIBRATE,
    tag: TAG,
    requireInteraction: true,
    renotify: true,
    silent: false,
    data,
  });
}

function setupBackgroundMessaging() {
  if (!messaging) return;
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] onBackgroundMessage:', payload);
    const title = payload.notification?.title
      || payload.data?.title
      || '🚨 EpiCare Seizure Emergency Alert';
    const body = payload.notification?.body
      || payload.data?.body
      || 'A patient has triggered an emergency alert. Tap to view live location.';
    const data = payload.data || {};
    showEpicareNotification(title, body, data);
  });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE' && event.data.config) {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config);
      messaging = firebase.messaging();
      setupBackgroundMessaging();
    }
  }
});

// ── Push Event — THE critical path for background / screen-off delivery ──
// This fires regardless of whether the page is open or Firebase is initialized
// in the service worker.  For data-only FCM messages (no top-level notification
// field), this is the ONLY handler that will run.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let title = '🚨 EpiCare Emergency SOS Alert';
    let body = 'Immediate caregiver attention requested.';
    let data = {};

    try {
      const payload = event.data.json();
      // Data-only messages: title/body are in payload.data
      if (payload.data) {
        title = payload.data.title || title;
        body = payload.data.body || body;
        data = payload.data;
      }
      // Notification messages: title/body are in payload.notification
      if (payload.notification) {
        title = payload.notification.title || title;
        body = payload.notification.body || body;
      }
      // Flat payload fallback
      if (payload.title) title = payload.title;
      if (payload.body) body = payload.body;
    } catch {
      body = event.data.text() || body;
    }

    console.log('[firebase-messaging-sw.js] push event:', title);
    return showEpicareNotification(title, body, data);
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.lat
    ? `https://maps.google.com/?q=${event.notification.data.lat},${event.notification.data.lng}`
    : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
