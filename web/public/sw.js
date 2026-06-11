// Service worker: cache the shell, network-first for prices/search index.
// Charter: tame, minimal moving parts. Bump VERSION on shape changes.
const VERSION = 'v3';
const SHELL = ['/', '/methodology', '/tip-jar', '/patrons', '/about', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Prices change minutely — always network-first; cache as fallback.
  if (url.pathname === '/items.json' || url.pathname.startsWith('/item/')) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: cache-first.
  event.respondWith(caches.match(req).then((c) => c || fetch(req)));
});
