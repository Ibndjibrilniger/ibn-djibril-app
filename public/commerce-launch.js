(() => {
  "use strict";
  const splash = document.getElementById("ibn-launch-splash");
  if (!splash) return;
  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    window.clearTimeout(fallback);
    splash.classList.add("is-leaving");
    document.body.classList.remove("is-launching");
    window.setTimeout(() => splash.remove(), 340);
  }

  document.body.classList.add("is-launching");
  splash.addEventListener("click", dismiss, { once: true });
  window.addEventListener("ibn:catalogue-ready", dismiss, { once: true });
  // The launch curtain never waits for images, fonts, or a network response.
  const fallback = window.setTimeout(dismiss, 1800);
  if (document.querySelector("#ibn-catalogue-ultra .ibn-cat-grid")) {
    dismiss();
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    splash.style.transition = "none";
  }
})();
