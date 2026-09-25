(() => {
  "use strict";

  let deferredPrompt = null;

  const INSTALLED_KEY = "ibn_pwa_installed";
  const LAST_PROMPT_KEY = "ibn_pwa_last_install_prompt";
  const REMINDER_DELAY = 24 * 60 * 60 * 1000;

  const $ = (s, root = document) => root.querySelector(s);

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;

  const isiOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent);

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

  function installed() {
    return safeGet(INSTALLED_KEY) === "1";
  }

  if (standalone) {
    safeSet(INSTALLED_KEY, "1");
    return;
  }

  function hidePrompt() {
    const o = $("#ibn-pwa-install-overlay");
    if (o) o.classList.remove("is-open");
    document.body.classList.remove("ibn-pwa-lock");
  }

  function canRemind() {
    if (installed()) return false;

    const last = Number(
      safeGet(LAST_PROMPT_KEY) || 0
    );

    return Date.now() - last >= REMINDER_DELAY;
  }

  function showPrompt() {
    if (installed()) return;

    if (!isiOS() && !deferredPrompt) return;

    if (!canRemind()) return;

    safeSet(
      LAST_PROMPT_KEY,
      String(Date.now())
    );

    if ($("#ibn-pwa-install-overlay")) {
      $("#ibn-pwa-install-overlay")
        .classList.add("is-open");

      document.body.classList.add(
        "ibn-pwa-lock"
      );

      return;
    }

    const o = document.createElement("div");

    o.id = "ibn-pwa-install-overlay";

    o.innerHTML = `
      <div class="ibn-pwa-install-card"
           role="dialog"
           aria-modal="true">

        <button class="ibn-pwa-close"
                type="button"
                aria-label="Fermer">×</button>

        <img class="ibn-pwa-logo"
             src="/icons/logo.png"
             alt="Ibn_Djibril Niger Tech">

        <div class="ibn-pwa-badge">
          APPLICATION OFFICIELLE
        </div>

        <h2>
          Installez Ibn_Djibril Niger Tech
        </h2>

        <p>
          Accédez plus vite à nos produits,
          services, réseaux, Starlink et
          solutions numériques.
        </p>

        <div class="ibn-pwa-benefits">
          <span>⚡ Accès rapide</span>
          <span>📱 Comme une application</span>
          <span>🔄 Mises à jour simplifiées</span>
        </div>

        <div id="ibn-pwa-ios-help"
             class="ibn-pwa-ios-help"
             hidden>
          <strong>Sur iPhone / iPad :</strong><br>
          appuyez sur <b>Partager</b>,
          puis <b>Sur l’écran d’accueil</b>.
        </div>

        <button id="ibn-pwa-install-btn"
                class="ibn-pwa-install-btn"
                type="button">
          📲 Installer l’application
        </button>

        <button id="ibn-pwa-continue-btn"
                class="ibn-pwa-continue-btn"
                type="button">
          Continuer sur le site
        </button>
      </div>
    `;

    document.body.appendChild(o);

    const btn =
      $("#ibn-pwa-install-btn", o);

    const iosHelp =
      $("#ibn-pwa-ios-help", o);

    if (isiOS()) {
      iosHelp.hidden = false;
      btn.textContent =
        "📲 Comment installer";
    }

    $(".ibn-pwa-close", o).onclick =
      hidePrompt;

    $("#ibn-pwa-continue-btn", o).onclick =
      hidePrompt;

    btn.onclick = async () => {
      if (isiOS()) {
        iosHelp.hidden = false;

        iosHelp.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });

        return;
      }

      if (!deferredPrompt) return;

      deferredPrompt.prompt();

      const result =
        await deferredPrompt.userChoice;

      if (
        result &&
        result.outcome === "accepted"
      ) {
        safeSet(INSTALLED_KEY, "1");
      }

      deferredPrompt = null;
      hidePrompt();
    };

    setTimeout(() => {
      o.classList.add("is-open");
      document.body.classList.add(
        "ibn-pwa-lock"
      );
    }, 300);
  }

  window.addEventListener(
    "beforeinstallprompt",
    event => {
      event.preventDefault();

      deferredPrompt = event;

      if (!installed()) {
        showPrompt();
      }
    }
  );

  window.addEventListener(
    "appinstalled",
    () => {
      deferredPrompt = null;

      safeSet(INSTALLED_KEY, "1");

      hidePrompt();

      const o =
        $("#ibn-pwa-install-overlay");

      if (o) o.remove();
    }
  );

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      setTimeout(() => {
        if (installed()) return;

        if (isiOS() || deferredPrompt) {
          showPrompt();
        }
      }, 1800);
    },
    { once: true }
  );
})();
