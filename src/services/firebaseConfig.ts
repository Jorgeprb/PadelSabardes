import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Replace placeholders with the actual VAPID public key when generating in the Firebase Console
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BEl62iUvXXXXXXX-YYYYYYYYYYYYYYYYYYYYY_ZZZZZZZZZZZZ';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD-QROuJVLdkF6g4mxdbB4a8KsF0oyNxMY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "studio-3178011448-9d904.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "studio-3178011448-9d904",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "studio-3178011448-9d904.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "687039821493",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:687039821493:web:62effc866af43ea803b0fc"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' && 'serviceWorker' in navigator ? getMessaging(app) : null;

// Helper function to get the Firebase Cloud Messaging Web Push Token
export const requestPushNotificationToken = async () => {
    if (!messaging) return null;
    try {
        const swRegistration = await navigator.serviceWorker.getRegistration();
        if (!swRegistration) throw new Error("Service Worker not perfectly registered yet");

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration,
        });

        return token;
    } catch (e) {
        console.error('An error occurred while retrieving token. ', e);
        return null;
    }
};

export const setupMessageHandler = (callback: (payload: any) => void) => {
    if (!messaging) return;
    return onMessage(messaging, (payload) => {
        callback(payload);
    });
};
