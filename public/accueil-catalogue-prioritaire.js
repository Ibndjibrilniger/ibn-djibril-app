(() => {
  "use strict";

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

  // Presentation only: the existing country/service URLs below remain authoritative.
  const FINANCE_LOGO_VERSION = "20261016-logos1";
  const FINANCE_LOGOS = {
    "MyNITA": "nita", "NITA": "nita", "AMANATA": "amana",
    "Airtel Money": "airtel", "Moov Flooz": "moov-niger",
    "Wave": "wave", "Orange Money": "orange", "Coris Money": "coris",
    "Zamani Cash": "zamani", "MTN MoMo": "mtn", "Moov Money": "moov-benin",
    "Celtiis Cash": "celtiis", "B-MO": "bmo", "UBA": "uba",
    "FirstBank": "firstbank", "Zenith Bank": "zenith", "Union Bank": "union",
    "Access Bank": "access", "GTCO": "gtco", "Monnify": "monnify",
    "Telecel Cash": "telecel", "MoneyGram": "moneygram", "Ria": "ria",
    "MoneyFusion": "moneyfusion", "Binance / USDT": "binance"
  };
  const DARK_LOGOS = new Set(["moov-niger", "moov-benin", "monnify"]);

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
    const destination = $(".ibn-featured-categories");
    if (!destination) return false;
    const existing = $("#ibn-transfer-catalogue-card");
    if (existing) {
      if (existing.parentElement !== destination || destination.firstElementChild !== existing) destination.prepend(existing);
      return true;
    }

    const card = document.createElement("article");
    card.id = "ibn-transfer-catalogue-card";
    card.className = "ibn-cat-card ibn-transfer-catalogue-card";
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.setAttribute("aria-label","Ouvrir les services de transfert et de paiement");
    card.dataset.openTransfer = "true";
    card.innerHTML = `
      <picture><source type="image/webp" srcset="/media/products/catalogue/optimized/transfert-money-logo.webp">
      <img class="ibn-cat-img ibn-transfer-logo" loading="lazy" decoding="async"
           src="/media/products/catalogue/transfert-money-logo.png?v=20260923"
           alt="Services de transfert - FCFA, Naira et Dollar"></picture>
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

    destination.prepend(card);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        window.openTransferSheet();
      }
    });
    return true;
  }

  let transferTrigger = null;

  function openTransferSheet() {
  transferTrigger = document.activeElement;
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
      <div class="ibn-transfer-sheet" role="dialog" aria-modal="true" aria-labelledby="ibn-finance-title">
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

          <div id="ibn-finance-services"></div>

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
            <p style="margin-top:8px;">Informations et accompagnement uniquement :
              aucune transaction financière n’est exécutée dans cette application.</p>
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

    overlay.addEventListener("keydown", e => {
      if (e.key !== "Tab") return;
      const controls = $$("button, a[href]", overlay);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
      data.services.map(([name, url]) => {
        const logo = FINANCE_LOGOS[name];
        const initials = name.split(/[\s/-]+/).filter(Boolean)
          .slice(0, 2).map(word => word[0]).join("");
        const contactMessage = encodeURIComponent(
          `Bonjour Ibn_Djibril Niger Tech, je souhaite des informations sur ${name} — pays : ${country}.`
        );
        return `
          <article class="ibn-finance-service-item">
          <a class="ibn-finance-service-card"
             href="${url}" target="_blank" rel="noopener noreferrer"
             aria-label="${name} — Accéder au site dans un nouvel onglet">
            <span class="ibn-finance-service-logo-wrap${DARK_LOGOS.has(logo) ? " is-dark" : ""}${logo ? "" : " is-fallback"}">
              ${logo ? `<img class="ibn-finance-service-logo"
                src="/media/services/${logo}.webp?v=${FINANCE_LOGO_VERSION}"
                alt="Logo de ${name}" width="280" height="120" decoding="async">` : ""}
              <span class="ibn-finance-logo-fallback" role="img"
                    aria-label="Représentation graphique de ${name}">${initials}</span>
            </span>
            <strong class="ibn-finance-service-name">${name}</strong>
            <span class="ibn-finance-service-action">🔗 Accéder</span>
          </a>
          <div class="ibn-finance-contacts" aria-label="Contacter pour ${name}">
            <a href="https://wa.me/22796784870?text=${contactMessage}"
               target="_blank" rel="noopener noreferrer" data-finance-contact="whatsapp"
               aria-label="Demander des informations sur ${name} au ${country} par WhatsApp">WhatsApp</a>
            <a href="tel:+22791445187" data-finance-contact="phone"
               aria-label="Appeler Ibn_Djibril Niger Tech pour ${name}">Appeler</a>
          </div>
          </article>
        `;
      }).join("");

    $$(".ibn-finance-service-logo", overlay).forEach(image => {
      const showFallback = () => {
        image.closest(".ibn-finance-service-logo-wrap").classList.add("is-fallback");
      };
      image.addEventListener("error", showFallback, {once: true});
      if (image.complete && image.naturalWidth === 0) showFallback();
    });

    $$("[data-country]", overlay).forEach(button => {
      button.addEventListener("click", () => {
        renderFinance(button.dataset.country);
      });
    });
  }

  renderFinance("Niger");

  const detail = $("#service-detail");
  if (detail) detail.style.display = "none";
  overlay.classList.add("is-open");
  document.body.classList.add("ibn-no-scroll");
  $(".ibn-transfer-sheet-close", overlay).focus();
}
window.openTransferSheet = openTransferSheet;
  function closeTransferSheet() {
    const overlay = $("#ibn-transfer-sheet-overlay");
    if (!overlay || !overlay.classList.contains("is-open")) return;
    overlay.classList.remove("is-open");
    document.body.classList.remove("ibn-no-scroll");
    if (transferTrigger && transferTrigger.isConnected) transferTrigger.focus();
  }

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeTransferSheet();
  });

  function reorderMain() {
    const main = $("main");
    if (!main) return false;

    const welcome = $(".welcome", main);
    const catalogue = $("#ibn-catalogue-ultra");
    const contact = $("#contact", main);

    if (!catalogue || !contact) return false;

    // Homepage structure: introduction -> single catalogue -> existing contacts.
    if (welcome) welcome.insertAdjacentElement("afterend", catalogue);
    else main.prepend(catalogue);
    catalogue.insertAdjacentElement("afterend", contact);

    // Ancien bloc de priorité séparé, créé par la version précédente:
    const oldPriority = $("#ibn-transfer-priority");
    if (oldPriority) oldPriority.remove();

    main.classList.add("ibn-final-commerce-order");
    return true;
  }

  function run() {
    // The finance directory is also used elsewhere; only reorder on the storefront.
    if (!$("#ibn-catalogue-ultra") && !$(".services")) return;
    let tries = 0;
    const attempt = () => {
      tries++;
      const ok1 = reorderMain();
      const ok2 = insertTransferCardIntoCatalogue();
      if (ok1 && ok2) return true;
      return false;
    };

    if (attempt()) {
      const destination = $(".ibn-featured-categories");
      if (destination) {
        // renderFeatured may rebuild its children; preserve the finance entry as
        // the first access tile after any such render without duplicating it.
        const keepTransferFirst = new MutationObserver(() => insertTransferCardIntoCatalogue());
        keepTransferFirst.observe(destination, { childList: true });
      }
      return;
    }

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
