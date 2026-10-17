(() => {
  'use strict';

  const TZ = 'Africa/Porto-Novo';
  const PAGE_SIZE = 50;
  const UNKNOWN = 'Non disponible';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = {
    period: 'today', from: '', to: '', page: 1,
    facets: { countries: [], services: [] }, debounce: null, request: 0,
    detailRequest: 0, detail: null, dialogMode: ''
  };
  let dialogTrigger;
  const ui = {
    status: $('#filter-status'), tableState: $('#table-state'), tableWrap: $('#table-wrap'),
    eventsBody: $('#events-body'), pagination: $('#pagination'), pageSummary: $('#page-summary'),
    prev: $('#prev-page'), next: $('#next-page'), export: $('#export-link'),
    dateRange: $('#date-range'), from: $('#from'), to: $('#to'),
    country: $('#country'), service: $('#service'), device: $('#device'), type: $('#type'),
    visitor: $('#visitor'), session: $('#session'), query: $('#q'),
    dialog: $('#session-dialog'), dialogTitle: $('#dialog-title'),
    dialogSession: $('#dialog-session-id'), dialogContent: $('#dialog-content'),
    closeDialog: $('#close-dialog'), refreshDialog: $('#refresh-dialog'),
    stats: [...document.querySelectorAll('[data-stat]')],
    rankings: {
      countries: { list: $('#countries-ranking'), state: $('#countries-state') },
      devices: { list: $('#devices-ranking'), state: $('#devices-state') },
      services: { list: $('#services-ranking'), state: $('#services-state') }
    }
  };

  function timezoneDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const part = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${part.year}-${part.month}-${part.day}`;
  }

  function shiftDate(dateString, days) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function updateRange(period) {
    state.period = period;
    const today = timezoneDate();
    if (period === 'today') state.from = state.to = today;
    else if (period === 'yesterday') state.from = state.to = shiftDate(today, -1);
    else if (period === '7') { state.from = shiftDate(today, -6); state.to = today; }
    else if (period === '30') { state.from = shiftDate(today, -29); state.to = today; }
    ui.dateRange.hidden = period !== 'custom';
    if (period !== 'custom') {
      ui.from.value = state.from;
      ui.to.value = state.to;
    } else {
      ui.from.value = ui.from.value || state.from || today;
      ui.to.value = ui.to.value || state.to || today;
      state.from = ui.from.value;
      state.to = ui.to.value;
    }
    document.querySelectorAll('.period-btn').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.period === period));
    });
    state.page = 1;
  }

  function makeParams(includePage = true) {
    const params = new URLSearchParams();
    const values = {
      from: state.from, to: state.to, country: ui.country.value, device: ui.device.value,
      type: ui.type.value, service: ui.service.value, visitor: ui.visitor.value.trim(),
      session: ui.session.value.trim(), q: ui.query.value.trim()
    };
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    if (includePage) params.set('page', String(state.page));
    return params;
  }

  function formatNumber(value) {
    const number = Number(value);
    return value == null || value === '' || !Number.isFinite(number) ? UNKNOWN : new Intl.NumberFormat('fr-FR').format(number);
  }

  function present(value) {
    return value == null || String(value).trim() === '' || ['Autre','unknown'].includes(String(value)) ? UNKNOWN : String(value);
  }

  function formatDate(value) {
    if (!value) return UNKNOWN;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return UNKNOWN;
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);
  }

  function countryName(value) {
    if (!value) return UNKNOWN;
    const code = String(value).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return code || UNKNOWN;
    try {
      return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) || code;
    } catch {
      return code;
    }
  }

  function deviceLabel(device) {
    const names = { mobile: 'Mobile', tablet: 'Tablette', desktop: 'Ordinateur', unknown: UNKNOWN };
    const raw = String(device || '').toLowerCase();
    return names[raw] || present(device);
  }

  function setState(kind, heading, message, retry = false) {
    ui.tableWrap.hidden = true;
    ui.pagination.hidden = true;
    ui.tableState.hidden = false;
    ui.eventsBody.replaceChildren();
    ui.tableState.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'state-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind === 'loading' ? '…' : kind === 'error' ? '!' : kind === 'login' ? 'ID' : '—';
    const title = document.createElement('h4');
    title.textContent = heading;
    const text = document.createElement('p');
    text.textContent = message;
    ui.tableState.append(icon, title, text);
    if (kind === 'loading') {
      const skeletons = document.createElement('div');
      skeletons.setAttribute('aria-hidden', 'true');
      skeletons.className = 'loading-skeletons';
      [92, 100, 76].forEach(width => {
        const bar = document.createElement('div');
        bar.className = 'skeleton';
        bar.style.width = `${width}%`;
        skeletons.append(bar);
      });
      ui.tableState.append(skeletons);
    }
    if (retry) {
      const button = document.createElement('button');
      button.className = 'state-action';
      button.type = 'button';
      button.textContent = 'Réessayer';
      button.addEventListener('click', load);
      ui.tableState.append(button);
    }
  }

  function clearInsights(kind = 'loading') {
    ui.stats.forEach(target => { target.textContent = '—'; });
    Object.values(ui.rankings).forEach(({ list, state: status }) => {
      list.replaceChildren();
      list.hidden = true;
      status.hidden = false;
      status.textContent = kind === 'error' ? 'Données indisponibles. Réessayez pour actualiser.' :
        kind === 'loading' ? 'Chargement des répartitions…' : 'Aucune donnée disponible pour cette période.';
    });
  }

  function cell(row, className, value) {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = present(value);
    row.append(td);
    return td;
  }

  function addFacetOptions(select, values, label, selected) {
    const previous = selected || select.value;
    select.replaceChildren(new Option(label, ''));
    (Array.isArray(values) ? values : []).forEach(item => {
      const value = typeof item === 'string' ? item : item?.value ?? item?.id ?? item?.code ?? '';
      const text = typeof item === 'string' ? item : item?.label ?? item?.name ?? value;
      if (value !== '') select.add(new Option(String(text), String(value)));
    });
    if (previous && ![...select.options].some(option => option.value === previous)) {
      select.add(new Option(previous, previous));
    }
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function renderEvents(events) {
    ui.eventsBody.replaceChildren();
    events.forEach(event => {
      const row = document.createElement('tr');
      row.className = 'event-row';
      row.tabIndex = 0;
      row.setAttribute('aria-label', `Ouvrir le détail du visiteur ${present(event.visitor_id)} : ${present(event.type)}`);
      row.addEventListener('click', clickEvent => {
        if (clickEvent.target.closest('a, button, input, select')) return;
        if (event.visitor_id) openVisitor(event.visitor_id);
      });
      row.addEventListener('keydown', keyEvent => {
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          if (keyEvent.target.closest('a, button, input, select')) return;
          keyEvent.preventDefault();
          if (event.visitor_id) openVisitor(event.visitor_id);
        }
      });
      cell(row, 'date-cell', formatDate(event.occurred_at));
      cell(row, '', countryName(event.country));
      const deviceCell = cell(row, '', '');
      const model = event.model;
      const device = model ? String(model) : deviceLabel(event.device);
      deviceCell.textContent = present(device);
      if (event.brand && model) {
        const detail = document.createElement('span');
        detail.className = 'subtle';
        detail.textContent = String(event.brand);
        deviceCell.append(detail);
      }
      const browserCell = cell(row, '', '');
      browserCell.textContent = present(event.browser);
      const browserVersion = event.browser_version;
      if (browserVersion) {
        const version = document.createElement('span');
        version.className = 'subtle';
        version.textContent = String(browserVersion);
        browserCell.append(version);
      }
      cell(row, '', event.os && event.os!=='Autre' ? [event.os,event.os_version].filter(Boolean).join(' ') : UNKNOWN);
      const activity = cell(row, '', '');
      activity.replaceChildren();
      const pill = document.createElement('span');
      pill.className = 'type-pill';
      pill.textContent = present(event.type);
      activity.append(pill);
      if (event.service || event.service_slug || event.product_slug || event.category) {
        const service = document.createElement('span');
        service.className = 'subtle';
        service.textContent = [
          event.service || event.service_slug ? `Service : ${event.service || event.service_slug}` : '',
          event.product_slug ? `Produit : ${event.product_slug}` : '',
          event.category ? `Catégorie : ${event.category}` : ''
        ].filter(Boolean).join(' · ');
        activity.append(service);
      }
      if (event.page) {
        const page = document.createElement('span');
        page.className = 'subtle';
        page.textContent = String(event.page);
        activity.append(page);
      }
      const visitorCell = cell(row, 'identifier', '');
      visitorCell.replaceChildren();
      if (event.visitor_id) {
        const link = document.createElement('button');
        link.className = 'visitor-link';
        link.type = 'button';
        link.textContent = 'Voir fiche · '+String(event.visitor_id);
        link.setAttribute('aria-label', `Ouvrir l’historique du navigateur ${event.visitor_id}`);
        link.addEventListener('click', () => openVisitor(event.visitor_id));
        visitorCell.append(link);
      } else visitorCell.textContent = UNKNOWN;
      const sessionCell = cell(row, 'identifier', '');
      sessionCell.replaceChildren();
      if (event.session_id) {
        const button = document.createElement('button');
        button.className = 'session-link';
        button.type = 'button';
        button.textContent = String(event.session_id);
        button.setAttribute('aria-label', `Ouvrir la session ${event.session_id}`);
        button.addEventListener('click', () => openSession(event.session_id));
        sessionCell.append(button);
      } else sessionCell.textContent = UNKNOWN;
      ui.eventsBody.append(row);
    });
  }

  function updateSummary(summary = {}) {
    ['todayVisitors', 'activeVisitors', 'todayVisits', 'weekVisits', 'monthVisits',
      'visitors', 'sessions', 'pages', 'services', 'clicks', 'external', 'total'].forEach(key => {
      const target = $(`[data-stat="${key}"]`);
      if (target) target.textContent = formatNumber(summary[key]);
    });
  }

  function renderRanking(key, items, labelFor) {
    const target = ui.rankings[key];
    target.list.replaceChildren();
    const rows = Array.isArray(items) ? items.filter(item => item && Number.isFinite(Number(item.count))) : [];
    if (!rows.length) {
      target.list.hidden = true;
      target.state.hidden = false;
      target.state.textContent = 'Aucune donnée disponible pour cette période.';
      return;
    }
    const max = Math.max(...rows.map(item => Number(item.count)), 1);
    rows.forEach(item => {
      const li = document.createElement('li');
      li.className = 'rank-row';
      const label = document.createElement('span');
      label.className = 'rank-label';
      label.textContent = labelFor(item.name);
      const track = document.createElement('span');
      track.className = 'rank-track';
      track.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span');
      fill.className = 'rank-fill';
      fill.style.width = `${Math.max(0, Number(item.count) / max * 100)}%`;
      track.append(fill);
      const count = document.createElement('span');
      count.className = 'rank-count';
      count.textContent = formatNumber(item.count);
      li.append(label, track, count);
      target.list.append(li);
    });
    target.state.hidden = true;
    target.list.hidden = false;
  }

  function updatePager(result) {
    const page = Number(result.page) || state.page;
    const total = Number(result.total) || 0;
    const pageSize = Number(result.pageSize) || PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    state.page = page;
    ui.pageSummary.textContent = total
      ? `Page ${page} sur ${pages} · ${formatNumber(total)} activité(s)`
      : 'Aucune activité';
    ui.prev.disabled = page <= 1;
    ui.next.disabled = page >= pages;
    ui.pagination.hidden = false;
  }

  async function load() {
    void loadDiagnostic();
    const requestId = ++state.request;
    ui.status.textContent = 'Chargement des activités…';
    clearInsights('loading');
    setState('loading', 'Chargement des activités', 'Nous récupérons les données correspondant à vos filtres.');
    const query = makeParams();
    ui.export.href = `/api/admin/activities/export.csv?${makeParams(false).toString()}`;
    try {
      const response = await fetch(`/api/admin/activities?${query.toString()}`, {
        credentials: 'include', headers: { Accept: 'application/json' }
      });
      if (requestId !== state.request) return;
      if (response.status === 401) {
        setState('login', 'Connexion administrateur requise', 'Votre session est expirée ou vous n’êtes pas connecté. Reconnectez-vous pour consulter ces données.');
        const login = document.createElement('a');
        login.className = 'state-action';
        login.href = '/admin/login';
        login.textContent = 'Se connecter';
        login.style.display = 'inline-block';
        login.style.textDecoration = 'none';
        ui.tableState.append(login);
        ui.status.textContent = 'Authentification requise';
        clearInsights('error');
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result || result.ok !== true) throw new Error(result?.error || 'Réponse invalide');
      if (requestId !== state.request) return;
      updateSummary(result.summary || {});
      state.facets = result.facets || state.facets;
      addFacetOptions(ui.country, state.facets.countries, 'Tous les pays', query.get('country'));
      addFacetOptions(ui.service, state.facets.services, 'Tous les services', query.get('service'));
      const breakdowns = result.breakdowns || {};
      renderRanking('countries', breakdowns.countries, countryName);
      renderRanking('devices', breakdowns.devices, deviceLabel);
      renderRanking('services', breakdowns.services, present);
      ui.status.textContent = `Période du ${state.from} au ${state.to} · conservation ${formatNumber(result.retentionDays)} jours`;
      if (!Array.isArray(result.events) || result.events.length === 0) {
        setState('empty', 'Aucune activité sur cette période', 'Modifiez la période ou retirez un ou plusieurs filtres pour élargir la recherche.');
        updatePager(result);
        return;
      }
      renderEvents(result.events);
      ui.tableState.hidden = true;
      ui.tableWrap.hidden = false;
      updatePager(result);
    } catch (error) {
      if (requestId !== state.request) return;
      clearInsights('error');
      setState('error', 'Impossible de charger les activités', 'Les données ne sont pas disponibles actuellement. Vos filtres sont conservés ; réessayez.', true);
      ui.status.textContent = 'Données indisponibles';
    }
  }

  async function loadDiagnostic() {
    const target=$('#collection-diagnostic');
    try {
      const response=await fetch('/api/admin/activities/diagnostic',{credentials:'same-origin',cache:'no-store'});
      if (!response.ok) throw new Error('Diagnostic indisponible');
      const data=await response.json();
      if (!data.ok) throw new Error('Diagnostic invalide');
      target.textContent=`PostgreSQL accessible · ${formatNumber(data.events)} activité(s) conservée(s), tous filtres confondus · Dernier enregistrement : ${formatDate(data.last_recorded_at)} · ${formatNumber(data.events_without_country)} sans pays. Pays : GeoLite2 local, base ${data.countryDatabase}. Les visites sans consentement ne sont pas comptées.`;
    } catch {
      target.textContent='Impossible de vérifier la collecte PostgreSQL. Vérifiez votre session Admin et réessayez ; aucun enregistrement nouveau n’est confirmé ici.';
    }
  }

  function scheduleLoad() {
    state.page = 1;
    window.clearTimeout(state.debounce);
    state.debounce = window.setTimeout(load, 220);
  }

  function textNode(parent, tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    parent.append(node);
    return node;
  }

  function showDialog(title, identifier, mode) {
    state.dialogMode = mode;
    ui.dialogTitle.textContent = title;
    ui.dialogSession.textContent = identifier;
    ui.dialogContent.replaceChildren();
    if (!ui.dialog.open) {
      dialogTrigger = document.activeElement;
      ui.dialog.showModal();
      ui.closeDialog.focus();
    }
  }

  function showDialogStatus(message, retryLabel, retryFn, error = false) {
    ui.dialogContent.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'dialog-status';
    const text = textNode(wrap, 'p', message);
    if (error) text.setAttribute('role', 'alert');
    if (retryFn) {
      const button = textNode(wrap, 'button', retryLabel || 'Réessayer', 'state-action');
      button.type = 'button';
      button.addEventListener('click', retryFn);
    }
    ui.dialogContent.append(wrap);
  }

  async function openSession(sessionId) {
    const requestId = ++state.detailRequest;
    showDialog('Parcours d’une session', String(sessionId), 'session');
    showDialogStatus('Chargement du parcours…');
    const params = makeParams(false);
    try {
      const response = await fetch(`/api/admin/activities/sessions/${encodeURIComponent(sessionId)}?${params.toString()}`, {
        credentials: 'include', headers: { Accept: 'application/json' }
      });
      if (requestId !== state.detailRequest || !ui.dialog.open) return;
      if (response.status === 401) {
        location.href = '/admin/login';
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result || result.ok !== true || !Array.isArray(result.events)) throw new Error('Réponse invalide');
      renderSession(result);
    } catch {
      if (requestId !== state.detailRequest || !ui.dialog.open) return;
      showDialogStatus('Données de session indisponibles. Fermez puis réessayez.', 'Réessayer', () => openSession(sessionId), true);
    }
  }

  function renderSession(result) {
    ui.dialogContent.replaceChildren();
    if (result.truncated) textNode(ui.dialogContent, 'p', 'Le parcours est tronqué : certaines activités retenues peuvent ne pas être affichées.', 'truncated-note');
    if (!result.events.length) {
      textNode(ui.dialogContent, 'p', 'Aucune activité disponible pour cette session dans la période conservée.', 'rank-empty');
      return;
    }
    const timeline = document.createElement('ol');
    timeline.className = 'timeline';
    result.events.forEach(event => {
      const item = document.createElement('li');
      textNode(item, 'time', formatDate(event.occurred_at), 'timeline-date');
      const content = document.createElement('div');
      content.className = 'timeline-content';
      textNode(content, 'strong', present(event.type));
      if (event.page) textNode(content, 'p', `Page : ${event.page}`);
      if (event.service || event.service_slug) textNode(content, 'p', `Service : ${event.service || event.service_slug}`);
      if (event.product_slug) textNode(content, 'p', `Produit : ${event.product_slug}`);
      if (event.category) textNode(content, 'p', `Catégorie : ${event.category}`);
      textNode(content, 'p', `Pays : ${countryName(event.country)} · Appareil : ${event.model || deviceLabel(event.device)}`);
      textNode(content, 'p', `Navigateur : ${present(event.browser)} · Système : ${present(event.os)}`);
      item.append(content);
      timeline.append(item);
    });
    ui.dialogContent.append(timeline);
  }

  async function openVisitor(visitorId) {
    const id = String(visitorId);
    const requestId = ++state.detailRequest;
    showDialog('Historique du navigateur', id, 'visitor');
    showDialogStatus('Chargement de l’historique…');
    try {
      const response = await fetch(`/api/admin/activities/visitors/${encodeURIComponent(id)}`, {
        credentials: 'include', headers: { Accept: 'application/json' }
      });
      if (requestId !== state.detailRequest || !ui.dialog.open) return;
      if (response.status === 401) {
        location.href = '/admin/login';
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result || result.ok !== true || !result.visitor || !Array.isArray(result.sessions) || !Array.isArray(result.events)) {
        throw new Error('Réponse invalide');
      }
      renderVisitor(result);
    } catch {
      if (requestId !== state.detailRequest || !ui.dialog.open) return;
      showDialogStatus('Historique indisponible. Aucune donnée précédente ne peut être affichée comme actuelle.', 'Réessayer', () => openVisitor(id), true);
    }
  }

  function appendFact(container, label, value) {
    const fact = document.createElement('div');
    fact.className = 'detail-fact';
    textNode(fact, 'span', label);
    textNode(fact, 'strong', value);
    container.append(fact);
  }

  function appendMeta(container, label, value) {
    const row = document.createElement('div');
    textNode(row, 'dt', label);
    textNode(row, 'dd', present(value));
    container.append(row);
  }

  function durationLabel(seconds) {
    if (seconds == null || seconds === '' || !Number.isFinite(Number(seconds))) return UNKNOWN;
    const total = Math.max(0, Math.round(Number(seconds)));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return mins ? `${mins} min ${secs} s` : `${secs} s`;
  }

  function latestSession(sessions) {
    return sessions.reduce((latest, session) => {
      if (!latest) return session;
      return new Date(session.last_at || 0).getTime() > new Date(latest.last_at || 0).getTime() ? session : latest;
    }, null);
  }

  function renderVisitor(result) {
    const visitor = result.visitor;
    const sessions = result.sessions;
    const events = result.events;
    const latest = latestSession(sessions);
    ui.dialogContent.replaceChildren();

    const notice = document.createElement('p');
    notice.className = 'detail-intro';
    const strong = document.createElement('strong');
    strong.textContent = 'Un identifiant de navigateur pseudonymisé, pas une personne.';
    notice.append(strong, document.createTextNode(' Historique retenu complet, sans filtres de période ni de recherche. Les caractéristiques de l’appareil peuvent changer d’une session à l’autre.'));
    ui.dialogContent.append(notice);
    if (result.truncated) textNode(ui.dialogContent, 'p', 'L’historique affiché est tronqué : certains événements conservés ne sont pas inclus.', 'truncated-note');

    const facts = document.createElement('div');
    facts.className = 'detail-facts';
    appendFact(facts, 'Visites', formatNumber(visitor.visits));
    appendFact(facts, 'Sessions retenues', formatNumber(sessions.length));
    appendFact(facts, 'Durée cumulée estimée', durationLabel(visitor.approx_duration_seconds));
    appendFact(facts, 'Première activité', formatDate(visitor.first_at));
    appendFact(facts, 'Dernière activité', formatDate(visitor.last_at));
    ui.dialogContent.append(facts);

    const technical = document.createElement('section');
    technical.className = 'detail-section';
    textNode(technical, 'h3', 'Dernier appareil observé');
    const metadata = document.createElement('dl');
    metadata.className = 'detail-meta';
    appendMeta(metadata, 'Appareil', latest ? `${latest.model || deviceLabel(latest.device)}${latest.brand ? ` · ${latest.brand}` : ''}` : UNKNOWN);
    appendMeta(metadata, 'Marque déclarée', latest?.brand);
    appendMeta(metadata, 'Modèle déclaré', latest?.model);
    appendMeta(metadata, 'Système', latest ? [latest.os, latest.os_version].filter(Boolean).join(' ') || UNKNOWN : UNKNOWN);
    appendMeta(metadata, 'Navigateur', latest ? [latest.browser, latest.browser_version].filter(Boolean).join(' ') || UNKNOWN : UNKNOWN);
    appendMeta(metadata, 'Langue', latest ? present(latest.language) : UNKNOWN);
    appendMeta(metadata, 'Pays', latest ? countryName(latest.country) : UNKNOWN);
    appendMeta(metadata, 'Source du pays', latest?.country_source==='geolite2'?'GeoLite2 / MaxMind — calcul local':
      latest?.country_source==='trusted_header'?'En-tête du proxy configuré':UNKNOWN);
    appendMeta(metadata, 'Dernière observation technique', formatDate(latest?.technical_observed_at));
    appendMeta(metadata, 'Région / ville', latest ? [latest.region, latest.city].filter(Boolean).join(' · ') || UNKNOWN : UNKNOWN);
    const sources = {direct:'Accès direct ou source non transmise',internal:'Navigation interne',
      google:'Google',bing:'Bing',facebook:'Facebook',instagram:'Instagram',whatsapp:'WhatsApp',
      tiktok:'TikTok',other:'Autre site externe'};
    appendMeta(metadata, 'Source de visite', sources[latest?.source]);
    appendMeta(metadata, 'Durée approximative · dernière session', latest ? durationLabel(latest.approx_duration_seconds) : UNKNOWN);
    technical.append(metadata);
    textNode(technical, 'p', 'La durée est une estimation calculée à partir des événements et ne mesure pas le temps réel passé à l’écran. Les métadonnées peuvent être complétées par une nouvelle requête de cette session : elles ne reconstituent pas les anciennes visites. Le réseau et l’appareil ne garantissent pas une localisation précise.', 'table-caption-note');
    ui.dialogContent.append(technical);

    const sessionSection = document.createElement('section');
    sessionSection.className = 'detail-section';
    textNode(sessionSection, 'h3', 'Sessions');
    if (!sessions.length) textNode(sessionSection, 'p', 'Aucune session retenue.', 'rank-empty');
    sessions.forEach(session => {
      const block = document.createElement('div');
      block.className = 'detail-session';
      textNode(block, 'strong', `Session ${present(session.session_id)}`);
      const detail = [
        `Début : ${formatDate(session.first_at)}`,
        `Fin : ${formatDate(session.last_at)}`,
        `Pays : ${countryName(session.country)}`,
        `Appareil : ${session.model || deviceLabel(session.device)}${session.brand ? ` · ${session.brand}` : ''}`,
        `Système : ${[session.os, session.os_version].filter(Boolean).join(' ') || UNKNOWN}`,
        `Navigateur : ${[session.browser, session.browser_version].filter(Boolean).join(' ') || UNKNOWN}`,
        `Langue : ${present(session.language)}`,
        `Région / ville : ${[session.region, session.city].filter(Boolean).join(' · ') || UNKNOWN}`,
        `Source : ${present(session.source)}`,
        `Durée approximative : ${durationLabel(session.approx_duration_seconds)}`
      ];
      textNode(block, 'p', detail.join(' · '));
      sessionSection.append(block);
    });
    ui.dialogContent.append(sessionSection);

    const activitySection = document.createElement('section');
    activitySection.className = 'detail-section';
    textNode(activitySection, 'h3', 'Activités, services et produits');
    if (!events.length) textNode(activitySection, 'p', 'Aucune activité retenue.', 'rank-empty');
    const timeline = document.createElement('ol');
    timeline.className = 'timeline';
    events.forEach(event => {
      const item = document.createElement('li');
      textNode(item, 'time', formatDate(event.occurred_at), 'timeline-date');
      const content = document.createElement('div');
      content.className = 'timeline-content';
      textNode(content, 'strong', present(event.type));
      if (event.service || event.service_slug) textNode(content, 'p', `Service : ${event.service || event.service_slug}`);
      if (event.product_slug) textNode(content, 'p', `Produit : ${event.product_slug}`);
      if (event.category) textNode(content, 'p', `Catégorie : ${event.category}`);
      if (event.page) textNode(content, 'p', `Page : ${event.page}`);
      textNode(content, 'p', `Pays : ${countryName(event.country)} · Appareil : ${event.model || deviceLabel(event.device)}`);
      if (event.browser || event.os) textNode(content, 'p', `Navigateur : ${present(event.browser)} · Système : ${present(event.os)}`);
      item.append(content);
      timeline.append(item);
    });
    activitySection.append(timeline);
    ui.dialogContent.append(activitySection);
  }

  document.querySelectorAll('.period-btn').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.period === 'custom' && state.period !== 'custom') {
      ui.from.value = state.from;
      ui.to.value = state.to;
    }
    updateRange(button.dataset.period);
    if (state.period === 'custom') { state.from = ui.from.value; state.to = ui.to.value; }
    load();
  }));
  [ui.country, ui.device, ui.type, ui.service].forEach(control => control.addEventListener('change', scheduleLoad));
  [ui.visitor, ui.session, ui.query].forEach(control => control.addEventListener('input', scheduleLoad));
  [ui.from, ui.to].forEach(control => control.addEventListener('change', () => {
    if (ui.from.value && ui.to.value && ui.from.value <= ui.to.value) {
      state.from = ui.from.value;
      state.to = ui.to.value;
      state.period = 'custom';
      document.querySelectorAll('.period-btn').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.period === 'custom')));
      load();
    } else {
      ui.status.textContent = 'La date de début doit précéder ou égaler la date de fin.';
    }
  }));
  $('#reset-filters').addEventListener('click', () => {
    ui.country.value = '';
    ui.device.value = '';
    ui.type.value = '';
    ui.service.value = '';
    ui.visitor.value = '';
    ui.session.value = '';
    ui.query.value = '';
    updateRange('today');
    load();
  });
  ui.prev.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; load(); } });
  ui.next.addEventListener('click', () => { state.page += 1; load(); });
  ui.refreshDialog.addEventListener('click', () => {
    if (state.dialogMode === 'visitor') openVisitor(ui.dialogSession.textContent);
    else if (state.dialogMode === 'session') openSession(ui.dialogSession.textContent);
  });
  ui.closeDialog.addEventListener('click', () => ui.dialog.close());
  ui.dialog.addEventListener('click', event => {
    if (event.target === ui.dialog) ui.dialog.close();
  });
  ui.dialog.addEventListener('close', () => {
    // The close event can arrive after another row has already opened a new
    // dialog. Never invalidate that request or steal focus from its trigger.
    if (ui.dialog.open) return;
    state.detailRequest += 1;
    state.dialogMode = '';
    if (document.activeElement===document.body && dialogTrigger?.isConnected) dialogTrigger.focus();
  });

  $('#refresh-activities').addEventListener('click',()=>load());
  updateRange('today');
  const initial=new URLSearchParams(location.search);
  for(const key of ['visitor','session']) {
    const value=initial.get(key);
    if(value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) ui[key].value=value;
  }
  const from=initial.get('from'),to=initial.get('to');
  if(/^\d{4}-\d{2}-\d{2}$/.test(from||'') && /^\d{4}-\d{2}-\d{2}$/.test(to||'') && from<=to) {
    ui.from.value=state.from=from;ui.to.value=state.to=to;state.period='custom';
    document.querySelectorAll('.period-btn').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period==='custom')));
  }
  setInterval(()=>{
    if(document.visibilityState==='visible' && !ui.dialog.open &&
      !document.activeElement?.matches('input,select')) {
      if(state.period!=='custom') updateRange(state.period);
      load();
    }
  },30000);
  load();
})();
