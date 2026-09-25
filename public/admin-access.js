(() => {
  "use strict";

  const admin = document.createElement("a");

  admin.href = "/admin/entry";
  admin.id = "ibn-private-admin";
  admin.innerHTML = "🔐 Gestion";

  const style = document.createElement("style");

  style.textContent = `
    #ibn-private-admin{
      position:fixed;
      left:16px;
      bottom:22px;
      z-index:9998;
      padding:10px 14px;
      background:#17221d;
      color:white;
      text-decoration:none;
      border-radius:30px;
      font-size:13px;
      font-weight:800;
      box-shadow:0 6px 18px rgba(0,0,0,.18);
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(admin);
})();
