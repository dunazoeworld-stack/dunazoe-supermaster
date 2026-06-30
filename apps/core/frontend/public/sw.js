const CACHE_NAME = "dunazoe-v2";
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/assets/dunazoe-logo.jpg",
];

const NEVER_CACHE = [
  "/api/auth/",
  "/api/ops/",
  "/api/wallet/",
  "/api/payments/",
  "/checkout",
];

function shouldNeverCache(url) {
  return NEVER_CACHE.some(p => url.includes(p));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (shouldNeverCache(url.pathname)) return;

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
