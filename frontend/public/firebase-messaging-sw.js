// Firebase Cloud Messaging Service Worker for background push alerts
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

let messaging = null;

function setupBackgroundMessaging() {
  if (!messaging) return;
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    const notificationTitle = payload.notification?.title || '🚨 EpiCare Seizure Emergency Alert';
    const notificationOptions = {
      body: payload.notification?.body || 'A patient has triggered an emergency alert. Tap to view live location.',
      icon: '/logo.png',
      badge: '/favicon.svg',
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

// Standard Push Event fallback
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.notification?.title || payload.title || '🚨 EpiCare Emergency SOS Alert';
    const options = {
      body: payload.notification?.body || payload.body || 'Immediate caregiver attention requested.',
      icon: '/logo.png',
      badge: '/favicon.svg',
      vibrate: [300, 100, 300, 100, 500],
      data: payload.data || {},
      requireInteraction: true,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    const text = event.data.text();
    event.waitUntil(self.registration.showNotification('🚨 EpiCare Seizure Alert', { body: text, icon: '/logo.png' }));
  }
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
