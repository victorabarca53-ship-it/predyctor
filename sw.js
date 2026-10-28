// Bump the version when the icons or manifest change.
const CACHE = 'predyctor-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.ico', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Tapping a timer notification brings Predyctor to the front (or opens it).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow('./'))));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // The page itself: network first so new versions arrive at once; the cached copy only when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request)
      .then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
