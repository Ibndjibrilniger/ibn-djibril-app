(() => {
  "use strict";
  const api = window.IBNPreferences;
  if (!api) return;
  const status = document.getElementById("ibn-pref-storage-status");
  const controls = {
    theme: document.getElementById("pref-theme"),
    density: document.getElementById("pref-density"),
    textSize: document.getElementById("pref-text-size"),
    reduceMotion: document.getElementById("pref-motion")
  };
  function display(value, storageAvailable) {
    controls.theme.value = value.theme;
    controls.density.value = value.density;
    controls.textSize.value = value.textSize;
    controls.reduceMotion.checked = value.reducedMotion;
    if (!storageAvailable) {
      status.hidden = false;
      status.textContent = "Le stockage local est indisponible. Vos réglages s’appliquent pour cette visite, mais ne pourront pas être conservés après fermeture ou rechargement.";
    } else {
      status.hidden = true;
      status.textContent = "";
    }
  }
  api.subscribe(display);
  display(api.get(), api.storageAvailable());
  controls.theme.addEventListener("change", () => api.set({ theme: controls.theme.value }));
  controls.density.addEventListener("change", () => api.set({ density: controls.density.value }));
  controls.textSize.addEventListener("change", () => api.set({ textSize: controls.textSize.value }));
  controls.reduceMotion.addEventListener("change", () => api.set({ reducedMotion: controls.reduceMotion.checked }));
  const version = document.getElementById("ibn-app-version");
  fetch("/api/app-version", { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
    .then(response => {
      if (!response.ok) throw new Error("version indisponible");
      return response.json();
    })
    .then(data => {
      if (!data.version) throw new Error("version absente");
      version.textContent = String(data.version);
    })
    .catch(() => { version.textContent = "Indisponible actuellement — réessayez avec une connexion."; });
})();
