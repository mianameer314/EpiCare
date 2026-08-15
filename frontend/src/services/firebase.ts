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

let firebaseLoaded = false;
async function loadFirebaseScripts(): Promise<any> {
  if (firebaseLoaded && (window as any).firebase) {
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
  firebaseLoaded = true;
  return (window as any).firebase;
}

/**
 * Requests browser/device notification permission, retrieves the FCM token,
 * and syncs it with the user account dynamically using backend-provided configuration.
 */
export async function requestPushNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    // 1. Fetch Firebase Web config dynamically from backend (no hardcoding / no frontend env needed)
    const config = await apiClient.get<FirebaseClientConfig>('/auth/firebase-config');
    if (!config || !config.apiKey || !config.vapidKey) {
      console.info('[FCM] Firebase Web Push credentials pending in backend/.env');
      return null;
    }

    // 2. Load Firebase SDK dynamically via official Google CDN
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
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    if (swReg.active) {
      swReg.active.postMessage({ type: 'INIT_FIREBASE', config: firebaseConfig });
    }

    const token = await messaging.getToken({ vapidKey: config.vapidKey, serviceWorkerRegistration: swReg });

    if (token) {
      await registerFcmDeviceToken(token);
      return token;
    }
  } catch (error) {
    console.error('[FCM] Error obtaining FCM device token:', error);
  }

  return null;
}
