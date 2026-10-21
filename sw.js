const CACHE_NAME = "isvec-seyahat-pwa-v2026-4";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        CORE_ASSETS.map(url =>
          fetch(url, { cache: "reload" }).then(res => {
            if (res && res.ok) return cache.put(url, res);
          })
        )
      );
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Navigation requests (HTML page): serve cached index.html immediately if offline, update in background
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          if (networkRes && networkRes.ok) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put("./index.html", copy.clone());
              cache.put("./", copy);
            });
          }
          return networkRes;
        })
        .catch(() =>
          caches.match(req, { ignoreSearch: true })
            .then(r => r || caches.match("./index.html") || caches.match("./"))
        )
    );
    return;
  }

  // Same-origin static assets & Google Fonts: Cache-first with background update
  if (url.origin === self.location.origin || url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(cached => {
        const netFetch = fetch(req)
          .then(netRes => {
            if (netRes && (netRes.ok || netRes.type === "opaque")) {
              const copy = netRes.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
            }
            return netRes;
          })
          .catch(() => cached);
        return cached || netFetch;
      })
    );
  }
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
