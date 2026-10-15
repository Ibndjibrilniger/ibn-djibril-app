// Finance release: retire every legacy application cache on activation.
const CACHE_PREFIX = "ibn-djibril-";

self.addEventListener("install", event => {
  event.waitUntil(
    self.skipWaiting()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith(CACHE_PREFIX))
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Ne jamais restaurer une ancienne interface financière depuis le cache.
  if (
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/dashboard.html" ||
    url.pathname === "/accueil-catalogue-prioritaire.js" ||
    url.pathname === "/accueil-catalogue-prioritaire.css" ||
    url.pathname === "/pwa-update.js"
  ) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
    );
    return;
  }

  // Toujours demander la version actuelle au serveur
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .catch(() => caches.match(event.request))
  );
});
