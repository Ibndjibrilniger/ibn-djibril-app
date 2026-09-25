(() => {
  "use strict";

  let products = new Map();

  const style = document.createElement("style");

  style.textContent = `
    .ibn-admin-stock{
      margin-top:16px;
      padding:14px;
      border-radius:14px;
      background:#f5f8f6;
      border:1px solid #dce7e1;
    }

    .ibn-admin-stock-title{
      font-weight:900;
      margin-bottom:8px;
      color:#087144;
    }

    .ibn-admin-stock-state{
      margin-bottom:10px;
      font-weight:800;
    }

    .ibn-admin-stock input{
      width:100%;
      padding:12px;
      font-size:16px;
      border:1px solid #cbd7d0;
      border-radius:11px;
      margin-bottom:9px;
    }

    .ibn-admin-stock-actions{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:8px;
    }

    .ibn-admin-stock button{
      border:0;
      border-radius:11px;
      padding:12px 8px;
      font-weight:900;
      font-size:14px;
    }

    .ibn-stock-save{
      background:#008751;
      color:white;
    }

    .ibn-stock-zero{
      background:#ffe6e3;
      color:#a52219;
    }

    .ibn-stock-message{
      margin-top:9px;
      font-size:13px;
      font-weight:800;
    }
  `;

  document.head.appendChild(style);

  function stateText(product) {
    if (
      product.outOfStock === true ||
      product.stock === 0
    ) {
      return "❌ Rupture de stock";
    }

    if (
      Number.isInteger(product.stock) &&
      product.stock >= 1 &&
      product.stock <= 5
    ) {
      return "⚠️ Plus que " +
        product.stock +
        " disponible" +
        (product.stock > 1 ? "s" : "");
    }

    if (
      Number.isInteger(product.stock) &&
      product.stock > 5
    ) {
      return "✅ Disponible — stock : " +
        product.stock;
    }

    return "ℹ️ Stock non renseigné";
  }

  async function saveStock(id, value, panel) {
    const message =
      panel.querySelector(".ibn-stock-message");

    message.textContent = "Enregistrement…";

    try {
      const response = await fetch(
        "/api/admin/products/" +
        encodeURIComponent(id) +
        "/stock",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            stock: value
          })
        }
      );

      if (response.status === 401) {
        location.href = "/admin/login";
        return;
      }

      const result = await response.json();

      if (!result.ok) {
        message.textContent =
          "❌ " + (result.error || "Erreur");
        return;
      }

      products.set(id, result.product);

      panel.querySelector(
        ".ibn-admin-stock-state"
      ).textContent =
        stateText(result.product);

      const input =
        panel.querySelector(".ibn-stock-input");

      input.value =
        Number.isInteger(result.product.stock)
          ? result.product.stock
          : "";

      message.textContent =
        "✅ Stock enregistré avec succès";

    } catch (err) {
      message.textContent =
        "❌ Impossible de joindre le serveur";
    }
  }

  function installPanels() {
    document
      .querySelectorAll(".product[data-id]")
      .forEach(card => {

        if (
          card.querySelector(".ibn-admin-stock")
        ) return;

        const id = card.dataset.id;
        const product = products.get(id);

        if (!product) return;

        const panel =
          document.createElement("div");

        panel.className = "ibn-admin-stock";

        panel.innerHTML = `
          <div class="ibn-admin-stock-title">
            📦 Gestion du stock
          </div>

          <div class="ibn-admin-stock-state">
            ${stateText(product)}
          </div>

          <input
            class="ibn-stock-input"
            type="number"
            min="0"
            step="1"
            placeholder="Stock disponible"
            value="${
              Number.isInteger(product.stock)
                ? product.stock
                : ""
            }"
          >

          <div class="ibn-admin-stock-actions">
            <button
              type="button"
              class="ibn-stock-save"
            >
              💾 Enregistrer
            </button>

            <button
              type="button"
              class="ibn-stock-zero"
            >
              ❌ Rupture
            </button>
          </div>

          <div class="ibn-stock-message"></div>
        `;

        card.appendChild(panel);

        const input =
          panel.querySelector(".ibn-stock-input");

        panel
          .querySelector(".ibn-stock-save")
          .addEventListener("click", () => {

            const value =
              input.value.trim() === ""
                ? null
                : Number(input.value);

            saveStock(id, value, panel);
          });

        panel
          .querySelector(".ibn-stock-zero")
          .addEventListener("click", () => {
            input.value = "0";
            saveStock(id, 0, panel);
          });
      });
  }

  async function loadProducts() {
    try {
      const response =
        await fetch("/api/admin/products");

      if (response.status === 401) {
        location.href = "/admin/login";
        return;
      }

      const result = await response.json();

      if (!result.ok) return;

      products = new Map(
        result.products.map(product => [
          product.id,
          product
        ])
      );

      installPanels();

      new MutationObserver(
        installPanels
      ).observe(
        document.getElementById("products"),
        {
          childList: true,
          subtree: false
        }
      );

    } catch (err) {
      console.error(err);
    }
  }

  loadProducts();
})();
