// Minimal service worker for installability + a fast repeat visit (spec §4 PWA).
// Network-first for navigations (prices must be fresh), cache-first for static assets.
// v2 (2026-06-12): hardened after a wedged v1 instance hung all asset fetches in dev —
// dev-server URLs are bypassed entirely and cache writes can never block a response.
const CACHE = "geoffery-v2";
const SHELL = ["/", "/geoffery.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function putSafe(req, res) {
  // Cache writes are best-effort and never gate the response.
  try {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  } catch {
    /* ignore */
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Never intercept dev-server modules/HMR (Astro/Vite) — let them hit the network.
  if (url.pathname.startsWith("/src/") || url.pathname.startsWith("/@") || url.searchParams.has("astro")) return;

  // Static assets: cache-first.
  if (/\.(svg|png|webmanifest|css|js|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          putSafe(req, res);
          return res;
        });
      }).catch(() => fetch(req)),
    );
    return;
  }

  // Navigations / data: network-first, fall back to cache offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        putSafe(req, res);
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
  );
});
