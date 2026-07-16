/* DUNAZOE Service Worker — dunazoe-v4
 * Bump CACHE_NAME to force immediate cache busting on every deploy.
 * Update flow: new SW waits → notifies client → client shows banner → user taps → skipWaiting → reload
 */
const CACHE_NAME = "dunazoe-v4";
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

const NEVER_CACHE = [
  "/api/auth/",
  "/api/ops/",
  "/api/wallet/",
  "/api/payments/",
  "/api/deploy/",
  "/checkout",
];

function shouldNeverCache(url) {
  return NEVER_CACHE.some(p => url.includes(p));
}

// ── INSTALL: pre-cache statics, but DO NOT skipWaiting yet ───────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  // Don't call skipWaiting() here — we notify the client first so they see the banner
});

// ── ACTIVATE: wipe old caches, claim clients, then broadcast update ───────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim()).then(() => {
      // Broadcast to all open tabs that the app has been updated
      return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) =>
          client.postMessage({ type: "SW_ACTIVATED", version: CACHE_NAME })
        );
      });
    })
  );
});

// ── MESSAGE: handle skipWaiting request from UpdateNotifier ───────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── FETCH: network-first for HTML, stale-while-revalidate for assets ──────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (shouldNeverCache(url.pathname)) return;

  // API calls: network-only with offline error
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ success: false, error: "You are offline. Please reconnect." }), {
          status: 503, headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // HTML pages: network-first (gets latest), fall back to cache then /offline
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline"))
        )
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
        return res;
      });
      return cached || network;
    })
  );
});
