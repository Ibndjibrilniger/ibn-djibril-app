(() => {
  "use strict";

  const VERSION_KEY =
    "ibn_pwa_app_version";

  const MODAL_ID =
    "ibn-pwa-update-modal";
  const REFRESHED_KEY = "ibn_pwa_controller_refreshed";

  let checking = false;
  let reloadingForController = false;
  let registrationPending;

  if ("serviceWorker" in navigator) {
    // Do not reload on first install; reload once when an existing worker changes.
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloadingForController) {
        reloadingForController = true;
        try { sessionStorage.setItem(REFRESHED_KEY, "1"); } catch (_) {}
        window.location.reload();
      }
      hadController = true;
    });
  }

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
        // Recovery deadline, not a mandatory delay or a second navigation.
        let navigating = false;
        const navigate = () => {
          if (navigating) return;
          navigating = true;
          const url = new URL(window.location.href);
          url.searchParams.set("update", Date.now());
          window.location.replace(url.toString());
        };
        const deadline = setTimeout(navigate, 5000);

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
              if (registration.scope === new URL("/", window.location.href).href) {
                await registration.unregister();
              }
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

        clearTimeout(deadline);
        navigate();
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
      let refreshed = false;
      try {
        refreshed = sessionStorage.getItem(REFRESHED_KEY) === "1";
        if (refreshed) sessionStorage.removeItem(REFRESHED_KEY);
      } catch (_) {}

      // A worker replacement already fetched fresh HTML. Do not cover it with
      // a redundant "update" dialog just because the old version key survived.
      if (!savedVersion || refreshed) {
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

  function registerSW() {
    if (
      !("serviceWorker" in navigator)
    ) {
      return Promise.resolve();
    }
    if (registrationPending) return registrationPending;

    registrationPending = (async () => {
      const registration = await navigator
        .serviceWorker
        .register(
          "/sw.js",
          {
            updateViaCache: "none"
          }
        );
      await registration.update();
    })().catch(err => {
      console.warn(
        "Service Worker:",
        err
      );
    }).finally(() => { registrationPending = null; });
    return registrationPending;
  }

  function refresh() {
    // An unavailable worker update must not prevent the version check.
    return Promise.all([registerSW(), checkVersion()]);
  }

  window.addEventListener(
    "load",
    refresh
  );
  window.addEventListener("online", refresh);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        return refresh();
      }
    }
  );

  setInterval(
    refresh,
    5 * 60 * 1000
  );
})();
