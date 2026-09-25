(() => {
  "use strict";

  function normalize(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function findTransferCard(services) {
    if (!services) return null;
    return [...services.querySelectorAll(".service")].find(card => {
      const h = card.querySelector("h3");
      return h && normalize(h.textContent).includes("services de transfert");
    }) || null;
  }

  function emphasizeAccessories(services) {
    if (!services) return;
    const card = [...services.querySelectorAll(".service")].find(c => {
      const h = c.querySelector("h3");
      const t = normalize(h && h.textContent);
      return t.includes("telephones") && t.includes("accessoires");
    });
    if (!card) return;
    const p = card.querySelector("p");
    if (!p || p.dataset.ibnEmphasisDone === "1") return;

    p.innerHTML = p.innerHTML
      .replace(/Écouteurs/g, '<strong class="ibn-important-product">Écouteurs</strong>')
      .replace(/Ecouteurs/g, '<strong class="ibn-important-product">Ecouteurs</strong>')
      .replace(/Power banks/gi, '<strong class="ibn-important-product">Power banks</strong>');

    p.dataset.ibnEmphasisDone = "1";
  }

  function buildPriorityTransfer(transferCard) {
    let section = document.getElementById("ibn-transfer-priority");
    if (section) return section;

    section = document.createElement("section");
    section.id = "ibn-transfer-priority";
    section.className = "ibn-transfer-priority";

    const intro = document.createElement("div");
    intro.className = "ibn-transfer-priority-head";
    intro.innerHTML = `
      <div class="ibn-mp-logo" aria-hidden="true">MP</div>
      <div>
        <div class="ibn-priority-label">SERVICE PRIORITAIRE</div>
        <h2>Transferts & paiements</h2>
        <p>Accès rapide aux services de transfert d’argent, Mobile Money, POS, change et solutions numériques.</p>
      </div>
    `;

    const clone = transferCard.cloneNode(true);
    clone.classList.add("ibn-transfer-featured-card");

    const h3 = clone.querySelector("h3");
    if (h3) h3.innerHTML = `<span class="ibn-inline-mp">MP</span> Services de transfert`;

    const p = clone.querySelector("p");
    if (p) {
      p.textContent = "Dépôts, retraits, transferts nationaux et internationaux, Mobile Money, POS et services numériques.";
    }

    section.appendChild(intro);
    section.appendChild(clone);
    return section;
  }

  function applyPriorityLayout() {
    const main = document.querySelector("main");
    if (!main) return false;

    const welcome = main.querySelector(".welcome");
    const services = main.querySelector(".services");
    const products = main.querySelector("#products");
    const detail = main.querySelector("#service-detail");
    const contact = main.querySelector("#contact");
    const catalogue = document.getElementById("ibn-catalogue-ultra");
    const transferCard = findTransferCard(services);

    if (!welcome || !services || !products || !contact || !catalogue || !transferCard) {
      return false;
    }

    const priority = buildPriorityTransfer(transferCard);

    // Ordre principal souhaité :
    // accueil -> transfert prioritaire -> catalogue avec photos -> ancienne boutique
    // -> autres services -> détail -> contact
    welcome.insertAdjacentElement("afterend", priority);
    priority.insertAdjacentElement("afterend", catalogue);
    catalogue.insertAdjacentElement("afterend", products);
    products.insertAdjacentElement("afterend", services);

    if (detail) services.insertAdjacentElement("afterend", detail);
    if (detail) detail.insertAdjacentElement("afterend", contact);
    else services.insertAdjacentElement("afterend", contact);

    emphasizeAccessories(services);

    main.classList.add("ibn-priority-layout-ready");
    return true;
  }

  function boot() {
    if (applyPriorityLayout()) return;

    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (applyPriorityLayout() || tries > 40) clearInterval(timer);
    }, 150);

    const observer = new MutationObserver(() => {
      if (applyPriorityLayout()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => observer.disconnect(), 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
