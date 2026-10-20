/* IBN preferences — shared public API, intentionally limited to display settings. */
(() => {
  "use strict";
  const KEY = "ibn_public_preferences_v1";
  const defaults = Object.freeze({ theme: "system", density: "comfortable", textSize: "standard", reducedMotion: false });
  let state = { ...defaults };
  let storageAvailable = true;
  const listeners = new Set();

  function read() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      state = {
        theme: ["system", "light", "dark"].includes(saved.theme) ? saved.theme : defaults.theme,
        density: ["comfortable", "compact"].includes(saved.density) ? saved.density : defaults.density,
        textSize: ["standard", "large"].includes(saved.textSize) ? saved.textSize : defaults.textSize,
        reducedMotion: saved.reducedMotion === true
      };
    } catch (_) {
      storageAvailable = false;
    }
  }
  function apply() {
    const root = document.documentElement;
    root.dataset.theme = state.theme === "system"
      ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : state.theme;
    root.dataset.themeChoice = state.theme;
    root.dataset.density = state.density;
    root.dataset.textSize = state.textSize;
    root.dataset.reducedMotion = String(state.reducedMotion);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = root.dataset.theme === "dark" ? "#15251d" : "#087747";
  }
  function notify() {
    apply();
    listeners.forEach(fn => { try { fn({ ...state }, storageAvailable); } catch (_) {} });
    window.dispatchEvent(new CustomEvent("ibn:preferences-change", { detail: { ...state } }));
  }
  read();
  apply();
  window.IBNPreferences = Object.freeze({
    get: () => ({ ...state, storageAvailable }),
    set(partial) {
      const next = { ...state };
      ["theme", "density", "textSize", "reducedMotion"].forEach(key => {
        if (Object.prototype.hasOwnProperty.call(partial || {}, key)) next[key] = partial[key];
      });
      if (!["system", "light", "dark"].includes(next.theme) ||
          !["comfortable", "compact"].includes(next.density) ||
          !["standard", "large"].includes(next.textSize) ||
          typeof next.reducedMotion !== "boolean") return { persisted: false, storageAvailable, preferences: { ...state } };
      state = next;
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        storageAvailable = true;
      } catch (_) {
        storageAvailable = false;
      }
      notify();
      return { persisted: storageAvailable, storageAvailable, preferences: { ...state } };
    },
    subscribe(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    storageAvailable: () => storageAvailable
  });
  if (window.matchMedia) {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystem = () => { if (state.theme === "system") apply(); };
    if (systemTheme.addEventListener) systemTheme.addEventListener("change", updateSystem);
    else if (systemTheme.addListener) systemTheme.addListener(updateSystem);
  }
})();
