// Firebase Cloud Messaging Service Worker for background push alerts.
// Delivers SOS + medication reminders even when the app is closed or the
// screen is off. Handles two paths:
//   1. Raw `push` events (always registered — works without page open)
//   2. FCM onBackgroundMessage (initialized by the page via INIT_FIREBASE)
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const ICON = '/icon-192.png';
const BADGE = '/favicon.svg';

let messaging = null;

function setupBackgroundMessaging() {
  if (!messaging) return;
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    const notificationTitle = payload.notification?.title || '🚨 EpiCare Seizure Emergency Alert';
    const notificationOptions = {
      body: payload.notification?.body || 'A patient has triggered an emergency alert. Tap to view live location.',
      icon: ICON,
      badge: BADGE,
      vibrate: [200, 100, 200, 100, 400],
      tag: 'epicare-emergency',
      requireInteraction: true,
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
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

// Standard Push Event fallback — this is the path that fires when the app is
// closed / screen off, so it must not depend on the page ever being open.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let title = '🚨 EpiCare Emergency SOS Alert';
    let options = {
      body: 'Immediate caregiver attention requested.',
      icon: ICON,
      badge: BADGE,
      vibrate: [300, 100, 300, 100, 500],
      requireInteraction: true,
      data: {},
    };

    try {
      const payload = event.data.json();
      title = payload.notification?.title || payload.title || title;
      options.body = payload.notification?.body || payload.body || options.body;
      options.data = payload.data || {};

      // FCM data-only messages: payload.data carries the fields.
      if (payload.data && (payload.data.title || payload.data.body)) {
        title = payload.data.title || title;
        options.body = payload.data.body || options.body;
      }
    } catch {
      options.body = event.data.text() || options.body;
    }

    return self.registration.showNotification(title, options);
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
