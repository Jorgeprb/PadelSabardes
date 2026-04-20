importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCm1VfiIgEuQgRoK5L9Ad2ejHCdLg9B6yc",
  authDomain: "padelsabardes.firebaseapp.com",
  projectId: "padelsabardes",
  storageBucket: "padelsabardes.firebasestorage.app",
  messagingSenderId: "1008669431729",
  appId: "1:1008669431729:web:836365c84893c6850c4f90",
  measurementId: "G-TN2J9P47LR"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Sabardes';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/padel-logo-192.png',
    badge: '/padel-logo-192.png',
    data: {
      url: payload.data?.url || '/',
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
