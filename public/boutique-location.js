(() => {
  "use strict";

  const BUSINESS_NAME = "Ibn_Djibril Niger Tech 🇳🇪";
  const LOCATION_NAME = "Tara, Niger";
  const MAPS_URL = "https://maps.app.goo.gl/UxHmcbGBuQQ8ftpj6";

  const box = document.createElement("section");
  box.id = "ibn-boutique-location";

  box.innerHTML = `
    <div class="ibn-location-shop">
      <div class="ibn-location-shop-icon">📍</div>

      <div class="ibn-location-shop-text">
        <strong>Localiser ${BUSINESS_NAME}</strong>
        <span>🏪 ${BUSINESS_NAME}</span>
        <small>📌 ${LOCATION_NAME}</small>
        <small>Ouvrez Google Maps pour obtenir l’itinéraire.</small>
      </div>

      <a
        href="${MAPS_URL}"
        target="_blank"
        rel="noopener noreferrer"
        class="ibn-location-shop-btn"
        title="Localiser ${BUSINESS_NAME} sur Google Maps"
        aria-label="Ouvrir la localisation de ${BUSINESS_NAME} sur Google Maps"
      >
        🗺️ Google Maps
      </a>
    </div>
  `;

  const style = document.createElement("style");

  style.textContent = `
    #ibn-boutique-location{
      max-width:1180px;
      margin:20px auto;
      padding:0 14px;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    }

    .ibn-location-shop{
      background:#fff;
      border:1px solid #e0e9e4;
      border-radius:20px;
      padding:16px;
      display:flex;
      align-items:center;
      gap:14px;
      box-shadow:0 8px 25px rgba(0,0,0,.08);
    }

    .ibn-location-shop-icon{
      font-size:36px;
    }

    .ibn-location-shop-text{
      flex:1;
      display:flex;
      flex-direction:column;
      gap:4px;
    }

    .ibn-location-shop-text strong{
      color:#087144;
      font-size:18px;
    }

    .ibn-location-shop-text span{
      font-weight:800;
    }

    .ibn-location-shop-text small{
      color:#68756e;
    }

    .ibn-location-shop-btn{
      background:#008751;
      color:#fff;
      text-decoration:none;
      padding:13px 18px;
      border-radius:12px;
      font-weight:900;
      text-align:center;
    }

    @media(max-width:650px){
      .ibn-location-shop{
        flex-direction:column;
        align-items:stretch;
      }

      .ibn-location-shop-btn{
        width:100%;
      }
    }
  `;

  document.head.appendChild(style);

  const contact = document.getElementById("contact");

  if (contact && contact.parentNode) {
    contact.parentNode.insertBefore(box, contact.nextSibling);
  } else {
    document.body.appendChild(box);
  }
})();
