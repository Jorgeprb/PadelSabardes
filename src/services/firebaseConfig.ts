import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BEl62iUvXXXXXXX-YYYYYYYYYYYYYYYYYYYYY_ZZZZZZZZZZZZ';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD-QROuJVLdkF6g4mxdbB4a8KsF0oyNxMY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'studio-3178011448-9d904.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'studio-3178011448-9d904',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'studio-3178011448-9d904.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '687039821493',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:687039821493:web:62effc866af43ea803b0fc',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
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

export const requestPushNotificationToken = async () => {
  if (!messaging || !('Notification' in window)) return null;

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.ready;
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
