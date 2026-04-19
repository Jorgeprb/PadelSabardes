importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD-QROuJVLdkF6g4mxdbB4a8KsF0oyNxMY",
  authDomain: "studio-3178011448-9d904.firebaseapp.com",
  projectId: "studio-3178011448-9d904",
  storageBucket: "studio-3178011448-9d904.firebasestorage.app",
  messagingSenderId: "687039821493",
  appId: "1:687039821493:web:62effc866af43ea803b0fc"
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
