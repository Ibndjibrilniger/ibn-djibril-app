const CACHE = "ibn-djibril-v2";

const ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener(
  "install",
  event => {
    event.waitUntil(
      caches
        .open(CACHE)
        .then(cache =>
          cache.addAll(ASSETS)
        )
    );
  }
);

self.addEventListener(
  "activate",
  event => {
    event.waitUntil(
      caches
        .keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(
                key =>
                  key.startsWith(
                    "ibn-djibril-"
                  ) &&
                  key !== CACHE
              )
              .map(
                key =>
                  caches.delete(key)
              )
          )
        )
        .then(() =>
          self.clients.claim()
        )
    );
  }
);

self.addEventListener(
  "message",
  event => {
    if (
      event.data &&
      event.data.type ===
        "SKIP_WAITING"
    ) {
      self.skipWaiting();
    }
  }
);

self.addEventListener(
  "fetch",
  event => {
    if (
      event.request.method !== "GET"
    ) {
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (
            response &&
            response.ok
          ) {
            const copy =
              response.clone();

            caches
              .open(CACHE)
              .then(cache =>
                cache.put(
                  event.request,
                  copy
                )
              )
              .catch(() => {});
          }

          return response;
        })
        .catch(() =>
          caches.match(
            event.request
          )
        )
    );
  }
);
