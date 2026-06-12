// Service Worker para Siliba — solo maneja web push.
// No interceptamos fetch (no offline mode) para evitar romper Next.js.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Siliba', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Siliba';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag,
    renotify: !!data.tag,
    data: {
      link: data.link || '/',
      notificationId: data.notificationId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si ya hay una ventana abierta, navega y enfoca
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'NAVIGATE', link });
          return client.focus();
        }
      }
      // Si no, abre una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    }),
  );
});
