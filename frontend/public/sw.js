// Self-destructing service worker.
// The legacy static site registered a cache-first SW at this scope; without this file,
// returning visitors would keep getting the old cached app. This build replaces the SW,
// wipes its caches, unregisters itself, and reloads open tabs onto the network version.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => clients.forEach((c) => c.navigate(c.url)))
  );
});
