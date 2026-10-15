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

  const financeData = {
    Niger: {
      flag: "🇳🇪",
      description: "Choisissez un service financier disponible au Niger.",
      services: [
        ["MyNITA", "https://www.nitatransfert.com/"],
        ["AMANATA", "https://play.google.com/store/apps/details?id=com.iisoft.tm.appamana"],
        ["Airtel Money", "https://www.airtel.africa/mobile-money"],
        ["Moov Flooz", "https://www.moov-africa.ne/"],
        ["Wave", "https://www.wave.com/"],
        ["Orange Money", "https://www.orange.ne/"],
        ["Coris Money", "https://www.corisbank.com/"],
        ["Zamani Cash", "https://zamanitelecom.net/zamani-cash"]
      ]
    },

    Benin: {
      flag: "🇧🇯",
      description: "Choisissez un service financier disponible au Bénin.",
      services: [
        ["MTN MoMo", "https://www.mtn.bj/momo/"],
        ["Moov Money", "https://www.moov-africa.bj/"],
        ["Celtiis Cash", "https://www.celtiis.bj/celtiis-cash"],
        ["B-MO", "https://bmo.bj/"],
        ["MyNITA", "https://www.nitatransfert.com/services/transfert-argent/"]
      ]
    },

    Nigeria: {
      flag: "🇳🇬",
      description: "Choisissez un service financier disponible au Nigeria.",
      services: [
        ["UBA", "https://www.ubagroup.com/"],
        ["FirstBank", "https://www.firstbanknigeria.com/"],
        ["Zenith Bank", "https://www.zenithbank.com/"],
        ["Union Bank", "https://www.unionbankng.com/"],
        ["Access Bank", "https://www.accessbankplc.com/"],
        ["GTCO", "https://www.gtbank.com/"],
        ["Monnify", "https://monnify.com/"]
      ]
    },

    Ghana: {
      flag: "🇬🇭",
      description: "Choisissez un service financier disponible au Ghana.",
      services: [
        ["MTN MoMo", "https://mtn.com.gh/momo/"],
        ["Telecel Cash", "https://telecel.com.gh/personal/telecel-cash/"]
      ]
    },

    International: {
      flag: "🌐",
      description: "Services de transfert d’argent internationaux.",
      services: [
        ["MoneyGram", "https://www.moneygram.com/"],
        ["Ria", "https://www.riamoneytransfer.com/"],
        ["MoneyFusion", "https://moneyfusion.net/"],
        ["NITA", "https://www.nitatransfert.com/"]
      ]
    },

    Crypto: {
      flag: "₿",
      description: "Services crypto et transactions USDT.",
      services: [
        ["Binance / USDT", "https://www.binance.com/"]
      ]
    }
  };

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "ibn-transfer-sheet-overlay";
    overlay.className = "ibn-transfer-sheet-overlay";

    overlay.innerHTML = `
      <div class="ibn-transfer-sheet" role="dialog" aria-modal="true">
        <button class="ibn-transfer-sheet-close" type="button" aria-label="Fermer">×</button>

        <div class="ibn-transfer-sheet-content" style="padding:20px;">
          <div style="
            background:linear-gradient(135deg,#008751,#0503d3);
            color:#fff;
            padding:20px;
            border-radius:20px;
            text-align:center;
            margin-bottom:16px;
          ">
            <div style="font-size:34px;">💸</div>
            <h2 id="ibn-finance-title" style="margin:6px 0;">
              Transferts & Services financiers
            </h2>
            <p id="ibn-finance-description" style="margin:0;">
              Choisissez votre pays pour accéder aux services financiers disponibles.
            </p>
          </div>

          <div id="ibn-finance-tabs" style="
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:8px;
            margin-bottom:16px;
          "></div>

          <div id="ibn-finance-services" style="
            display:grid;
            grid-template-columns:repeat(2,minmax(0,1fr));
            gap:10px;
          "></div>

          <div style="
            margin-top:18px;
            padding:12px;
            border-radius:12px;
            background:#f4f4f4;
            text-align:center;
            font-size:13px;
          ">
            🔒 Ibn_Djibril Niger Tech ne demande jamais votre mot de passe,
            code PIN ou code OTP.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    $(".ibn-transfer-sheet-close", overlay).addEventListener(
      "click",
      closeTransferSheet
    );

    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeTransferSheet();
    });
  }

  const tabs = [
    ["Niger", "🇳🇪 Niger"],
    ["Benin", "🇧🇯 Bénin"],
    ["Nigeria", "🇳🇬 Nigeria"],
    ["Ghana", "🇬🇭 Ghana"],
    ["International", "🌐 International"],
    ["Crypto", "₿ Crypto / USDT"]
  ];

  function renderFinance(country) {
    const data = financeData[country];
    if (!data) return;

    $("#ibn-finance-title", overlay).textContent =
      data.flag + " " + country;

    $("#ibn-finance-description", overlay).textContent =
      data.description;

    $("#ibn-finance-tabs", overlay).innerHTML =
      tabs.map(([key, label]) => `
        <button
          type="button"
          data-country="${key}"
          style="
            border:0;
            padding:10px 6px;
            border-radius:12px;
            background:${key === country ? "#008751" : "#eeeeee"};
            color:${key === country ? "#fff" : "#222"};
            font-weight:700;
            cursor:pointer;
          "
        >
          ${label}
        </button>
      `).join("");

    $("#ibn-finance-services", overlay).innerHTML =
      data.services.map(([name, url]) => `
        <div style="
          padding:14px;
          border:1px solid #e5e5e5;
          border-radius:14px;
          background:#fff;
          box-shadow:0 4px 12px rgba(0,0,0,.06);
        ">
          <strong style="display:block;margin-bottom:8px;">
            ${name}
          </strong>

          <a
            href="${url}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display:inline-block;
              text-decoration:none;
              font-weight:700;
              color:#008751;
            "
          >
            🔗 Accéder
          </a>
        </div>
      `).join("");

    $$("[data-country]", overlay).forEach(button => {
      button.addEventListener("click", () => {
        renderFinance(button.dataset.country);
      });
    });
  }

  renderFinance("Niger");

  overlay.classList.add("is-open");
  document.body.classList.add("ibn-no-scroll");
}
window.openTransferSheet = openTransferSheet;
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
