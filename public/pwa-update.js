(() => {
  "use strict";

  const VERSION_KEY =
    "ibn_pwa_app_version";

  const MODAL_ID =
    "ibn-pwa-update-modal";

  let checking = false;

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function showUpdate(version) {
    if (document.getElementById(MODAL_ID)) {
      return;
    }

    const modal =
      document.createElement("div");

    modal.id = MODAL_ID;

    modal.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        z-index:999999;
        background:rgba(0,0,0,.55);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:22px;
      ">
        <div style="
          width:100%;
          max-width:420px;
          background:#fff;
          border-radius:24px;
          padding:28px 22px;
          text-align:center;
          box-shadow:0 20px 60px rgba(0,0,0,.3);
          font-family:Arial,sans-serif;
        ">

          <div style="font-size:52px">
            🔄
          </div>

          <h2 style="
            margin:10px 0 12px;
            color:#008751;
          ">
            Nouvelle mise à jour disponible
          </h2>

          <p style="
            color:#555;
            line-height:1.55;
            margin-bottom:20px;
          ">
            Une nouvelle version de
            Ibn_Djibril Niger Tech 🇳🇪
            est disponible.
          </p>

          <button
            id="ibn-pwa-update-btn"
            style="
              width:100%;
              border:0;
              border-radius:15px;
              padding:15px;
              background:#008751;
              color:white;
              font-size:17px;
              font-weight:bold;
            ">
            ✅ Mettre à jour
          </button>

        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document
      .getElementById("ibn-pwa-update-btn")
      .onclick = async event => {

        const btn = event.currentTarget;

        btn.disabled = true;
        btn.textContent =
          "⏳ Mise à jour...";

        safeSet(VERSION_KEY, version);

        try {
          if (
            "serviceWorker" in navigator
          ) {
            const registrations =
              await navigator
                .serviceWorker
                .getRegistrations();

            for (
              const registration
              of registrations
            ) {
              await registration.unregister();
            }
          }

          if ("caches" in window) {
            const names =
              await caches.keys();

            await Promise.all(
              names
                .filter(name =>
                  name.startsWith(
                    "ibn-djibril-"
                  )
                )
                .map(name =>
                  caches.delete(name)
                )
            );
          }
        } catch (err) {
          console.warn(
            "Nettoyage mise à jour:",
            err
          );
        }

        const url =
          new URL(window.location.href);

        url.searchParams.set(
          "update",
          Date.now()
        );

        window.location.replace(
          url.toString()
        );
      };
  }

  async function checkVersion() {
    if (checking) return;

    checking = true;

    try {
      const response = await fetch(
        "/api/app-version",
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache"
          }
        }
      );

      if (!response.ok) return;

      const data =
        await response.json();

      const currentVersion =
        String(data.version || "");

      if (!currentVersion) return;

      const savedVersion =
        safeGet(VERSION_KEY);

      if (!savedVersion) {
        safeSet(
          VERSION_KEY,
          currentVersion
        );

        return;
      }

      if (
        savedVersion !== currentVersion
      ) {
        showUpdate(currentVersion);
      }
    } catch (err) {
      console.warn(
        "Vérification mise à jour:",
        err
      );
    } finally {
      checking = false;
    }
  }

  async function registerSW() {
    if (
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    try {
      await navigator
        .serviceWorker
        .register(
          "/sw.js",
          {
            updateViaCache: "none"
          }
        );
    } catch (err) {
      console.warn(
        "Service Worker:",
        err
      );
    }
  }

  window.addEventListener(
    "load",
    async () => {
      await registerSW();
      await checkVersion();
    }
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        checkVersion();
      }
    }
  );

  setInterval(
    checkVersion,
    5 * 60 * 1000
  );
})();
