(() => {
  'use strict';
  if (window.__ibnActivityTrackerLoaded) return;
  window.__ibnActivityTrackerLoaded = true;
  if (location.pathname.startsWith('/admin') || navigator.doNotTrack === '1' || navigator.globalPrivacyControl || !window.crypto?.randomUUID) return;
  const allowed = () => window.IbnActivityPrivacy?.allowed() === true;
  function collectionStatus(status,count=0) {
    window.IbnActivityCollection={status,count,at:new Date().toISOString()};
    window.dispatchEvent(new Event('ibn:activity-status'));
  }
  let started = false;
  function startTracking() {
  if (started || !allowed()) return;
  started = true;
  const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
  const validID = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  let visitor, session, queue = [], timer, consentEpoch=0;
  const idle = 30 * 60 * 1000, visitorTTL = 30 * 86400000;
  try {
    const previous = JSON.parse(localStorage.getItem('ibn-activity-visitor') || 'null');
    visitor = previous?.expires > Date.now() && validID(previous.id) ? previous.id : crypto.randomUUID();
    localStorage.setItem('ibn-activity-visitor',JSON.stringify({id:visitor,expires:previous?.id===visitor?previous.expires:Date.now()+visitorTTL}));
    session = JSON.parse(sessionStorage.getItem('ibn-activity-session') || 'null');
    if (!validID(session?.id) || !Number.isFinite(session?.last)) session=null;
  } catch (_) { visitor = crypto.randomUUID(); }
  function activeSession() {
    if (!visitor) {
      visitor=crypto.randomUUID();
      try {localStorage.setItem('ibn-activity-visitor',JSON.stringify({id:visitor,expires:Date.now()+visitorTTL}));} catch (_) {}
    }
    if (!session || Date.now()-session.last > idle) session = {id:crypto.randomUUID(),source:source()};
    session.last=Date.now();
    try {sessionStorage.setItem('ibn-activity-session',JSON.stringify(session));} catch (_) {}
    return session.id;
  }
  async function flush() {
    clearTimeout(timer);
    if (!allowed()) {queue=[];return;}
    if (!queue.length) return;
    const events=queue.splice(0,20);
    const epoch=consentEpoch;
    const body=JSON.stringify({visitor,session:activeSession(),source:session.source,consent:'granted',events});
    // Bounded, in-memory retries reuse the exact event IDs. PostgreSQL deduplicates.
    // Nothing is saved to disk, and consent revocation stops any further attempt.
    for(let attempt=0;attempt<3 && allowed() && epoch===consentEpoch;attempt++) {
      try {
        const response=await fetch('/api/activities',{method:'POST',headers:{'Content-Type':'application/json'},body,
          credentials:'same-origin',keepalive:true,cache:'no-store'});
        if (!allowed() || epoch!==consentEpoch) return;
        const status=response.headers.get('X-Activity-Status');
        if (response.ok && ['recorded','duplicate','disabled'].includes(status)) {
          collectionStatus(status,Number(response.headers.get('X-Activity-Count'))||0);
          return;
        }
        if(response.status<500 && response.status!==429) break;
      } catch (_) {}
      if(attempt<2) await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
    }
    if (allowed() && epoch===consentEpoch) {
      collectionStatus('unavailable');
      window.dispatchEvent(new Event('ibn:activity-unavailable'));
    }
  }
  function track(type,service='') {
    if (!allowed()) return;
    activeSession();
    queue.push({id:crypto.randomUUID(),type,page:location.pathname,service:slug(service)});
    if (queue.length>=20) void flush();
    else {clearTimeout(timer);timer=setTimeout(flush,120);}
  }
  // Only coarse, allowlisted attribution; never transmit URLs, searches,
  // query parameters, contact addresses or advertising click identifiers.
  function source() {
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      if (host === location.hostname) return 'internal';
      if (/(^|\.)google\.(com|fr|ne|bj|ng|com\.gh)$/.test(host)) return 'google';
      if (/(^|\.)bing\.com$/.test(host)) return 'bing';
      if (/(^|\.)(facebook\.com|fb\.com)$/.test(host)) return 'facebook';
      if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
      if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return 'whatsapp';
      if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
      return 'other';
    } catch (_) {return document.referrer ? 'other' : 'direct';}
  }
  activeSession();
  if (!session.source) session.source=source();
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
  let lastInteraction=Date.now();
  for (const type of ['pointerdown','keydown','scroll']) document.addEventListener(type,()=>{lastInteraction=Date.now();},{passive:true});
  setInterval(()=>{
    if (allowed() && document.visibilityState==='visible' && Date.now()-lastInteraction<5*60000)
      track('heartbeat');
  },60000);
  window.addEventListener('ibn:analytics-consent',()=>{
    consentEpoch++;
    if (!allowed()) {queue=[];clearTimeout(timer);visitor=null;session=null;collectionStatus('disabled');}
    else if (!visitor) track('page_view');
  });
  }
  window.addEventListener('ibn:analytics-consent', startTracking);
  startTracking();
})();
