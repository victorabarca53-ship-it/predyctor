// Sube la versión cada vez que cambien los archivos de la app.
const CACHE = 'predyctor-v5';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './favicon.ico',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  './vendor/chart.umd.min.js',
  './vendor/fonts/sora-latin-500-normal.woff2', './vendor/fonts/sora-latin-600-normal.woff2', './vendor/fonts/sora-latin-700-normal.woff2',
  './vendor/fonts/inter-latin-400-normal.woff2', './vendor/fonts/inter-latin-500-normal.woff2', './vendor/fonts/inter-latin-600-normal.woff2'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Tocar una notificación del temporizador trae Predyctor al frente (o lo abre).
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow('./'))));
});

// Con señal débil (terreno) no se espera a la red más de 3 segundos.
function conLimite(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('lento')), ms);
    promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // La página: primero la red para recibir versiones nuevas; sin señal o lenta, la copia guardada.
  if (e.request.mode === 'navigate') {
    e.respondWith(conLimite(fetch(e.request), 3000)
      .then((res) => { const copia = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copia)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Íconos, fuentes y gráficos: la copia guardada; si falta, la red y se guarda.
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
    return res;
  })));
});
