// Changing this release also triggers an update for existing PWA clients.
const RELEASE = "20261020-startup1";
const IMAGE_CACHE = "ibn-djibril-images-" + RELEASE;
const OFFLINE_PAGE = `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#008751"><title>Connexion indisponible</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7f6;color:#163c2c;font:16px system-ui}main{max-width:340px;padding:28px;text-align:center;border-top:4px solid #ef8536}h1{font-size:22px}a{display:inline-block;background:#008751;color:white;padding:14px 24px;border-radius:12px;text-decoration:none}</style>
<main><h1>Ibn_Djibril Niger Tech 🇳🇪</h1><h2>Connexion indisponible</h2>
<p>Reconnectez-vous à Internet pour consulter le catalogue et les prix à jour.</p>
<a href="/">Réessayer</a></main></html>`;

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
            .filter(key => key.startsWith("ibn-djibril-") && key !== IMAGE_CACHE)
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
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" })
      .catch(() => new Response(OFFLINE_PAGE, {
        status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
      })));
    return;
  }

  // Only public display derivatives, never APIs, prices, uploads or Admin data.
  if (url.origin === self.location.origin &&
      (url.pathname.startsWith("/media/products/catalogue/optimized/") ||
       url.pathname === "/icons/logo-display-v1.webp")) {
    event.respondWith((async () => {
      let cache;
      try {
        cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
      } catch (_) { /* Cache quota/storage refusal must not block the network. */ }
      const response = await fetch(event.request);
      if (cache && response.ok && response.type !== "opaque") {
        try {
          await cache.put(event.request, response.clone());
          const keys = await cache.keys();
          await Promise.all(keys.slice(0, Math.max(0, keys.length - 60)).map(key => cache.delete(key)));
        } catch (_) { /* Public image is still usable when caching is refused. */ }
      }
      return response;
    })());
    return;
  }

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
