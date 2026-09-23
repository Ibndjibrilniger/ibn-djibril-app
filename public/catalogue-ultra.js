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

  const css = `
  #ibn-catalogue-ultra{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#17221d;margin:28px auto;max-width:1180px;padding:0 14px}
  .ibn-cat-hero{background:linear-gradient(135deg,#006b42,#008751 55%,#f28c28);color:#fff;border-radius:24px;padding:24px 20px;box-shadow:0 14px 38px rgba(0,0,0,.14)}
  .ibn-cat-hero h2{margin:0 0 6px;font-size:clamp(26px,6vw,42px);line-height:1.05}
  .ibn-cat-hero p{margin:0;opacity:.96;font-size:16px}
  .ibn-cat-tools{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}
  .ibn-cat-search{flex:1;min-width:220px;padding:14px 16px;border:1px solid #d8e2dd;border-radius:14px;font-size:16px;background:#fff}
  .ibn-cat-chips{display:flex;gap:8px;overflow:auto;padding:4px 0 10px;scrollbar-width:thin}
  .ibn-cat-chip{white-space:nowrap;border:1px solid #dce7e1;background:#fff;border-radius:999px;padding:9px 13px;font-weight:700;cursor:pointer}
  .ibn-cat-chip.active{background:#008751;color:#fff;border-color:#008751}
  .ibn-cat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:15px}
  .ibn-cat-card{border:1px solid #e2e8e5;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(9,45,29,.08);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
  .ibn-cat-card:hover,.ibn-cat-card:focus{transform:translateY(-3px);box-shadow:0 14px 34px rgba(9,45,29,.14);outline:2px solid #008751}
  .ibn-cat-img{height:190px;background:#f6f8f7;display:flex;align-items:center;justify-content:center}
  .ibn-cat-img img{width:100%;height:100%;object-fit:contain;display:block}
  .ibn-cat-body{padding:15px}
  .ibn-cat-kicker{font-size:12px;font-weight:800;color:#008751;text-transform:uppercase;letter-spacing:.06em}
  .ibn-cat-card h3{margin:5px 0 6px;font-size:19px;line-height:1.2}
  .ibn-cat-card p{margin:0;color:#657069;font-size:14px;line-height:1.45}
  .ibn-price{display:inline-block;margin-top:9px;background:#fff3e4;color:#8b4a00;border:1px solid #ffd7a5;border-radius:999px;padding:6px 10px;font-weight:900;font-size:14px}
  .ibn-price-detail{display:inline-block;margin:2px 0 14px;background:#fff3e4;color:#8b4a00;border:1px solid #ffd7a5;border-radius:999px;padding:8px 12px;font-weight:900;font-size:16px}
  .ibn-cat-cta{margin-top:10px;color:#008751;font-weight:800;font-size:14px}
  .ibn-modal{position:fixed;inset:0;background:rgba(5,20,13,.72);z-index:99999;display:none;align-items:flex-end;justify-content:center;padding:0}
  .ibn-modal.open{display:flex}
  .ibn-sheet{background:#fff;width:min(760px,100%);max-height:92vh;overflow:auto;border-radius:26px 26px 0 0;box-shadow:0 -20px 70px rgba(0,0,0,.28)}
  .ibn-sheet-top{position:sticky;top:0;background:rgba(255,255,255,.96);backdrop-filter:blur(8px);display:flex;justify-content:flex-end;padding:10px 14px;z-index:2}
  .ibn-close{border:0;background:#eef3f0;border-radius:999px;width:42px;height:42px;font-size:22px;cursor:pointer}
  .ibn-detail{padding:0 18px 24px}
  .ibn-gallery{display:grid;grid-auto-flow:column;grid-auto-columns:88%;overflow-x:auto;gap:10px;scroll-snap-type:x mandatory;margin-bottom:18px}
  .ibn-gallery figure{margin:0;background:#f7f8f8;border:1px solid #e5e9e7;border-radius:18px;min-height:260px;display:flex;align-items:center;justify-content:center;scroll-snap-align:start;overflow:hidden}
  .ibn-gallery img{width:100%;height:360px;max-height:45vh;object-fit:contain;background:#fff}
  .ibn-detail .category{color:#008751;font-weight:800;font-size:13px;text-transform:uppercase}
  .ibn-detail h2{font-size:clamp(25px,7vw,38px);line-height:1.08;margin:5px 0 8px}
  .ibn-detail .sub{color:#657069;margin:0 0 18px;font-size:16px}
  .ibn-specs{margin:0;padding:0;list-style:none;display:grid;gap:9px}
  .ibn-specs li{background:#f5f8f6;border-radius:13px;padding:11px 13px;line-height:1.4}
  .ibn-specs li::before{content:"✓";color:#008751;font-weight:900;margin-right:9px}
  .ibn-note{margin:15px 0;background:#fff7ec;border-left:4px solid #f28c28;padding:12px 13px;border-radius:10px;color:#59432e}
  .ibn-contact-title{text-align:center;margin:22px 0 12px;font-size:20px}
  .ibn-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:center}
  .ibn-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:47px;padding:11px 15px;border-radius:13px;color:#fff;text-decoration:none;font-weight:800}
  .ibn-wa{background:#009b5a}.ibn-tg{background:#229ed9}.ibn-fb{background:#1877f2}.ibn-sms{background:#6558e8}.ibn-call{background:#008751}
  .ibn-empty{padding:26px;text-align:center;color:#6a756f}
  @media(min-width:720px){.ibn-modal{align-items:center;padding:24px}.ibn-sheet{border-radius:26px;max-height:90vh}.ibn-gallery{grid-auto-columns:78%}}
  `;

  const style = document.createElement("style");
  style.id = "ibn-catalogue-style";
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement("section");
  root.id = "ibn-catalogue-ultra";
  root.innerHTML = `
    <div class="ibn-cat-hero">
      <h2>Produits & Solutions professionnelles</h2>
      <p>Réseaux • Wi‑Fi • Starlink • MikroTik • Antennes • Fibre • Maintenance</p>
    </div>
    <div class="ibn-cat-tools">
      <input class="ibn-cat-search" type="search" placeholder="Rechercher un produit, une marque ou un service…" aria-label="Rechercher dans le catalogue">
    </div>
    <div class="ibn-cat-chips" aria-label="Catégories"></div>
    <div class="ibn-cat-grid"></div>
  `;

  const productsSection = document.getElementById("products");
  const contactSection = document.getElementById("contact");
  const main = document.querySelector("main");
  const welcome = main && main.querySelector(".welcome");
  if (welcome) welcome.insertAdjacentElement("afterend", root);
  else if (main) main.insertBefore(root, main.firstChild);
  else document.body.appendChild(root);

  const modal = document.createElement("div");
  modal.className = "ibn-modal";
  modal.setAttribute("role","dialog");
  modal.setAttribute("aria-modal","true");
  modal.setAttribute("aria-label","Détails du produit");
  modal.innerHTML = `<div class="ibn-sheet"><div class="ibn-sheet-top"><button class="ibn-close" aria-label="Fermer">×</button></div><div class="ibn-detail"></div></div>`;
  document.body.appendChild(modal);

  const grid = root.querySelector(".ibn-cat-grid");
  const chips = root.querySelector(".ibn-cat-chips");
  const search = root.querySelector(".ibn-cat-search");
  const categories = ["Tout", ...new Set(DATA.map(p => p.category))];
  let active = "Tout";

  function esc(s){return String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
  function renderChips(){
    chips.innerHTML = categories.map(c=>`<button class="ibn-cat-chip ${c===active?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    chips.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{active=b.dataset.cat;renderChips();renderCards();}));
  }
  function productImage(p){return (p.images && p.images[0]) || "";}
  function renderCards(){
    const q = search.value.trim().toLowerCase();
    const filtered = DATA.filter(p => (active==="Tout" || p.category===active) && (!q || [p.name,p.subtitle,p.category,...(p.specs||[])].join(" ").toLowerCase().includes(q)));
    grid.innerHTML = filtered.map(p=>`
      <article class="ibn-cat-card" tabindex="0" data-id="${esc(p.id)}">
        <div class="ibn-cat-img"><img src="${esc(productImage(p))}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="this.closest('.ibn-cat-img').style.display='none'"></div>
        <div class="ibn-cat-body">
          <div class="ibn-cat-kicker">${esc(p.category)}</div>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.subtitle)}</p>
          ${p.price?`<div class="ibn-price">${esc(p.price)}</div>`:""}
          <div class="ibn-cat-cta">Voir photo & caractéristiques →</div>
        </div>
      </article>
    `).join("") || `<div class="ibn-empty">Aucun résultat. Essayez un autre mot.</div>`;
    grid.querySelectorAll(".ibn-cat-card").forEach(card=>{
      const open = ()=>show(card.dataset.id);
      card.addEventListener("click",open);
      card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
    });
  }
  function show(id){
    const p=DATA.find(x=>x.id===id); if(!p)return;
    const gallery=(p.images||[]).map((src,i)=>`<figure><img src="${esc(src)}" alt="${esc(p.name)} — photo ${i+1}" loading="${i?"lazy":"eager"}" decoding="async"></figure>`).join("");
    const detail=modal.querySelector(".ibn-detail");
    detail.innerHTML=`
      <div class="ibn-gallery">${gallery}</div>
      <div class="category">${esc(p.category)}</div>
      <h2>${esc(p.name)}</h2>
      <p class="sub">${esc(p.subtitle)}</p>
      ${p.price?`<div class="ibn-price-detail">Prix : ${esc(p.price)}</div>`:""}
      <ul class="ibn-specs">${(p.specs||[]).map(s=>`<li>${esc(s)}</li>`).join("")}</ul>
      ${p.note?`<div class="ibn-note">${esc(p.note)}</div>`:""}
      <h3 class="ibn-contact-title">Commander / demander un devis</h3>
      <div class="ibn-actions">
        <a class="ibn-action ibn-wa" href="${CONTACTS.whatsapp}" target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
        <a class="ibn-action ibn-tg" href="${CONTACTS.telegram}">✈️ Telegram</a>
        <a class="ibn-action ibn-fb" href="${CONTACTS.facebook}" target="_blank" rel="noopener noreferrer">● Facebook</a>
        <a class="ibn-action ibn-sms" href="${CONTACTS.sms}">✉️ SMS</a>
        <a class="ibn-action ibn-call" href="${CONTACTS.call}">📞 Appel</a>
      </div>`;
    modal.classList.add("open");
    document.body.style.overflow="hidden";
    modal.querySelector(".ibn-close").focus();
  }
  function close(){modal.classList.remove("open");document.body.style.overflow="";}
  modal.querySelector(".ibn-close").addEventListener("click",close);
  modal.addEventListener("click",e=>{if(e.target===modal)close();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal.classList.contains("open"))close();});
  search.addEventListener("input",renderCards);
  renderChips(); renderCards();
})();
