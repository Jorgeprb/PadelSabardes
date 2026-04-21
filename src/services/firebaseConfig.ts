import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const DEFAULT_VAPID_KEY = 'BNUn7YkSeVJfhqyXBjRggYOov7T98R_nyK6uxUfmIQK_qaVFqWUAT40a0R_LTpN448dq3SQ0rNe8MlQdE51LtWo';

export const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY || DEFAULT_VAPID_KEY).trim();
const FUNCTIONS_REGION = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-east1';
const PWA_SW_URL = '/sw.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCm1VfiIgEuQgRoK5L9Ad2ejHCdLg9B6yc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'padelsabardes.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'padelsabardes',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'padelsabardes.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1008669431729',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1008669431729:web:836365c84893c6850c4f90',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-TN2J9P47LR',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, FUNCTIONS_REGION);
export const storage = getStorage(app);

let webMessaging: ReturnType<typeof getMessaging> | null = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window) {
  try {
    webMessaging = getMessaging(app);
  } catch (error) {
    console.warn('[Messaging] Firebase messaging not available in this browser:', error);
  }
}

export const messaging = webMessaging;

const ensureMessagingServiceWorkerRegistration = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  const rootRegistration = await navigator.serviceWorker.getRegistration('/');
  if (rootRegistration) {
    return rootRegistration;
  }

  try {
    return await navigator.serviceWorker.register(PWA_SW_URL);
  } catch (error) {
    console.warn('[Messaging] Error registering root service worker for notifications:', error);
    return null;
  }
};

export const requestPushNotificationToken = async () => {
  if (!messaging || !('Notification' in window)) return null;

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') return null;

    const registration = await ensureMessagingServiceWorkerRegistration();
    if (!registration) return null;

    return await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    console.error('[Messaging] Error retrieving push token:', error);
    return null;
  }
};

export const setupMessageHandler = (callback: (payload: unknown) => void) => {
  if (!messaging) return undefined;
  return onMessage(messaging, (payload) => callback(payload));
};

export const showForegroundNotification = async (payload: any) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const title = payload?.notification?.title || payload?.data?.title || 'Padel Sabardes';
  const body = payload?.notification?.body || payload?.data?.body || '';
  const options = {
    body,
    icon: '/padel-logo-192.png',
    badge: '/padel-logo-192.png',
    data: {
      url: payload?.data?.url || '/',
    },
  };

  try {
    const registration = await ensureMessagingServiceWorkerRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return;
    }
  } catch (error) {
    console.warn('[Messaging] Error showing foreground notification via service worker:', error);
  }

  try {
    new Notification(title, options);
  } catch (error) {
    console.warn('[Messaging] Error showing foreground notification via Notification constructor:', error);
  }
};
