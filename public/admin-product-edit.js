(() => {
  "use strict";

  let products = new Map();

  const style = document.createElement("style");

  style.textContent = `
    .ibn-edit-box{
      margin-top:14px;
      padding:14px;
      background:#fff8ec;
      border:1px solid #f4d8ad;
      border-radius:14px;
    }

    .ibn-edit-toggle{
      width:100%;
      border:0;
      background:#f28c28;
      color:white;
      border-radius:12px;
      padding:13px;
      font-weight:900;
      font-size:15px;
    }

    .ibn-edit-panel{
      display:none;
      margin-top:14px;
    }

    .ibn-edit-panel.open{
      display:block;
    }

    .ibn-edit-panel label{
      display:block;
      font-weight:800;
      margin-top:11px;
    }

    .ibn-edit-panel input,
    .ibn-edit-panel textarea{
      width:100%;
      margin-top:5px;
      padding:11px;
      border:1px solid #ccd8d1;
      border-radius:10px;
      font-size:15px;
      font-family:inherit;
    }

    .ibn-edit-panel textarea{
      min-height:110px;
    }

    .ibn-edit-save,
    .ibn-photo-save,
    .ibn-active-btn{
      width:100%;
      border:0;
      border-radius:11px;
      padding:12px;
      margin-top:11px;
      font-weight:900;
      font-size:14px;
    }

    .ibn-edit-save{
      background:#008751;
      color:white;
    }

    .ibn-photo-save{
      background:#155eef;
      color:white;
    }

    .ibn-active-btn{
      background:#17221d;
      color:white;
    }

    .ibn-active-btn.off{
      background:#a52219;
    }

    .ibn-edit-status{
      margin-top:10px;
      font-weight:800;
      font-size:13px;
    }

    .ibn-edit-photo{
      display:block;
      width:100%;
      max-height:220px;
      object-fit:contain;
      background:#f4f6f5;
      border-radius:12px;
      margin-top:10px;
    }

    .ibn-product-state{
      margin-top:8px;
      font-weight:900;
    }
  `;

  document.head.appendChild(style);


  async function api(url, options = {}) {
    const response =
      await fetch(url, options);

    if (response.status === 401) {
      location.href = "/admin/login";
      throw new Error("Session expirée");
    }

    return response.json();
  }


  function updateActiveUI(panel, product) {
    const state =
      panel.querySelector(".ibn-product-state");

    const button =
      panel.querySelector(".ibn-active-btn");

    const active =
      product.active !== false;

    state.textContent =
      active
        ? "✅ Produit visible sur le site"
        : "🚫 Produit masqué du site";

    button.textContent =
      active
        ? "🚫 Désactiver ce produit"
        : "✅ Réactiver ce produit";

    button.classList.toggle(
      "off",
      active
    );
  }


  function install() {
    document
      .querySelectorAll(".product[data-id]")
      .forEach(card => {

        if (
          card.querySelector(".ibn-edit-box")
        ) return;

        const id = card.dataset.id;
        const product = products.get(id);

        if (!product) return;

        const box =
          document.createElement("div");

        box.className = "ibn-edit-box";

        box.innerHTML = `
          <button
            type="button"
            class="ibn-edit-toggle"
          >
            ✏️ Modifier ce produit
          </button>

          <div class="ibn-edit-panel">

            <div class="ibn-product-state"></div>

            <label>
              Nom du produit
              <input class="edit-name">
            </label>

            <label>
              Catégorie
              <input class="edit-category">
            </label>

            <label>
              Petite description
              <input class="edit-subtitle">
            </label>

            <label>
              Caractéristiques
              <textarea
                class="edit-specs"
                placeholder="Une caractéristique par ligne"
              ></textarea>
            </label>

            <button
              type="button"
              class="ibn-edit-save"
            >
              💾 Enregistrer les modifications
            </button>

            <hr style="
              border:0;
              border-top:1px solid #ddd;
              margin:18px 0
            ">

            <strong>📷 Photo principale</strong>

            <img
              class="ibn-edit-photo"
              alt="Photo du produit"
            >

            <input
              class="edit-photo-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            >

            <button
              type="button"
              class="ibn-photo-save"
            >
              📷 Changer la photo
            </button>

            <button
              type="button"
              class="ibn-active-btn"
            ></button>

            <div class="ibn-edit-status"></div>

          </div>
        `;

        card.appendChild(box);

        const panel =
          box.querySelector(".ibn-edit-panel");

        const name =
          box.querySelector(".edit-name");

        const category =
          box.querySelector(".edit-category");

        const subtitle =
          box.querySelector(".edit-subtitle");

        const specs =
          box.querySelector(".edit-specs");

        const photo =
          box.querySelector(".ibn-edit-photo");

        const photoFile =
          box.querySelector(".edit-photo-file");

        const status =
          box.querySelector(".ibn-edit-status");

        name.value = product.name || "";
        category.value = product.category || "";
        subtitle.value = product.subtitle || "";

        specs.value =
          Array.isArray(product.specs)
            ? product.specs.join("\n")
            : "";

        if (
          Array.isArray(product.images) &&
          product.images[0]
        ) {
          photo.src = product.images[0];
        } else {
          photo.style.display = "none";
        }

        updateActiveUI(panel, product);


        box
          .querySelector(".ibn-edit-toggle")
          .addEventListener("click", () => {
            panel.classList.toggle("open");
          });


        box
          .querySelector(".ibn-edit-save")
          .addEventListener(
            "click",
            async () => {

              status.textContent =
                "Enregistrement…";

              try {
                const result = await api(
                  "/api/admin/products/" +
                  encodeURIComponent(id) +
                  "/details",
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type":
                        "application/json"
                    },
                    body: JSON.stringify({
                      name: name.value.trim(),
                      category:
                        category.value.trim(),
                      subtitle:
                        subtitle.value.trim(),
                      specs: specs.value
                    })
                  }
                );

                if (!result.ok) {
                  status.textContent =
                    "❌ " +
                    (result.error || "Erreur");
                  return;
                }

                products.set(
                  id,
                  result.product
                );

                status.textContent =
                  "✅ Produit modifié avec succès";

              } catch (err) {
                status.textContent =
                  "❌ Impossible d’enregistrer";
              }
            }
          );


        box
          .querySelector(".ibn-photo-save")
          .addEventListener(
            "click",
            async () => {

              if (!photoFile.files[0]) {
                status.textContent =
                  "❌ Choisissez une photo.";
                return;
              }

              status.textContent =
                "Envoi de la photo…";

              try {
                const data =
                  new FormData();

                data.append(
                  "photo",
                  photoFile.files[0]
                );

                const result = await api(
                  "/api/admin/products/" +
                  encodeURIComponent(id) +
                  "/photo",
                  {
                    method: "POST",
                    body: data
                  }
                );

                if (!result.ok) {
                  status.textContent =
                    "❌ " +
                    (result.error || "Erreur");
                  return;
                }

                products.set(
                  id,
                  result.product
                );

                if (
                  result.product.images &&
                  result.product.images[0]
                ) {
                  photo.src =
                    result.product.images[0] +
                    "?v=" +
                    Date.now();

                  photo.style.display =
                    "block";
                }

                photoFile.value = "";

                status.textContent =
                  "✅ Photo modifiée avec succès";

              } catch (err) {
                status.textContent =
                  "❌ Impossible de changer la photo";
              }
            }
          );


        box
          .querySelector(".ibn-active-btn")
          .addEventListener(
            "click",
            async () => {

              const current =
                products.get(id);

              const active =
                current.active !== false;

              status.textContent =
                "Mise à jour…";

              try {
                const result = await api(
                  "/api/admin/products/" +
                  encodeURIComponent(id) +
                  "/active",
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type":
                        "application/json"
                    },
                    body: JSON.stringify({
                      active: !active
                    })
                  }
                );

                if (!result.ok) {
                  status.textContent =
                    "❌ " +
                    (result.error || "Erreur");
                  return;
                }

                products.set(
                  id,
                  result.product
                );

                updateActiveUI(
                  panel,
                  result.product
                );

                status.textContent =
                  result.product.active !== false
                    ? "✅ Produit réactivé"
                    : "✅ Produit désactivé";

              } catch (err) {
                status.textContent =
                  "❌ Impossible de changer l’état";
              }
            }
          );
      });
  }


  async function load() {
    try {
      const result =
        await api("/api/admin/products");

      if (!result.ok) return;

      products = new Map(
        result.products.map(p => [
          p.id,
          p
        ])
      );

      install();

      const root =
        document.getElementById("products");

      if (root) {
        new MutationObserver(
          install
        ).observe(
          root,
          {
            childList: true,
            subtree: false
          }
        );
      }

    } catch (err) {
      console.error(err);
    }
  }

  load();
})();
