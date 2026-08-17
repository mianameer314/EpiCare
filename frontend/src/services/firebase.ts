import { apiClient } from '../api/client';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

let cachedToken: string | null = null;
let tokenFetchPromise: Promise<string | null> | null = null;
let configCache: FirebaseClientConfig | null = null;

/**
 * Registers an FCM device registration token with the EpiCare backend API.
 */
export async function registerFcmDeviceToken(token: string) {
  try {
    await apiClient.put('/users/me/fcm-token', { fcm_token: token });
    console.log('[FCM] Device token registered with EpiCare backend.');
  } catch (err) {
    console.warn('[FCM] Failed to register FCM token with backend:', err);
  }
}

let firebaseLoadPromise: Promise<any> | null = null;

/**
 * Loads the Firebase compat scripts exactly once. Concurrent callers (app
 * startup + session restore + login can all request this at once) share the
 * same promise, so nobody can proceed with a half-loaded Firebase where
 * `firebase.messaging` is missing.
 */
function loadFirebaseScripts(): Promise<any> {
  if (!firebaseLoadPromise) {
    firebaseLoadPromise = (async () => {
      if ((window as any).firebase?.messaging) {
        return (window as any).firebase;
      }

      const loadScript = (src: string) =>
        new Promise((resolve, reject) => {
          const existing = document.querySelector(`script[src="${src}"]`);
          if (existing) {
            resolve(true);
            return;
          }
          const script = document.createElement('script');
          script.src = src;
          script.onload = () => resolve(true);
          script.onerror = reject;
          document.head.appendChild(script);
        });

      await loadScript('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');
      return (window as any).firebase;
    })();
  }
  return firebaseLoadPromise;
}

/**
 * Fetches the public Firebase Web config from the backend (cached).
 */
async function getFirebaseConfig(): Promise<FirebaseClientConfig | null> {
  if (configCache) return configCache;
  try {
    const config = await apiClient.get<FirebaseClientConfig>('/auth/firebase-config');
    if (!config || !config.apiKey || !config.vapidKey) {
      console.info('[FCM] Firebase Web Push credentials pending in backend/.env');
      return null;
    }
    configCache = config;
    return config;
  } catch (err) {
    console.warn('[FCM] Failed to fetch firebase config:', err);
    return null;
  }
}

/**
 * Obtains (or reuses) the FCM device token. Single-flight: concurrent callers
 * (startup + session restore + login) share one fetch instead of each
 * re-registering the service worker and retrying getToken. Returns the token,
 * or null when push is unavailable (permission denied, unsupported browser,
 * config missing, or token fetch failed).
 */
export function getFcmToken(): Promise<string | null> {
  if (cachedToken) return Promise.resolve(cachedToken);
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }
  if (Notification.permission !== 'granted') return Promise.resolve(null);
  if (!tokenFetchPromise) {
    tokenFetchPromise = doGetFcmToken().finally(() => {
      tokenFetchPromise = null;
    });
  }
  return tokenFetchPromise;
}

async function doGetFcmToken(): Promise<string | null> {
  try {
    const config = await getFirebaseConfig();
    if (!config) return null;

    const firebase = await loadFirebaseScripts();
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();

    // Register the service worker first — required for background push.
    let swReg: ServiceWorkerRegistration | null = null;
    try {
      swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      if (swReg.active) {
        swReg.active.postMessage({ type: 'INIT_FIREBASE', config: firebaseConfig });
      }
    } catch (err) {
      console.warn('[FCM] Service worker registration failed:', err);
    }

    // getToken can transiently fail (sender ID mismatch, SW still activating)
    // so retry a few times before giving up.
    let token: string | null = null;
    for (let attempt = 0; attempt < 3 && !token; attempt++) {
      try {
        token = await messaging.getToken({
          vapidKey: config.vapidKey,
          serviceWorkerRegistration: swReg || undefined,
        });
      } catch (err) {
        console.warn(`[FCM] getToken attempt ${attempt + 1} failed:`, err);
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (token) {
      cachedToken = token;
      return token;
    }
  } catch (error) {
    console.error('[FCM] Error obtaining FCM device token:', error);
  }

  return null;
}

/**
 * Ensures notifications are working for the current user:
 *  - asks for permission if not yet decided (safe no-op if already granted),
 *  - obtains the FCM token,
 *  - and registers it with the backend.
 *
 * Called on login, session restore, and app startup.
 */
export async function requestPushNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // If already granted this is a no-op that returns "granted" immediately.
    const permission =
      Notification.permission === 'granted'
        ? Notification.permission
        : await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission not granted:', permission);
      return null;
    }

    const token = await getFcmToken();
    if (token) {
      // Only sync with the backend when there is an active session.
      if (localStorage.getItem('access_token')) {
        await registerFcmDeviceToken(token);
      }
      return token;
    }
  } catch (error) {
    console.error('[FCM] Error requesting push permission:', error);
  }

  return null;
}
