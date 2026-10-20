(() => {
  'use strict';
  if (window.IbnActivityPrivacy) return;
  const key = 'ibn-analytics-consent-v1';
  const blocked = () => navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  let choice = null, banner;
  try { choice = localStorage.getItem(key); } catch (_) {}
  if (choice !== 'granted' && choice !== 'denied') choice = null;
  function clearIds() {
    try { localStorage.removeItem('ibn-activity-visitor'); } catch (_) {}
    try { sessionStorage.removeItem('ibn-activity-session'); } catch (_) {}
  }
  if (!choice || choice === 'denied' || blocked()) clearIds();
  const allowed = () => !blocked() && choice === 'granted';
  function setChoice(value) {
    choice = value;
    let saved = false;
    try { localStorage.setItem(key, value); saved = true; } catch (_) {}
    if (!allowed()) clearIds();
    window.dispatchEvent(new Event('ibn:analytics-consent'));
    banner?.remove();
    if (!saved) {
      const notice = document.createElement('p');
      notice.className = 'activity-consent-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = 'Stockage indisponible : votre choix statistique vaut uniquement pour cette page.';
      document.body.append(notice);
    }
  }
  function open() {
    banner?.remove();
    banner = document.createElement('aside');
    banner.className = 'activity-consent';
    banner.setAttribute('aria-label', 'Votre choix pour les statistiques');
    const title = document.createElement('strong');
    title.textContent = 'Votre choix pour les statistiques';
    const text = document.createElement('p');
    text.textContent = blocked()
      ? 'Le suivi est désactivé par la protection de votre navigateur. Aucun identifiant statistique n’est créé.'
      : 'Acceptez-vous des statistiques privées de fréquentation ? Appareil, navigateur, pages consultées et pays estimé par calcul local à partir de l’IP, sans conserver cette IP ni l’envoyer à un service tiers. Sans GPS ni données de formulaire. Vous pouvez refuser sans limiter les services.';
    banner.append(title, text);
    for (const [value, label] of [['granted', 'Accepter les statistiques'], ['denied', 'Refuser les statistiques']]) {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label;
      button.dataset.analyticsChoice = value;
      if (value === 'granted' && blocked()) button.disabled = true;
      button.addEventListener('click', () => setChoice(value));
      banner.append(button);
    }
    const link = document.createElement('a');
    link.href = '/parametres.html#confidentialite';
    link.textContent = 'Confidentialité et réglages';
    banner.append(link);
    document.body.append(banner);
  }
  window.IbnActivityPrivacy = { allowed, open };
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = event.key === key && ['granted','denied'].includes(event.newValue) ? event.newValue : null;
    if (!allowed()) clearIds();
    banner?.remove();
    window.dispatchEvent(new Event('ibn:analytics-consent'));
  });
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = '/activity-consent.css?v=20261018-collection3';
  document.head.append(css);
  document.querySelector('#analytics-choice')?.addEventListener('click', open);
  function status() {
    const target=document.querySelector('#analytics-status');
    if (!target) return;
    const current=window.IbnActivityCollection?.status;
    target.textContent=!allowed()?'Statistiques désactivées : aucun événement ne sera envoyé sans votre accord.':
      current==='recorded'?'Enregistrement confirmé par PostgreSQL pour cette page.':
      current==='duplicate'?'Les événements de cette page ont déjà été reçus (sans doublon).':
      current==='unavailable'?'Enregistrement indisponible : les statistiques de cette page n’ont pas pu être confirmées. Les services restent accessibles.':
      current==='disabled'?'Le serveur a désactivé le suivi pour cette requête.':
      'Statistiques autorisées ; en attente de confirmation du serveur pour cette page.';
  }
  window.addEventListener('ibn:activity-status',status);
  window.addEventListener('ibn:analytics-consent',status);
  status();
  if (!choice && !blocked() && !location.pathname.startsWith('/admin')) open();
})();
