(() => {
  "use strict";

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

  function findTransferServiceCard() {
    return $$(".service").find(card => {
      const h = $("h3", card);
      return h && norm(h.textContent).includes("services de transfert");
    }) || null;
  }

  function findPhoneAccessoriesCard() {
    return $$(".service").find(card => {
      const h = $("h3", card);
      const t = norm(h && h.textContent);
      return t.includes("telephones") && t.includes("accessoires");
    }) || null;
  }

  function movePhoneCardLast() {
    const services = $(".services");
    const phone = findPhoneAccessoriesCard();
    if (services && phone) services.appendChild(phone);
  }

  function insertTransferCardIntoCatalogue() {
    const grid = $(".ibn-cat-grid");
    if (!grid || $("#ibn-transfer-catalogue-card")) return !!grid;

    const card = document.createElement("article");
    card.id = "ibn-transfer-catalogue-card";
    card.className = "ibn-cat-card ibn-transfer-catalogue-card";
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.innerHTML = `
      <img class="ibn-cat-img ibn-transfer-logo"
           src="/media/products/catalogue/transfert-money-logo.png?v=20260923"
           alt="Services de transfert - FCFA, Naira et Dollar">
      <div class="ibn-cat-body">
        <div class="ibn-cat-kicker">TRANSFERTS & PAIEMENTS</div>
        <h3>Services de transfert d’argent</h3>
        <p class="sub">Dépôts • Retraits • Transferts • Mobile Money • POS • Solutions numériques</p>
        <div class="ibn-currency-row" aria-label="Monnaies disponibles">
          <span>FCFA</span><span>₦ Naira</span><span>$ Dollar</span>
        </div>
        <div class="ibn-cat-cta">Voir services & détails →</div>
      </div>
    `;

    const first = grid.firstElementChild;
    if (first) grid.insertBefore(card, first);
    else grid.appendChild(card);

    const open = () => openTransferSheet();
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
    return true;
  }

  function openTransferSheet() {
    let overlay = $("#ibn-transfer-sheet-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "ibn-transfer-sheet-overlay";
      overlay.className = "ibn-transfer-sheet-overlay";
      overlay.innerHTML = `
        <div class="ibn-transfer-sheet" role="dialog" aria-modal="true" aria-labelledby="ibn-transfer-sheet-title">
          <button class="ibn-transfer-sheet-close" type="button" aria-label="Fermer">×</button>
          <img class="ibn-transfer-sheet-logo"
               src="/media/products/catalogue/transfert-money-logo.png?v=20260923"
               alt="Services de transfert">
          <div class="ibn-transfer-sheet-content">
            <div class="ibn-cat-kicker">SERVICE PRIORITAIRE</div>
            <h2 id="ibn-transfer-sheet-title">Services de transfert d’argent</h2>
            <div class="ibn-currency-row ibn-currency-row-detail">
              <span>FCFA</span><span>₦ Naira</span><span>$ Dollar</span>
            </div>

            <div class="ibn-transfer-detail-grid">
              <section>
                <h3>🇳🇪 Niger — Dépôts, retraits & transferts</h3>
                <p>NITA • MyNITA • Amana • Airtel Money • Zamani Cash • Moov Flooz • Moni Fusion</p>
              </section>
              <section>
                <h3>🌍 Transferts internationaux</h3>
                <p>Envoi et réception d’argent • services internationaux • Mobile Money selon disponibilité.</p>
              </section>
              <section>
                <h3>🇳🇬 POS Nigeria</h3>
                <p>POS • Dépôt • Retrait • Change FCFA ⇄ Naira.</p>
              </section>
              <section>
                <h3>🌍 Mobile Money Afrique de l’Ouest</h3>
                <p>MTN MoMo Ghana • MTN MoMo Bénin • Moov Money • Celtis Money • Orange Money • MoMo Togo, selon disponibilité.</p>
              </section>
              <section>
                <h3>💳 Visa & Mastercard</h3>
                <p>Assistance à la création, activation et recharge de cartes virtuelles pour les paiements en ligne.</p>
              </section>
              <section>
                <h3>₿ USDT & services numériques</h3>
                <p>USDT • Binance • paiements et solutions numériques selon disponibilité.</p>
              </section>
            </div>

            <div class="ibn-transfer-contact">
              <strong>Contact</strong>
              <div>+227 96 78 48 70</div>
              <div>+227 91 44 51 87</div>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      $(".ibn-transfer-sheet-close", overlay).addEventListener("click", closeTransferSheet);
      overlay.addEventListener("click", e => {
        if (e.target === overlay) closeTransferSheet();
      });
      document.addEventListener("keydown", e => {
        if (e.key === "Escape" && overlay.classList.contains("is-open")) closeTransferSheet();
      });
    }
    overlay.classList.add("is-open");
    document.body.classList.add("ibn-no-scroll");
  }

  function closeTransferSheet() {
    const overlay = $("#ibn-transfer-sheet-overlay");
    if (overlay) overlay.classList.remove("is-open");
    document.body.classList.remove("ibn-no-scroll");
  }

  function reorderMain() {
    const main = $("main");
    if (!main) return false;

    const welcome = $(".welcome", main);
    const catalogue = $("#ibn-catalogue-ultra");
    const services = $(".services", main);
    const detail = $("#service-detail", main);
    const products = $("#products", main);
    const contact = $("#contact", main);

    if (!catalogue || !services || !products || !contact) return false;

    // Ordre final:
    // accueil -> catalogue photos (transfert en premier) -> anciennes grandes cartes
    // -> détail éventuel -> ancienne longue boutique/accessoires -> contact
    if (welcome) welcome.insertAdjacentElement("afterend", catalogue);
    else main.prepend(catalogue);

    catalogue.insertAdjacentElement("afterend", services);

    if (detail) services.insertAdjacentElement("afterend", detail);
    if (detail) detail.insertAdjacentElement("afterend", products);
    else services.insertAdjacentElement("afterend", products);

    products.insertAdjacentElement("afterend", contact);

    movePhoneCardLast();

    // Ancien bloc de priorité séparé, créé par la version précédente:
    const oldPriority = $("#ibn-transfer-priority");
    if (oldPriority) oldPriority.remove();

    main.classList.add("ibn-final-commerce-order");
    return true;
  }

  function run() {
    let tries = 0;
    const attempt = () => {
      tries++;
      const ok1 = reorderMain();
      const ok2 = insertTransferCardIntoCatalogue();
      if (ok1 && ok2) return true;
      return false;
    };

    if (attempt()) return;

    const timer = setInterval(() => {
      if (attempt() || tries > 50) clearInterval(timer);
    }, 150);

    const mo = new MutationObserver(() => {
      if (attempt()) mo.disconnect();
    });
    mo.observe(document.documentElement, {subtree:true, childList:true});
    setTimeout(() => mo.disconnect(), 9000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, {once:true});
  } else {
    run();
  }
})();
