// Changing this release also triggers an update for existing PWA clients.
const RELEASE = "20261103-preferences-nav1";

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
            .filter(key => key.startsWith("ibn-djibril-"))
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

  // HTML and executable assets must never fall back to an old cached interface.
  if (
    event.request.mode === "navigate" ||
    /\.(?:html|js|css)$/.test(url.pathname) ||
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/api/")
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
