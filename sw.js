const CACHE = 'campusassist-v1';
const STATIC = ['/', '/style.css', '/app.js', '/manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(STATIC); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});
