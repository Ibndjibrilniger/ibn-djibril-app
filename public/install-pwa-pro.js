(() => {
  "use strict";
  let deferredPrompt = null;
  const $ = (s, root=document) => root.querySelector(s);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) return;

  const isiOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function hidePrompt() {
    const o = $("#ibn-pwa-install-overlay");
    if (o) o.classList.remove("is-open");
    document.body.classList.remove("ibn-pwa-lock");
  }

  function showPrompt() {
    if ($("#ibn-pwa-install-overlay")) {
      $("#ibn-pwa-install-overlay").classList.add("is-open");
      document.body.classList.add("ibn-pwa-lock");
      return;
    }

    const o = document.createElement("div");
    o.id = "ibn-pwa-install-overlay";
    o.innerHTML = `
      <div class="ibn-pwa-install-card" role="dialog" aria-modal="true">
        <button class="ibn-pwa-close" type="button" aria-label="Fermer">×</button>
        <img class="ibn-pwa-logo" src="/icons/logo.png" alt="Ibn_Djibril Niger Tech">
        <div class="ibn-pwa-badge">APPLICATION OFFICIELLE</div>
        <h2>Installez Ibn_Djibril Niger Tech</h2>
        <p>Accédez plus vite à nos produits, services, transferts, réseaux, Starlink et solutions numériques depuis votre écran d’accueil.</p>
        <div class="ibn-pwa-benefits">
          <span>⚡ Accès rapide</span>
          <span>📱 Comme une application</span>
          <span>🔔 Expérience simplifiée</span>
        </div>
        <div id="ibn-pwa-ios-help" class="ibn-pwa-ios-help" hidden>
          <strong>Sur iPhone / iPad :</strong><br>
          appuyez sur <b>Partager</b>, puis <b>Sur l’écran d’accueil</b>.
        </div>
        <button id="ibn-pwa-install-btn" class="ibn-pwa-install-btn" type="button">📲 Installer l’application</button>
        <button id="ibn-pwa-continue-btn" class="ibn-pwa-continue-btn" type="button">Continuer sur le site</button>
      </div>
    `;
    document.body.appendChild(o);

    const btn = $("#ibn-pwa-install-btn", o);
    const iosHelp = $("#ibn-pwa-ios-help", o);

    if (isiOS()) {
      iosHelp.hidden = false;
      btn.textContent = "📲 Comment installer";
    }

    $(".ibn-pwa-close", o).onclick = hidePrompt;
    $("#ibn-pwa-continue-btn", o).onclick = hidePrompt;

    btn.onclick = async () => {
      if (isiOS()) {
        iosHelp.hidden = false;
        iosHelp.scrollIntoView({behavior:"smooth", block:"nearest"});
        return;
      }
      if (!deferredPrompt) {
        btn.textContent = "Installation disponible via le menu du navigateur";
        btn.disabled = true;
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      hidePrompt();
    };

    setTimeout(() => {
      o.classList.add("is-open");
      document.body.classList.add("ibn-pwa-lock");
    }, 1200);
  }

  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    showPrompt();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hidePrompt();
    const o = $("#ibn-pwa-install-overlay");
    if (o) o.remove();
  });

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (!standalone) showPrompt();
    }, 1800);
  }, {once:true});
})();
