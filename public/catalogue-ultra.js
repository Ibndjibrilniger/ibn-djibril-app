(() => {
  "use strict";
  const DATA = window.IBN_CATALOGUE || [];
  if (!DATA.length || document.getElementById("ibn-catalogue-ultra")) return;

  const CONTACTS = {
    whatsapp: "https://wa.me/22796784870",
    telegram: "tg://resolve?phone=22791445187",
    facebook: "https://www.facebook.com/share/1E6ZdUkV6J/",
    sms: "sms:+22796784870",
    call: "tel:+22791445187"
  };

  // Reprise fidèle de l'ancienne rubrique Téléphones & Accessoires.
  const PHONE_COLLECTION = Object.freeze([
    "Smartphones Android Tecno, Samsung et Itel",
    "Téléphones à boutons",
    "itel IT5606",
    "Chargeurs Android et chargeurs rapides",
    "Chargeurs et accessoires Oraimo",
    "Écouteurs filaires et Bluetooth",
    "Casques Bluetooth",
    "Câbles USB, Type-C et câbles de recharge",
    "Power banks",
    "Haut-parleurs Bluetooth",
    "Radios",
    "Anti-chocs pour smartphones et téléphones à boutons",
    "Pochettes et étuis de protection",
    "Protections écran",
    "Cartes mémoire et accessoires de stockage",
    "Adaptateurs, multiprises, fils et câbles électriques"
  ]);
  window.IBN_PHONE_ACCESSORIES = PHONE_COLLECTION;

  // Read-only complimentary collection. Exact legacy tariffs are explicitly
  // marked for confirmation and never written into live catalogue products.
  const LEGACY_SUPPLEMENTS = Object.freeze([
    {
      title: "Wi-Fi & Internet",
      description: "Solutions Wi-Fi Zone et accès Internet.",
      originalLabel: "Wi-Fi & Internet",
      legacyLine: "Solutions Wi-Fi Zone et accès Internet."
    },
    {
      title: "Services de transfert",
      description: "Services de transfert d'argent et solutions numériques.",
      originalLabel: "Services de transfert"
    },
    {
      title: "Starlink V4 Standard X",
      description: "Kit Starlink Standard.",
      originalLabel: "Starlink V4 Standard X",
      legacyLine: "Kit Starlink Standard — 305 000 FCFA.",
      historicalPrice: "305 000 FCFA",
      productRefs: ["starlink-standard-x"]
    },
    {
      title: "Starlink Mini V4 — Achat direct",
      description: "Achat direct.",
      originalLabel: "Starlink Mini V4 — Achat direct",
      legacyLine: "Achat direct — 75 000 FCFA.",
      historicalPrice: "75 000 FCFA",
      productRefs: ["starlink-mini"]
    },
    {
      title: "Starlink Mini V4 — Offre crédit",
      description: "Offre crédit.",
      originalLabel: "Starlink Mini V4 — Offre crédit",
      legacyLine: "75 000 FCFA au départ, puis 47 000 FCFA/mois pendant 6 mois. Après 6 mois : 32 000 FCFA/mois avec possibilité de changer de forfait.",
      historicalPrice: "75 000 FCFA au départ",
      productRefs: ["starlink-mini"]
    },
    {
      title: "MikroTik RB950",
      description: "Routeur réseau.",
      originalLabel: "MikroTik RB950",
      legacyLine: "Routeur réseau — 42 000 FCFA.",
      historicalPrice: "42 000 FCFA",
      categoryRefs: ["MikroTik"]
    },
    {
      title: "MikroTik hAP ax3",
      description: "Routeur Wi-Fi professionnel.",
      originalLabel: "MikroTik hAP ax3",
      legacyLine: "105 000 FCFA.",
      historicalPrice: "105 000 FCFA",
      productRefs: ["mikrotik-hap-ax3"]
    },
    {
      title: "MikroTik L009",
      description: "Routeur réseau.",
      originalLabel: "MikroTik L009",
      legacyLine: "95 000 FCFA.",
      historicalPrice: "95 000 FCFA",
      productRefs: ["mikrotik-l009"]
    },
    {
      title: "MikroTik hAP ax2",
      description: "Routeur Wi-Fi.",
      originalLabel: "MikroTik hAP ax2",
      legacyLine: "70 000 FCFA.",
      historicalPrice: "70 000 FCFA",
      productRefs: ["mikrotik-hap-ax2"]
    },
    {
      title: "Wi-Fi Business Pro",
      description: "Starlink Standard + Grandstream AX6000 + MikroTik hAP ax3 + câblage + configuration + installation + abonnement initial.",
      originalLabel: "Wi-Fi Business Pro",
      legacyLine: "Starlink Standard + Grandstream AX6000 + MikroTik hAP ax3 + câblage + configuration + installation + abonnement initial — 590 000 FCFA.",
      historicalPrice: "590 000 FCFA",
      productRefs: ["starlink-standard-x", "mikrotik-hap-ax3", "grandstream-gwn7664elr"]
    },
    {
      title: "Wi-Fi Business Mini",
      description: "Starlink Mini V4 + équipements réseau + MikroTik + câblage + configuration + installation + abonnement initial.",
      originalLabel: "Wi-Fi Business Mini",
      legacyLine: "Starlink Mini V4 + équipements réseau + MikroTik + câblage + configuration + installation + abonnement initial — 520 000 FCFA.",
      historicalPrice: "520 000 FCFA",
      productRefs: ["starlink-mini", "mikrotik-hap-ax3"]
    },
    {
      title: "LiteBeam 5AC Gen2",
      description: "Antenne réseau longue portée.",
      originalLabel: "LiteBeam 5AC Gen2",
      legacyLine: "Antenne réseau longue portée — 85 000 FCFA / unité.",
      historicalPrice: "85 000 FCFA / unité",
      productRefs: ["ubiquiti-litebeam-5ac-gen2"]
    },
    {
      title: "LiteBeam simple / Point-to-Point",
      description: "Liaison Point-to-Point.",
      originalLabel: "LiteBeam simple / Point-to-Point",
      legacyLine: "Liaison Point-to-Point — 60 000 FCFA / unité.",
      historicalPrice: "60 000 FCFA / unité",
      categoryRefs: ["Antennes & PtP"]
    },
    {
      title: "Wavlink",
      description: "Antenne Wi-Fi extérieure.",
      originalLabel: "Wavlink",
      legacyLine: "Antenne Wi-Fi extérieure — 105 000 FCFA / unité.",
      historicalPrice: "105 000 FCFA / unité",
      productRefs: ["wavlink-wn588hx3", "wavlink-wn573hx3", "wavlink-ac1200-wn572h-family"]
    },
    {
      title: "COMFAST M5",
      description: "Antenne réseau sans fil.",
      originalLabel: "COMFAST M5",
      legacyLine: "Antenne réseau sans fil — 35 000 FCFA / unité.",
      historicalPrice: "35 000 FCFA / unité",
      productRefs: ["comfast-ew72", "comfast-ew85", "comfast-cf-e313ac"]
    },
    {
      title: "Câble réseau RJ45",
      description: "Câblage réseau.",
      originalLabel: "Câble réseau RJ45",
      legacyLine: "Câblage réseau — 300 FCFA / mètre.",
      historicalPrice: "300 FCFA / mètre",
      productRefs: ["cable-cat6"]
    },
    {
      title: "Chargeur / Adaptateur PoE",
      description: "Alimentation pour antennes réseau.",
      originalLabel: "Chargeur / Adaptateur PoE",
      legacyLine: "Alimentation pour antennes réseau — 12 000 FCFA.",
      historicalPrice: "12 000 FCFA",
      productRefs: ["ubiquiti-poe-adapter"]
    },
    {
      title: "Grandstream AX6000",
      description: "Équipement Wi-Fi professionnel.",
      originalLabel: "Grandstream AX6000",
      legacyLine: "Équipement Wi-Fi professionnel — Disponible sur demande.",
      productRefs: ["grandstream-gwn7664elr"]
    },
    {
      title: "Réseaux & Starlink",
      description: "Équipements réseau et solutions de connectivité. Solutions complètes Wi-Fi Business, antennes longue portée et accessoires réseau.",
      originalLabel: "Réseaux & Starlink"
    },
    {
      title: "Antennes & Accessoires réseau",
      description: "Solutions complètes Wi-Fi Business, antennes longue portée et accessoires réseau.",
      originalLabel: "Antennes & Accessoires réseau"
    },
    {
      title: "Starlink & MikroTik",
      description: "Références Starlink et MikroTik de l’ancienne présentation. Chaque ancien montant est conservé dans la référence repliée du produit correspondant.",
      originalLabel: "Starlink & MikroTik"
    },
    {
      title: "Informatique",
      description: "Services informatiques, réseaux et assistance technique.",
      originalLabel: "Informatique"
    }
  ]);
  window.IBN_CATALOGUE_SUPPLEMENTS = LEGACY_SUPPLEMENTS;

  const css = `
  #ibn-catalogue-ultra{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#18352a;margin:0 auto;max-width:1260px;padding:0 14px}
  .ibn-cat-hero{position:relative;overflow:hidden;color:#fff;border-radius:22px;padding:25px 21px;background:linear-gradient(112deg,#07553a,#087747 68%,#398557);box-shadow:0 14px 32px rgba(8,92,57,.14)}
  .ibn-cat-hero h2{margin:0 0 7px;font-size:clamp(27px,5.6vw,45px);line-height:1.05}
  .ibn-cat-hero p{margin:0;color:rgba(255,255,255,.9);font-size:15px}
  .ibn-cat-tools{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 14px}
  .ibn-cat-search{flex:1;min-width:200px;padding:14px 16px;border:1px solid #d8e2dd;border-radius:14px;font-size:16px;background:#fffefa}
  .ibn-cat-chips{display:flex;gap:8px;overflow:auto;padding:4px 0 10px;scrollbar-width:thin}
  .ibn-cat-chip{white-space:nowrap;border:1px solid #dce7e1;background:#fffefa;border-radius:999px;padding:9px 13px;font-weight:750;cursor:pointer}
  .ibn-cat-chip.active{background:#087747;color:#fff;border-color:#087747}
  .ibn-cat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:14px;align-items:stretch}
  .ibn-cat-card{border:1px solid #dce5dd;background:#fffefa;border-radius:18px;overflow:hidden;box-shadow:0 5px 18px rgba(25,67,46,.055);cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
  .ibn-cat-card:hover,.ibn-cat-card:focus-visible{transform:translateY(-2px);box-shadow:0 12px 26px rgba(25,67,46,.11);outline:2px solid #087747;outline-offset:2px}
  .ibn-cat-img{height:190px;background:#f5f7f2;display:flex;align-items:center;justify-content:center}
  .ibn-cat-img img{width:100%;height:100%;object-fit:contain;display:block}
  .ibn-cat-body{padding:14px;display:flex;flex-direction:column;flex:1}
  .ibn-cat-kicker{font-size:11px;font-weight:850;color:#087747;text-transform:uppercase;letter-spacing:.07em}
  .ibn-cat-card h3{margin:5px 0 6px;font-size:18px;line-height:1.22}
  .ibn-cat-card p{margin:0;color:#607269;font-size:13px;line-height:1.45}
  .ibn-price{display:inline-block;align-self:flex-start;margin-top:9px;background:#fff1e4;color:#824008;border:1px solid #f3d3b1;border-radius:999px;padding:6px 10px;font-weight:900;font-size:14px}
  .ibn-price-detail{display:inline-block;margin:2px 0 14px;background:#fff1e4;color:#824008;border:1px solid #f3d3b1;border-radius:999px;padding:8px 12px;font-weight:900;font-size:16px}
  .ibn-cat-cta{margin-top:auto;padding-top:12px;color:#087747;font-weight:850;font-size:13px}
  .ibn-stock{margin-top:10px;padding:8px 11px;border-radius:10px;font-size:13px;font-weight:850}
  .ibn-stock-ok{background:#e7f8ee;color:#087144}.ibn-stock-low{background:#fff4dc;color:#9a6200}.ibn-stock-out{background:#ffe9e7;color:#b3261e}
  .ibn-add-cart{width:100%;margin:10px 0 4px;padding:12px 14px;border:0;border-radius:12px;background:#087747;color:#fff;font-size:14px;font-weight:850;cursor:pointer}
  .ibn-add-cart:active{transform:scale(.98)}
  .ibn-add-cart:disabled{background:#d7ddda!important;color:#747d78!important;cursor:not-allowed!important}
  .ibn-empty{grid-column:1/-1;padding:25px;text-align:center;color:#607269;border:1px dashed #cfdcd2;border-radius:16px;background:#fffefa}
  .ibn-modal{position:fixed;inset:0;background:rgba(5,20,13,.72);z-index:99999;display:none;align-items:center;justify-content:center;padding:18px}
  .ibn-modal.open{display:flex}
  .ibn-sheet{background:#fffefa;width:min(760px,100%);max-height:92vh;overflow:auto;border-radius:22px;box-shadow:0 -20px 70px rgba(0,0,0,.28);overscroll-behavior:contain}
  .ibn-sheet-top{position:sticky;top:0;background:rgba(255,254,250,.96);backdrop-filter:blur(8px);display:flex;justify-content:flex-end;padding:9px 12px;z-index:2}
  .ibn-close{border:0;background:#edf3ee;color:#18352a;border-radius:999px;width:42px;height:42px;font-size:22px;cursor:pointer}
  .ibn-detail{padding:0 20px 24px}
  .ibn-gallery{display:grid;grid-auto-flow:column;grid-auto-columns:88%;overflow-x:auto;gap:10px;scroll-snap-type:x mandatory;margin-bottom:17px}
  .ibn-gallery figure{margin:0;background:#f3f6f2;border:1px solid #e1e8e1;border-radius:16px;min-height:230px;display:flex;align-items:center;justify-content:center;scroll-snap-align:start;overflow:hidden}
  .ibn-gallery img{width:100%;height:340px;max-height:43vh;object-fit:contain;background:#fffefa}
  .ibn-detail .category{color:#087747;font-weight:850;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  .ibn-detail h2{font-size:clamp(24px,7vw,37px);line-height:1.08;margin:5px 0 8px;color:#18352a}
  .ibn-detail .sub{color:#607269;margin:0 0 17px;font-size:15px;line-height:1.5}
  .ibn-specs{margin:0;padding:0;list-style:none;display:grid;gap:8px}
  .ibn-specs li{background:#f1f6f1;border-radius:12px;padding:11px 12px;line-height:1.4}
  .ibn-specs li::before{content:"";display:inline-block;width:7px;height:7px;margin:0 10px 1px 2px;border-radius:50%;background:#087747}
  .ibn-note{margin:15px 0;background:#fff6e9;border-left:4px solid #e77d25;padding:12px 13px;border-radius:10px;color:#59432e;line-height:1.5}
  .ibn-contact-title{text-align:center;margin:21px 0 12px;font-size:18px}
  .ibn-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:center}
  .ibn-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:46px;padding:11px 14px;border-radius:12px;color:#fff;text-decoration:none;font-weight:800}
  .ibn-wa{background:#087747}.ibn-tg{background:#2186a8}.ibn-fb{background:#255fa0}.ibn-sms{background:#685a43}.ibn-call{background:#315a43}
  .ibn-phone-editorial{display:grid;grid-template-columns:118px 1fr;align-items:center;gap:17px;margin:0 0 18px;padding:14px;border:1px solid #dce5dd;border-radius:17px;background:linear-gradient(130deg,#f2f7f1,#fffefa)}
  .ibn-phone-mark{display:grid;place-items:center;min-height:118px;border-radius:13px;background:#e8f1e9}
  .ibn-phone-mark img{width:90px;height:90px;object-fit:contain}
  .ibn-phone-editorial p{color:#607269;font-size:14px;line-height:1.5}
  .ibn-phone-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
  .ibn-phone-list li{display:flex;gap:10px;align-items:flex-start;padding:11px;border:1px solid #e1e8e1;border-radius:12px;background:#fff}
  .ibn-phone-index{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#e8f3ed;color:#087747;font-size:11px;font-weight:900}
  .ibn-phone-negotiable{margin:14px 0;padding:12px;border-radius:12px;background:#fff1e4;color:#71400f;font-size:15px;font-weight:900;text-align:center}
  .ibn-phone-ask{display:flex;justify-content:center;margin-top:14px}
  .ibn-phone-ask a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 16px;border-radius:12px;background:#087747;color:#fff;text-decoration:none;font-weight:850}
  .ibn-supplementary{margin:24px 0 0;padding:18px;border:1px solid #dce5dd;border-radius:19px;background:#fffefa}
  .ibn-supplementary-head{margin-bottom:14px}
  .ibn-supplementary-head h2{font-size:23px;letter-spacing:-.03em}
  .ibn-supplementary-head p{margin-top:5px;color:#607269;font-size:13px;line-height:1.45}
  .ibn-supplementary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .ibn-supplement-card{padding:13px;border:1px solid #e0e8e1;border-radius:13px;background:#f9fbf7}
  .ibn-supplement-card h3{margin-bottom:5px;font-size:15px}
  .ibn-supplement-card p{color:#596e62;font-size:13px;line-height:1.5}
  .ibn-supplement-card .terms{display:block;margin-top:8px;padding:8px 9px;border-radius:9px;background:#fff0df;color:#824008;font-size:12px;font-weight:800;line-height:1.45}
  .ibn-supplement-card .legacy-price-note{display:block;margin-top:7px;color:#7a614b;font-size:11px;line-height:1.4}
  @media(max-width:700px){
    .ibn-modal{align-items:flex-end;padding:0}.ibn-sheet{width:100%;max-height:94dvh;border-radius:20px 20px 0 0}
    .ibn-gallery{grid-auto-columns:88%}.ibn-gallery img{height:300px;max-height:38vh}
  }
  @media(max-width:420px){
    .ibn-phone-editorial{grid-template-columns:72px 1fr;gap:11px;padding:11px}
    .ibn-phone-mark{min-height:72px}.ibn-phone-mark img{width:60px;height:60px}
    .ibn-phone-list,.ibn-supplementary-grid{grid-template-columns:1fr}
    .ibn-detail{padding:0 14px 20px}
  }
  @media(prefers-reduced-motion:reduce){.ibn-cat-card,.ibn-add-cart{transition:none!important}}
  `;
  const style = document.createElement("style");
  style.id = "ibn-catalogue-style";
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement("section");
  root.id = "ibn-catalogue-ultra";
  root.setAttribute("aria-label", "Catalogue Ibn_Djibril Niger Tech");
  root.innerHTML = `
    <div class="ibn-cat-hero">
      <h2>Le catalogue, sans détour.</h2>
      <p>Équipements de connectivité et accessoires utiles, avec les informations et tarifs réellement disponibles.</p>
    </div>
    <div class="ibn-cat-tools">
      <input class="ibn-cat-search" type="search" placeholder="Rechercher un produit, une marque ou une catégorie" aria-label="Rechercher dans le catalogue">
    </div>
    <div class="ibn-cat-chips" aria-label="Filtrer par catégorie"></div>
    <div class="ibn-featured-categories" aria-label="Accès rapide aux rubriques"></div>
    <div class="ibn-cat-grid" aria-live="polite"></div>
    <button type="button" class="ibn-offers-link" data-open-offers>Consulter les offres et services déjà publiés <span aria-hidden="true">→</span></button>
  `;
  const main = document.querySelector("main");
  const welcome = main && main.querySelector(".welcome");
  if (welcome) welcome.insertAdjacentElement("afterend", root);
  else if (main) main.insertBefore(root, main.firstChild);
  else document.body.appendChild(root);

  // Les anciens blocs sont retirés uniquement après leur reprise ci-dessus.
  document.querySelectorAll(".services, #produits, #service-detail, #ibn-legacy-source").forEach(node => node.remove());

  const modal = document.createElement("div");
  modal.className = "ibn-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Détails du produit");
  modal.innerHTML = `<div class="ibn-sheet" tabindex="-1"><div class="ibn-sheet-top"><button class="ibn-close" type="button" aria-label="Fermer les détails">×</button></div><div class="ibn-detail"></div></div>`;
  document.body.appendChild(modal);

  const grid = root.querySelector(".ibn-cat-grid");
  const chips = root.querySelector(".ibn-cat-chips");
  const search = root.querySelector(".ibn-cat-search");
  const featured = root.querySelector(".ibn-featured-categories");
  const categories = ["Tout", ...new Set(DATA.map(product => product.category))];
  let active = "Tout";
  let returnFocus = null;
  let modalOpen = false;
  let hasHistoryEntry = false;
  let closeFallback = 0;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }
  function productImage(product) { return (product.images && product.images[0]) || ""; }
  function categoryImage(category) {
    const product = DATA.find(item => item.category === category && productImage(item));
    return product ? productImage(product) : "/icons/logo.png";
  }

  function renderFeatured() {
    const firstCategories = [...new Set(DATA.map(product => product.category))].slice(0, 4);
    const tiles = firstCategories.map(category => {
      const image = categoryImage(category);
      return `<button type="button" class="ibn-feature-tile" data-feature-category="${esc(category)}">
        <span class="ibn-feature-image"><img src="${esc(image)}" alt="" loading="lazy" decoding="async"></span>
        <span class="ibn-feature-copy"><span class="ibn-feature-kicker">CATÉGORIE</span><strong>${esc(category)}</strong><small>Parcourir les équipements</small></span>
      </button>`;
    }).join("");
    const phone = `<button type="button" class="ibn-feature-tile" data-open-phone>
      <span class="ibn-feature-image"><img src="/icons/logo.png" alt="Logo officiel Ibn_Djibril Niger Tech" loading="lazy" decoding="async"></span>
      <span class="ibn-feature-copy"><span class="ibn-feature-kicker">CATÉGORIE</span><strong>TÉLÉPHONES & ACCESSOIRES</strong><small>Tecno, Samsung, Itel, Oraimo et plus</small></span>
    </button>`;
    featured.innerHTML = phone + tiles;
  }

  function renderChips() {
    chips.innerHTML = categories.map(category =>
      `<button type="button" class="ibn-cat-chip${category === active ? " active" : ""}" data-cat="${esc(category)}" aria-pressed="${category === active}">${esc(category)}</button>`
    ).join("");
  }
  function stockInfo(product) {
    const hasStock = Number.isInteger(product.stock) && product.stock >= 0;
    if (product.outOfStock === true || (hasStock && product.stock === 0)) {
      return { text: "Rupture de stock", cls: "out", disabled: true };
    }
    if (hasStock && product.stock >= 1 && product.stock <= 5) {
      return { text: `Plus que ${product.stock} disponible${product.stock > 1 ? "s" : ""}`, cls: "low", disabled: false };
    }
    if (hasStock && product.stock > 5) return { text: "Disponible", cls: "ok", disabled: false };
    return { text: "", cls: "", disabled: false };
  }
  function renderCards() {
    const query = search.value.trim().toLocaleLowerCase("fr");
    const filtered = DATA.filter(product =>
      (active === "Tout" || product.category === active) &&
      (!query || [product.name, product.subtitle, product.category, ...(product.specs || [])]
        .join(" ").toLocaleLowerCase("fr").includes(query))
    );
    grid.innerHTML = filtered.map(product => {
      const stock = stockInfo(product);
      const image = productImage(product);
      return `<article class="ibn-cat-card" tabindex="0" aria-label="Voir les détails de ${esc(product.name)}" data-id="${esc(product.id)}">
        ${image ? `<div class="ibn-cat-img"><img src="${esc(image)}" alt="${esc(product.name)}" loading="lazy" decoding="async"></div>` : ""}
        <div class="ibn-cat-body">
          <div class="ibn-cat-kicker">${esc(product.category)}</div>
          <h3>${esc(product.name)}</h3><p>${esc(product.subtitle)}</p>
          ${product.price ? `<div class="ibn-price">${esc(product.price)}</div>` : ""}
          ${stock.text ? `<div class="ibn-stock ibn-stock-${stock.cls}">${esc(stock.text)}</div>` : ""}
          <button type="button" class="ibn-add-cart" data-id="${esc(product.id)}"${stock.disabled ? " disabled aria-disabled=\"true\"" : ""}>${stock.disabled ? "Indisponible" : "Ajouter au panier"}</button>
           <button type="button" class="ibn-cat-cta">Voir les détails</button>
        </div>
      </article>`;
    }).join("") || `<div class="ibn-empty">Aucun résultat. Essayez un autre mot ou choisissez une autre catégorie.</div>`;
  }
  function referencesFor(product) {
    return LEGACY_SUPPLEMENTS.filter(item =>
      (item.productRefs || []).includes(product.id) ||
      (item.categoryRefs || []).includes(product.category)
    );
  }
  function renderReferences(items) {
    if (!items.length) return "";
    return `<section class="ibn-legacy-references" aria-label="Références d’offres déjà publiées">
      <h3>Offres déjà publiées</h3>
      <p class="ibn-legacy-intro">Références historiques conservées pour mémoire. Elles ne remplacent pas le prix actuel affiché plus haut.</p>
      ${items.map(item => `<details class="ibn-legacy-detail">
        <summary>${esc(item.originalLabel || item.title)}</summary>
        <p>${esc(item.description)}</p>
        <p class="ibn-legacy-line">${esc(item.legacyLine || item.description)}</p>
        ${item.historicalPrice ? `<small>Montant historique, à confirmer avant commande : ${esc(item.historicalPrice)}. Le prix actuel du catalogue et celui du panier restent inchangés.</small>` : ""}
      </details>`).join("")}
    </section>`;
  }
  function renderSupplements() {
    return `<div class="category">OFFRES & SERVICES</div><h2 id="ibn-detail-heading">Offres déjà publiées</h2>
      <p class="sub">Toutes les informations conservées sont consultables ci-dessous. Les montants des anciennes offres sont à confirmer : le prix actuel synchronisé avec l’Admin reste celui du catalogue et du panier.</p>
      <div class="ibn-supplementary-grid">` + LEGACY_SUPPLEMENTS.map(item => `<article class="ibn-supplement-card">
      <details class="ibn-legacy-detail">
        <summary>${esc(item.originalLabel || item.title)}</summary>
        <p>${esc(item.description)}</p>
        <p class="ibn-legacy-line">${esc(item.legacyLine || item.description)}</p>
        ${item.historicalPrice ? `<small>Montant historique, à confirmer avant commande : ${esc(item.historicalPrice)}. Ce montant ne remplace pas le tarif actuel du catalogue.</small>` : ""}
      </details>
    </article>`).join("") + `</div><h3 class="ibn-contact-title">Confirmer une offre ou un service</h3>${contactActions()}`;
  }

  function contactActions() {
    return `<div class="ibn-actions">
      <a class="ibn-action ibn-wa" href="${CONTACTS.whatsapp}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a class="ibn-action ibn-tg" href="${CONTACTS.telegram}">Telegram</a>
      <a class="ibn-action ibn-fb" href="${CONTACTS.facebook}" target="_blank" rel="noopener noreferrer">Facebook</a>
      <a class="ibn-action ibn-sms" href="${CONTACTS.sms}">SMS</a>
      <a class="ibn-action ibn-call" href="${CONTACTS.call}">Appeler</a>
    </div>`;
  }

  function populateProduct(product) {
    const gallery = (product.images || []).map((src, index) =>
      `<figure><img src="${esc(src)}" alt="${esc(product.name)} — photo ${index + 1}" loading="${index ? "lazy" : "eager"}" decoding="async"></figure>`
    ).join("");
    return `<div class="ibn-gallery">${gallery}</div>
      <div class="category">${esc(product.category)}</div><h2 id="ibn-detail-heading">${esc(product.name)}</h2>
      <p class="sub">${esc(product.subtitle)}</p>
      ${product.price ? `<div class="ibn-price-detail">Prix : ${esc(product.price)}</div>` : ""}
      ${(product.specs || []).length ? `<ul class="ibn-specs">${product.specs.map(spec => `<li>${esc(spec)}</li>`).join("")}</ul>` : ""}
      ${product.note ? `<div class="ibn-note">${esc(product.note)}</div>` : ""}
      ${renderReferences(referencesFor(product))}
      <h3 class="ibn-contact-title">Commander ou demander un renseignement</h3>${contactActions()}`;
  }

  function populatePhoneCategory() {
    const message = encodeURIComponent("Bonjour Ibn_Djibril Niger Tech, je souhaite connaître la disponibilité et le prix des téléphones et accessoires.");
    return `<div class="category">TÉLÉPHONES & ACCESSOIRES</div>
      <h2 id="ibn-detail-heading">Équipement Android et accessoires</h2>
      <div class="ibn-phone-editorial">
        <span class="ibn-phone-mark"><img src="/icons/logo.png" alt="Logo officiel de la boutique, illustration de cette rubrique"></span>
        <p>Téléphones, chargeurs, câbles et accessoires. Une sélection pour Android et téléphones à boutons. Aucun prix n’est affiché ici : demandez le tarif et la disponibilité à l’équipe.</p>
      </div>
      <ul class="ibn-phone-list">${PHONE_COLLECTION.map((item, index) => `<li><span class="ibn-phone-index">${String(index + 1).padStart(2, "0")}</span><span>${esc(item)}</span></li>`).join("")}</ul>
      <div class="ibn-phone-negotiable">Tous les prix sont à discuter</div>
      <div class="ibn-phone-ask"><a href="https://wa.me/22796784870?text=${message}" target="_blank" rel="noopener noreferrer">Demander les tarifs sur WhatsApp</a></div>`;
  }

  function finalizeClose() {
    if (!modalOpen) return;
    window.clearTimeout(closeFallback);
    modalOpen = false;
    modal.classList.remove("open");
    document.body.style.overflow = "";
    if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    else search.focus({ preventScroll: true });
  }
  function closeModal(fromPopState = false) {
    if (!modalOpen) return;
    if (!fromPopState && hasHistoryEntry) {
      hasHistoryEntry = false;
      history.back();
      closeFallback = window.setTimeout(finalizeClose, 450);
      return;
    }
    hasHistoryEntry = false;
    finalizeClose();
  }
  function openModal(content, label, trigger, historyKey) {
    if (modalOpen) return;
    returnFocus = trigger || document.activeElement;
    modal.setAttribute("aria-label", label);
    modal.querySelector(".ibn-detail").innerHTML = content;
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    modalOpen = true;
    if (historyKey && window.history && history.pushState) {
      history.pushState({ ...(history.state || {}), ibnCatalogueDetail: historyKey }, "", `#catalogue-${encodeURIComponent(historyKey)}`);
      hasHistoryEntry = true;
    }
    modal.querySelector(".ibn-close").focus();
  }
  function showProduct(id, trigger) {
    const product = DATA.find(item => item.id === id);
    if (!product) return;
    modal.dataset.productId = id;
    openModal(populateProduct(product), "Détails du produit", trigger, id);
  }
  function showPhones(trigger) {
    delete modal.dataset.productId;
    openModal(populatePhoneCategory(), "Téléphones et accessoires", trigger, "telephones-accessoires");
  }
  function showOffers(trigger) {
    delete modal.dataset.productId;
    openModal(renderSupplements(), "Offres et services déjà publiés", trigger, "offres-services");
  }

  root.addEventListener("click", event => {
    const add = event.target.closest(".ibn-add-cart");
    if (add) return;
    const categoryButton = event.target.closest("[data-feature-category]");
    if (categoryButton) {
      active = categoryButton.dataset.featureCategory;
      renderChips();
      renderCards();
      grid.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      return;
    }
    if (event.target.closest("[data-open-phone]")) {
      showPhones(event.target.closest("[data-open-phone]"));
      return;
    }
    if (event.target.closest("[data-open-offers]")) {
      showOffers(event.target.closest("[data-open-offers]"));
      return;
    }
    if (event.target.closest("[data-open-transfer]")) {
      window.openTransferSheet();
      return;
    }
    const chip = event.target.closest("[data-cat]");
    if (chip) {
      active = chip.dataset.cat;
      renderChips();
      renderCards();
    }
  });
  root.addEventListener("keydown", event => {
    const card = event.target.closest(".ibn-cat-card");
    if (!card || event.target.closest("button")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showProduct(card.dataset.id, card);
    }
  });
  grid.addEventListener("click", event => {
    const card = event.target.closest(".ibn-cat-card");
    if (!card || event.target.closest(".ibn-add-cart")) return;
    showProduct(card.dataset.id, card);
  });
  search.addEventListener("input", renderCards);
  modal.querySelector(".ibn-close").addEventListener("click", () => closeModal());
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  modal.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = [...modal.querySelectorAll("button:not([disabled]),a[href],input,select,[tabindex]:not([tabindex='-1'])")];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener("popstate", () => {
    if (modalOpen) closeModal(true);
  });
  window.addEventListener("ibn:prices-updated", () => {
    renderCards();
    const product = DATA.find(item => item.id === modal.dataset.productId);
    const price = modal.querySelector(".ibn-price-detail");
    if (product && price) price.textContent = "Prix : " + product.price;
  });

  renderFeatured();
  renderChips();
  renderCards();
  window.dispatchEvent(new CustomEvent("ibn:catalogue-ready"));
})();
