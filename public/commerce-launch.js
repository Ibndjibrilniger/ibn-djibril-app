(() => {
  "use strict";
  const splash = document.getElementById("ibn-launch-splash");
  if (!splash) return;
  const message = splash.querySelector(".ibn-splash-message");
  const progress = splash.querySelector("progress");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let dismissed = false;
  const started = performance.now();
  window.IbnLaunch = { status: "loading", started };
  // Installed browsers may already show a native launch screen: no extra wait.
  if (matchMedia("(display-mode: standalone)").matches || navigator.standalone) {
    splash.classList.add("is-standalone");
  }
  function ready() {
    return !!document.querySelector("#ibn-catalogue-ultra .ibn-cat-grid .ibn-cat-card");
  }
  function dismiss() {
    if (dismissed || !ready()) return;
    dismissed = true;
    clearTimeout(slow);
    clearTimeout(timeout);
    observer.disconnect();
    splash.classList.add("is-leaving");
    window.IbnLaunch = { status: "ready", started, readyMs: performance.now() - started };
    performance.mark("ibn:home-ready");
    window.dispatchEvent(new CustomEvent("ibn:home-ready"));
    setTimeout(() => splash.remove(), reduced ? 0 : 220);
  }
  function unavailable() {
    if (dismissed) return;
    if (ready()) return dismiss();
    splash.classList.add("is-error");
    window.IbnLaunch.status = "unavailable";
    message.textContent = navigator.onLine === false
      ? "Vous êtes hors connexion. Reconnectez-vous, puis réessayez."
      : "Le catalogue tarde à répondre. Vérifiez votre connexion, puis réessayez.";
    progress.removeAttribute("value");
  }
  // Indeterminate progress: never invent a network percentage.
  const slow = setTimeout(() => {
    if (!dismissed) message.textContent = "Connexion lente… Ouverture du catalogue en cours.";
  }, 3000);
  const timeout = setTimeout(unavailable, 10000);
  const observer = new MutationObserver(dismiss);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("ibn:catalogue-ready", dismiss, { once: true });
  window.addEventListener("DOMContentLoaded", dismiss, { once: true });
  window.addEventListener("offline", unavailable);
  dismiss();
})();
