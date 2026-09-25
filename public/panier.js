(function () {
  "use strict";

  const WHATSAPP = "22796784870";

  function installCountryField() {
    const phone = document.getElementById("ibn-client-phone");
    const nameInput = document.getElementById("ibn-client-name");

    if (nameInput) {
      nameInput.placeholder = "Nom et prénom";
    }

    if (
      !phone ||
      document.getElementById("ibn-client-country")
    ) return;

    const countries = Array.isArray(window.IBN_COUNTRIES)
      ? window.IBN_COUNTRIES
      : [];

    if (!countries.length) return;

    const wrapper = document.createElement("label");

    wrapper.style.display = "block";
    wrapper.style.margin = "12px 0";

    const title = document.createElement("span");
    title.textContent = "Pays / indicatif";
    title.style.display = "block";
    title.style.fontWeight = "800";
    title.style.marginBottom = "6px";

    const select = document.createElement("select");

    select.id = "ibn-client-country";

    select.style.width = "100%";
    select.style.padding = "13px";
    select.style.border = "1px solid #ccd8d1";
    select.style.borderRadius = "12px";
    select.style.fontSize = "16px";
    select.style.background = "#fff";

    countries.forEach(country => {
      const option = document.createElement("option");

      option.value = country.code;
      option.dataset.dial = country.dial;
      option.dataset.flag = country.flag;
      option.dataset.name = country.name;

      option.textContent =
        country.flag +
        " " +
        country.name +
        " (" +
        country.dial +
        ")";

      if (country.code === "NE") {
        option.selected = true;
      }

      select.appendChild(option);
    });

    wrapper.appendChild(title);
    wrapper.appendChild(select);

    const phoneLabel = phone.closest("label");

    if (phoneLabel && phoneLabel.parentNode) {
      phoneLabel.parentNode.insertBefore(
        wrapper,
        phoneLabel
      );
    } else {
      phone.parentNode.insertBefore(
        wrapper,
        phone
      );
    }

    function updatePhone() {
      const option =
        select.options[select.selectedIndex];

      if (!option) return;

      phone.placeholder =
        "Numéro sans indicatif — " +
        option.dataset.dial;
    }

    select.addEventListener(
      "change",
      updatePhone
    );

    updatePhone();
  }

  const countryObserver =
    new MutationObserver(installCountryField);

  countryObserver.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  window.addEventListener(
    "DOMContentLoaded",
    installCountryField
  );

  setTimeout(installCountryField, 0);

  const STORAGE = "ibn_djibril_panier_v1";
  let panier = chargerPanier();
  let localisation = "";

  function catalogue() {
    return Array.isArray(window.IBN_CATALOGUE) ? window.IBN_CATALOGUE : [];
  }

  function produit(id) {
    return catalogue().find(p => p.id === id);
  }

  function chargerPanier() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE)) || {};
    } catch (e) {
      return {};
    }
  }

  function sauvegarder() {
    localStorage.setItem(STORAGE, JSON.stringify(panier));
  }

  function formatPrix(n) {
    return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
  }

  function quantiteTotale() {
    return Object.values(panier).reduce((a, b) => a + b, 0);
  }

  function totalFixe() {
    let total = 0;
    Object.entries(panier).forEach(([id, qte]) => {
      const p = produit(id);
      if (p && Number.isFinite(p.priceValue)) {
        total += p.priceValue * qte;
      }
    });
    return total;
  }

  const style = document.createElement("style");
  style.textContent = `
    .ibn-add-cart{
      width:100%;margin:10px 0 4px;padding:12px 14px;border:0;
      border-radius:14px;background:#008751;color:#fff;
      font-size:15px;font-weight:900;cursor:pointer;
      box-shadow:0 6px 16px rgba(0,135,81,.18)
    }
    .ibn-add-cart:active{transform:scale(.98)}

    #ibn-cart-float{
      position:fixed;right:18px;bottom:22px;z-index:9998;
      border:0;border-radius:999px;background:#008751;color:#fff;
      padding:13px 17px;font-weight:900;font-size:16px;
      box-shadow:0 12px 30px rgba(0,0,0,.22);cursor:pointer
    }
    #ibn-cart-count{
      display:inline-flex;align-items:center;justify-content:center;
      min-width:24px;height:24px;margin-left:7px;padding:0 6px;
      border-radius:999px;background:#f28c28;color:#fff;font-size:13px
    }

    #ibn-cart-overlay{
      display:none;position:fixed;inset:0;background:rgba(0,0,0,.48);
      z-index:9999
    }
    #ibn-cart-overlay.open{display:block}

    #ibn-cart-panel{
      position:absolute;right:0;top:0;height:100%;width:min(94vw,460px);
      background:#f8faf9;overflow:auto;padding:20px;
      box-sizing:border-box;box-shadow:-14px 0 40px rgba(0,0,0,.2)
    }
    .ibn-cart-head{
      display:flex;justify-content:space-between;align-items:center;
      gap:12px;margin-bottom:16px
    }
    .ibn-cart-head h2{margin:0;font-size:26px}
    .ibn-cart-close{
      border:0;background:#eee;border-radius:50%;width:42px;height:42px;
      font-size:24px;cursor:pointer
    }
    .ibn-cart-item{
      background:#fff;border:1px solid #e3e7e5;border-radius:16px;
      padding:14px;margin:10px 0;box-shadow:0 5px 16px rgba(0,0,0,.05)
    }
    .ibn-cart-name{font-weight:900;font-size:16px;margin-bottom:6px}
    .ibn-cart-price{color:#008751;font-weight:800}
    .ibn-cart-controls{
      display:flex;align-items:center;gap:9px;margin-top:10px;flex-wrap:wrap
    }
    .ibn-cart-controls button{
      border:0;border-radius:10px;padding:8px 12px;font-weight:900;
      cursor:pointer
    }
    .ibn-minus,.ibn-plus{background:#e9f5ef;color:#006b42}
    .ibn-remove{background:#ffe9e9;color:#a40000;margin-left:auto}

    .ibn-cart-total{
      background:#083b2c;color:#fff;border-radius:16px;padding:15px;
      margin:16px 0;font-size:18px;font-weight:900
    }
    .ibn-cart-note{
      font-size:13px;color:#666;margin-top:7px;font-weight:500
    }
    .ibn-checkout{
      background:#fff;border-radius:18px;padding:16px;
      border:1px solid #e3e7e5;margin-top:14px
    }
    .ibn-checkout h3{margin-top:0}
    .ibn-checkout input,.ibn-checkout textarea{
      width:100%;box-sizing:border-box;margin:6px 0;padding:12px 13px;
      border:1px solid #ccd5d1;border-radius:12px;font-size:16px
    }
    .ibn-location,.ibn-order{
      width:100%;border:0;border-radius:13px;padding:13px;
      font-weight:900;font-size:15px;margin-top:8px;cursor:pointer
    }
    .ibn-location{background:#eef4ff;color:#164f9c}
    .ibn-order{background:#25D366;color:#fff;font-size:17px}
    #ibn-location-status{font-size:13px;color:#555;margin-top:6px}
    .ibn-empty{
      text-align:center;padding:28px 10px;color:#777
    }
  `;
  document.head.appendChild(style);

  const bouton = document.createElement("button");
  bouton.id = "ibn-cart-float";
  bouton.innerHTML = `🛒 Panier <span id="ibn-cart-count">0</span>`;
  document.body.appendChild(bouton);

  const overlay = document.createElement("div");
  overlay.id = "ibn-cart-overlay";
  overlay.innerHTML = `
    <div id="ibn-cart-panel">
      <div class="ibn-cart-head">
        <h2>🛒 Mon panier</h2>
        <button class="ibn-cart-close" aria-label="Fermer">×</button>
      </div>

      <div id="ibn-cart-items"></div>

      <div class="ibn-cart-total">
        Total des produits à prix fixe :
        <div id="ibn-cart-total-value">0 FCFA</div>
        <div class="ibn-cart-note" id="ibn-cart-negotiable"></div>
      </div>

      <div class="ibn-checkout">
        <h3>📦 Finaliser la commande</h3>
        <input id="ibn-client-name" type="text" placeholder="Nom et prénom *">
        <input id="ibn-client-phone" type="tel" placeholder="Votre numéro de téléphone *">
        <textarea id="ibn-client-address" rows="3" placeholder="Adresse / quartier / ville"></textarea>

        <button class="ibn-location" id="ibn-add-location">
          📍 Ajouter ma localisation
        </button>
        <div id="ibn-location-status"></div>

        <button class="ibn-order" id="ibn-send-order">
          ✅ Commander sur WhatsApp
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function rendu() {
    const zone = document.getElementById("ibn-cart-items");
    const lignes = Object.entries(panier);

    document.getElementById("ibn-cart-count").textContent = quantiteTotale();

    if (!lignes.length) {
      zone.innerHTML = `<div class="ibn-empty">Votre panier est vide.</div>`;
    } else {
      zone.innerHTML = lignes.map(([id, qte]) => {
        const p = produit(id);
        if (!p) return "";

        const fixe = Number.isFinite(p.priceValue);
        const prix = fixe ? formatPrix(p.priceValue) : "Prix à discuter";
        const sousTotal = fixe
          ? `<div><strong>Sous-total : ${formatPrix(p.priceValue * qte)}</strong></div>`
          : "";

        return `
          <div class="ibn-cart-item" data-cart-id="${id}">
            <div class="ibn-cart-name">${p.name}</div>
            <div class="ibn-cart-price">${prix}</div>
            ${sousTotal}
            <div class="ibn-cart-controls">
              <button class="ibn-minus" data-action="minus">−</button>
              <strong>${qte}</strong>
              <button class="ibn-plus" data-action="plus">+</button>
              <button class="ibn-remove" data-action="remove">Supprimer</button>
            </div>
          </div>
        `;
      }).join("");
    }

    document.getElementById("ibn-cart-total-value").textContent =
      formatPrix(totalFixe());

    const negociables = lignes.filter(([id]) => {
      const p = produit(id);
      return p && !Number.isFinite(p.priceValue);
    }).length;

    document.getElementById("ibn-cart-negotiable").textContent =
      negociables
        ? `${negociables} produit(s) avec prix à discuter ne sont pas inclus dans ce total.`
        : "";
  }

  function ajouter(id) {
    panier[id] = (panier[id] || 0) + 1;
    sauvegarder();
    rendu();

    const b = document.getElementById("ibn-cart-float");
    const ancien = b.innerHTML;
    b.innerHTML = `✅ Ajouté <span id="ibn-cart-count">${quantiteTotale()}</span>`;
    setTimeout(() => {
      b.innerHTML = `🛒 Panier <span id="ibn-cart-count">${quantiteTotale()}</span>`;
    }, 900);
  }

  document.addEventListener("click", function (e) {
    const add = e.target.closest(".ibn-add-cart");
    if (!add) return;

    e.preventDefault();
    e.stopPropagation();
    ajouter(add.dataset.id);
  }, true);

  bouton.addEventListener("click", function () {
    rendu();
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  });

  overlay.querySelector(".ibn-cart-close").addEventListener("click", fermer);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) fermer();
  });

  function fermer() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  document.getElementById("ibn-cart-items").addEventListener("click", function (e) {
    const item = e.target.closest("[data-cart-id]");
    const action = e.target.dataset.action;
    if (!item || !action) return;

    const id = item.dataset.cartId;

    if (action === "plus") panier[id] = (panier[id] || 0) + 1;
    if (action === "minus") {
      panier[id] = Math.max(0, (panier[id] || 0) - 1);
      if (panier[id] === 0) delete panier[id];
    }
    if (action === "remove") delete panier[id];

    sauvegarder();
    rendu();
  });

  document.getElementById("ibn-add-location").addEventListener("click", function () {
    const status =
      document.getElementById("ibn-location-status");

    const bouton = this;

    if (!navigator.geolocation) {
      status.textContent =
        "❌ La géolocalisation n’est pas prise en charge sur cet appareil.";
      return;
    }

    if (!window.isSecureContext) {
      status.textContent =
        "❌ La localisation nécessite une connexion sécurisée HTTPS.";
      return;
    }

    status.textContent =
      "📡 Recherche de votre position…";

    bouton.disabled = true;

    navigator.geolocation.getCurrentPosition(
      function (position) {
        const lat =
          position.coords.latitude.toFixed(6);

        const lon =
          position.coords.longitude.toFixed(6);

        const precision =
          Math.round(position.coords.accuracy || 0);

        localisation =
          "https://www.google.com/maps?q=" +
          lat + "," + lon;

        status.innerHTML =
          '✅ Localisation ajoutée' +
          (precision ? ' — précision ≈ ' + precision + ' m' : '') +
          '<br><a href="' +
          localisation +
          '" target="_blank" rel="noopener">🗺️ Voir ma position sur la carte</a>';

        bouton.disabled = false;
      },

      function (error) {
        let message =
          "⚠️ Impossible d’obtenir votre position.";

        if (error.code === 1) {
          message =
            "❌ Autorisation refusée. Autorisez la localisation dans Chrome.";
        }

        if (error.code === 2) {
          message =
            "⚠️ Position indisponible. Activez le GPS/localisation du téléphone.";
        }

        if (error.code === 3) {
          message =
            "⌛ Délai dépassé. Sortez dans une zone avec meilleur signal GPS puis réessayez.";
        }

        status.textContent = message;
        bouton.disabled = false;
      },

      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  });

  document.getElementById("ibn-send-order").addEventListener("click", function () {
    const lignes = Object.entries(panier);

    if (!lignes.length) {
      alert("Votre panier est vide.");
      return;
    }

    const nom = document.getElementById("ibn-client-name").value.trim();
    const telephoneLocal =
      document.getElementById("ibn-client-phone").value.trim();

    const countrySelect =
      document.getElementById("ibn-client-country");

    if (!countrySelect) {
      alert("Veuillez sélectionner votre pays.");
      return;
    }

    const countryOption =
      countrySelect.options[
        countrySelect.selectedIndex
      ];

    const pays =
      countryOption.dataset.name || "";

    const drapeau =
      countryOption.dataset.flag || "";

    const indicatif =
      countryOption.dataset.dial || "";

    const chiffres =
      telephoneLocal.replace(/[^0-9]/g, "");

    const telephone =
      indicatif + chiffres;
    const adresse = document.getElementById("ibn-client-address").value.trim();

    if (!nom || !chiffres) {
      alert("Veuillez renseigner votre nom et votre numéro de téléphone.");
      return;
    }

    let texte = `Bonjour Ibn_Djibril Niger Tech 🇳🇪\n`;
    texte += `Je souhaite passer une commande.\n\n`;
    texte += `👤 Client : ${nom}\n`;
    texte += `📞 Téléphone : ${telephone}\n`;
    if (adresse) texte += `📍 Adresse : ${adresse}\n`;
    if (localisation) texte += `🗺️ Localisation : ${localisation}\n`;

    texte += `\n🛒 PRODUITS COMMANDÉS :\n`;

    let existeNegociable = false;

    lignes.forEach(([id, qte], index) => {
      const p = produit(id);
      if (!p) return;

      if (Number.isFinite(p.priceValue)) {
        texte += `${index + 1}. ${p.name} × ${qte} — ${formatPrix(p.priceValue * qte)}\n`;
      } else {
        existeNegociable = true;
        texte += `${index + 1}. ${p.name} × ${qte} — Prix à discuter\n`;
      }
    });

    texte += `\n💰 TOTAL PRIX FIXES : ${formatPrix(totalFixe())}\n`;

    if (existeNegociable) {
      texte += `ℹ️ Certains produits ont un prix à discuter et ne sont pas inclus dans le total.\n`;
    }

    texte += `\nMerci de confirmer la disponibilité et la commande.`;

    window.open(
      `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texte)}`,
      "_blank"
    );
  });

  rendu();
})();
