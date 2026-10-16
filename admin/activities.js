(() => {
  'use strict';

  const TZ = 'Africa/Porto-Novo';
  const PAGE_SIZE = 50;
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = { period: 'today', from: '', to: '', page: 1, facets: { countries: [], services: [] }, debounce: null, request: 0 };
  let sessionTrigger;
  const ui = {
    status: $('#filter-status'), tableState: $('#table-state'), tableWrap: $('#table-wrap'),
    eventsBody: $('#events-body'), pagination: $('#pagination'), pageSummary: $('#page-summary'),
    prev: $('#prev-page'), next: $('#next-page'), export: $('#export-link'),
    dateRange: $('#date-range'), from: $('#from'), to: $('#to'),
    country: $('#country'), service: $('#service'), device: $('#device'), type: $('#type'),
    visitor: $('#visitor'), session: $('#session'), query: $('#q'),
    dialog: $('#session-dialog'), dialogTitle: $('#dialog-title'),
    dialogSession: $('#dialog-session-id'), dialogContent: $('#dialog-content')
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
    return Number.isFinite(number) ? new Intl.NumberFormat('fr-FR').format(number) : '—';
  }

  function formatDate(value) {
    if (!value) return 'Date inconnue';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(date);
  }

  function setState(kind, heading, message, retry = false) {
    ui.tableWrap.hidden = true;
    ui.pagination.hidden = true;
    ui.tableState.hidden = false;
    ui.tableState.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'state-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind === 'loading' ? '◌' : kind === 'error' ? '!' : kind === 'login' ? '🔐' : '⌕';
    const title = document.createElement('h4');
    title.textContent = heading;
    const text = document.createElement('p');
    text.textContent = message;
    ui.tableState.append(icon, title, text);
    if (kind === 'loading') {
      const skeletons = document.createElement('div');
      skeletons.setAttribute('aria-hidden', 'true');
      skeletons.style.cssText = 'display:grid;gap:8px;max-width:520px;margin:18px auto 0';
      [92, 100, 76].forEach(width => {
        const bar = document.createElement('div');
        bar.className = 'skeleton';
        bar.style.cssText = `height:12px;width:${width}%;border-radius:8px`;
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

  function cell(row, className, value) {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = value == null || value === '' ? '—' : String(value);
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
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }

  function renderEvents(events) {
    ui.eventsBody.replaceChildren();
    events.forEach(event => {
      const row = document.createElement('tr');
      cell(row, 'date-cell', formatDate(event.occurred_at));
      const type = cell(row, '', '');
      const pill = document.createElement('span');
      pill.className = 'type-pill';
      pill.textContent = event.type || 'Activité';
      type.append(pill);
      cell(row, '', event.page || '—');
      cell(row, '', event.service || '—');
      const visitorCell = cell(row, 'identifier', event.visitor_id || 'Anonyme');
      if (!event.visitor_id) visitorCell.firstChild.textContent = 'Anonyme';
      const sessionCell = cell(row, 'identifier', '');
      if (event.session_id) {
        const button = document.createElement('button');
        button.className = 'session-link';
        button.type = 'button';
        button.textContent = event.session_id;
        button.setAttribute('aria-label', `Ouvrir la session ${event.session_id}`);
        button.addEventListener('click', () => openSession(event.session_id));
        sessionCell.append(button);
      } else sessionCell.textContent = '—';
      cell(row, '', event.country || '—');
      cell(row, '', event.device || '—');
      const metadata = cell(row, '', '');
      const browser = document.createElement('span');
      browser.textContent = event.browser || 'Navigateur inconnu';
      metadata.append(browser);
      const os = document.createElement('span');
      os.className = 'subtle';
      os.textContent = event.os || 'OS inconnu';
      metadata.append(os);
      ui.eventsBody.append(row);
    });
  }

  function updateSummary(summary = {}) {
    ['todayVisitors', 'visitors', 'sessions', 'pages', 'services', 'clicks', 'external', 'total'].forEach(key => {
      const target = $(`[data-stat="${key}"]`);
      target.textContent = formatNumber(summary[key]);
    });
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
    const requestId = ++state.request;
    ui.status.textContent = 'Chargement des activités…';
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
        updateSummary({});
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result || result.ok !== true) throw new Error(result?.error || 'Réponse invalide');
      if (requestId !== state.request) return;
      updateSummary(result.summary);
      state.facets = result.facets || state.facets;
      addFacetOptions(ui.country, state.facets.countries, 'Tous les pays', query.get('country'));
      addFacetOptions(ui.service, state.facets.services, 'Tous les services', query.get('service'));
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
      setState('error', 'Impossible de charger les activités', 'Le service est momentanément indisponible. Vos filtres sont conservés.', true);
      ui.status.textContent = 'Erreur de chargement';
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

  async function openSession(sessionId) {
    sessionTrigger=document.activeElement;
    ui.dialogTitle.textContent = 'Parcours d’une session';
    ui.dialogSession.textContent = sessionId;
    ui.dialogContent.replaceChildren();
    textNode(ui.dialogContent, 'p', 'Chargement du parcours…', 'filter-status');
    ui.dialog.showModal();
    const params = makeParams(false);
    try {
      const response = await fetch(`/api/admin/activities/sessions/${encodeURIComponent(sessionId)}?${params.toString()}`, {
        credentials: 'include', headers: { Accept: 'application/json' }
      });
      if (response.status === 401) {
        location.href = '/admin/login';
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result || result.ok !== true || !Array.isArray(result.events)) throw new Error('Réponse invalide');
      ui.dialogContent.replaceChildren();
      if (result.truncated) {
        textNode(ui.dialogContent, 'p', 'Le parcours est tronqué : certaines activités ne sont pas affichées.', 'truncated-note');
      }
      if (result.events.length === 0) {
        textNode(ui.dialogContent, 'p', 'Aucune activité disponible pour cette session dans la période conservée.', 'filter-status');
        return;
      }
      const timeline = document.createElement('ol');
      timeline.className = 'timeline';
      result.events.forEach(event => {
        const item = document.createElement('li');
        textNode(item, 'time', formatDate(event.occurred_at), 'timeline-date');
        const content = document.createElement('div');
        content.className = 'timeline-content';
        textNode(content, 'strong', event.type || 'Activité');
        if (event.page) textNode(content, 'p', `Page : ${event.page}`);
        if (event.service) textNode(content, 'p', `Service : ${event.service}`);
        if (event.country || event.device) textNode(content, 'p', [event.country, event.device].filter(Boolean).join(' · '));
        if (event.browser || event.os) textNode(content, 'p', [event.browser, event.os].filter(Boolean).join(' · '));
        item.append(content);
        timeline.append(item);
      });
      ui.dialogContent.append(timeline);
    } catch (error) {
      ui.dialogContent.replaceChildren();
      textNode(ui.dialogContent, 'p', 'Impossible de charger le détail de cette session. Fermez puis réessayez.', 'filter-status');
    }
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
  $('#close-dialog').addEventListener('click', () => ui.dialog.close());
  ui.dialog.addEventListener('click', event => {
    if (event.target === ui.dialog) ui.dialog.close();
  });
  ui.dialog.addEventListener('close', () => { if(sessionTrigger?.isConnected)sessionTrigger.focus(); });

  updateRange('today');
  load();
})();
