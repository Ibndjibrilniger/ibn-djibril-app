(() => {
  'use strict';
  if (location.pathname.startsWith('/admin') || navigator.doNotTrack === '1' || navigator.globalPrivacyControl || !window.crypto?.randomUUID) return;
  const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  let visitor, session, queue = [], timer;
  const idle = 30 * 60 * 1000, visitorTTL = 30 * 86400000;
  try {
    const previous = JSON.parse(localStorage.getItem('ibn-activity-visitor') || 'null');
    visitor = previous?.expires > Date.now() ? previous.id : crypto.randomUUID();
    localStorage.setItem('ibn-activity-visitor',JSON.stringify({id:visitor,expires:previous?.id===visitor?previous.expires:Date.now()+visitorTTL}));
    session = JSON.parse(sessionStorage.getItem('ibn-activity-session') || 'null');
  } catch (_) { visitor = crypto.randomUUID(); }
  function activeSession() {
    if (!session || Date.now()-session.last > idle) session = {id:crypto.randomUUID()};
    session.last=Date.now();
    try {sessionStorage.setItem('ibn-activity-session',JSON.stringify(session));} catch (_) {}
    return session.id;
  }
  async function flush() {
    clearTimeout(timer);
    if (!queue.length) return;
    const events=queue.splice(0,20);
    const body=JSON.stringify({visitor,session:activeSession(),events});
    try {
      const response=await fetch('/api/activities',{method:'POST',headers:{'Content-Type':'application/json'},body,
        credentials:'same-origin',keepalive:true,cache:'no-store'});
      if (!response.ok) window.dispatchEvent(new Event('ibn:activity-unavailable'));
    } catch (_) {window.dispatchEvent(new Event('ibn:activity-unavailable'));}
    // Deliberately no persistent queue/retries: never block navigation or replay old activity.
  }
  function track(type,service='') {
    activeSession();
    queue.push({id:crypto.randomUUID(),type,page:location.pathname,service:slug(service)});
    if (queue.length>=20) void flush();
    else {clearTimeout(timer);timer=setTimeout(flush,120);}
  }
  track('page_view');
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flush();});
  window.addEventListener('pagehide',()=>void flush());
  // A delegated listener leaves all existing cards, handlers and destination URLs intact.
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if (!target) return;
    const finance=target.closest('.ibn-finance-service-card');
    if (finance) {
      const name=finance.querySelector('.ibn-finance-service-name')?.textContent;
      track('service_view',name);track('external_click',name);return;
    }
    const country=target.closest('#ibn-finance-tabs [data-country]');
    if (country) {track('finance_category',country.dataset.country);return;}
    if (target.closest('[data-open-phone]')) {track('service_view','accessoires');return;}
    if (target.closest('[data-open-offers]')) {track('service_view','catalogue');return;}
    const product=target.closest('.ibn-cat-card[data-id]');
    if (product) {
      track(target.closest('.ibn-add-cart')?'action':'service_view',product.dataset.id);return;
    }
    const link=target.closest('a[href]');
    if (link) {
      // Never send href, query, hash, contact address or free-form link text.
      try {
        const url=new URL(link.href,location.origin);
        if ((url.protocol==='https:' || url.protocol==='http:') && url.origin!==location.origin) {
          track('external_click',document.querySelector('.ibn-modal.open')?'catalogue':'');return;
        }
      } catch (_) {}
    }
    const service=target.closest('.service-card[data-service]');
    if (service && service.dataset.service!=='transferts') {track('service_view',service.dataset.service);return;}
    if (target.closest('.ibn-cat-chip,[data-feature-category]')) {track('click','catalogue');return;}
    if (target.closest('.service')) {track('service_view','catalogue');return;}
    if (target.closest('button')?.id?.match(/calcul|test/i)) track('action','calcul');
  },true);
  document.addEventListener('keydown',event=>{
    if (event.key!=='Enter' && event.key!==' ') return;
    const card=event.target.closest?.('.ibn-cat-card[data-id]');
    if (card && !event.target.closest('button,a')) track('service_view',card.dataset.id);
  });
  document.addEventListener('submit',event=>{
    if (/calcul|test/i.test(event.target.id || '')) track('action','calcul');
  },true);
  const catalogue=document.querySelector('.ibn-cat-hero');
  if (catalogue && 'IntersectionObserver' in window) {
    const visible=new IntersectionObserver(entries=>{
      if (entries.some(entry=>entry.isIntersecting)) {track('service_view','catalogue');visible.disconnect();}
    },{threshold:0.5});
    visible.observe(catalogue);
  }
  let financeOpen=false;
  new MutationObserver(()=>{
    const open=!!document.querySelector('#ibn-transfer-sheet-overlay.is-open');
    if (open && !financeOpen) {track('finance_open','transferts');track('finance_category','Niger');}
    financeOpen=open;
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
