(() => {
  'use strict';
  const API = '/api/admin/wifi-business';
  const TZ = 'Africa/Niamey';
  const $ = (selector, root = document) => root.querySelector(selector);
  const state = {
    range: '30d', from: '', to: '', dashboard: null, zones: [], plans: [],
    salesPage: 1, salesTotal: 0, salesPageSize: 25, auditPage: 1,
    auditTotal: 0, auditPageSize: 25, request: 0, activeTab: 'overview'
  };
  const ui = {
    dateRange: $('#date-range'), from: $('#filter-from'), to: $('#filter-to'),
    periodStatus: $('#period-status'), dialog: $('#work-dialog'),
    dialogTitle: $('#dialog-title'), dialogDescription: $('#dialog-description'),
    dialogContent: $('#dialog-content')
  };
  const nf = new Intl.NumberFormat('fr-FR');
  const money = value => value == null || !Number.isFinite(Number(value)) ? 'Non défini' : `${nf.format(Number(value))} FCFA`;
  const number = value => value == null || !Number.isFinite(Number(value)) ? 'Non défini' : nf.format(Number(value));
  const pct = value => value == null || !Number.isFinite(Number(value)) ? 'Non défini' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Number(value))} %`;
  const safe = value => value == null || value === '' ? 'Non défini' : String(value);
  const statusLabels = { active: 'Actif · déclaré', inactive: 'Inactif · déclaré', unconfirmed: 'À confirmer', archived: 'Archivé' };
  const $el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  function dateInNiger(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function shiftDate(value, amount) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + amount));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  function setRange(range) {
    state.range = range;
    const today = dateInNiger();
    if (range === 'today') state.from = state.to = today;
    else if (range === '7d') { state.from = shiftDate(today, -6); state.to = today; }
    else if (range === '30d') { state.from = shiftDate(today, -29); state.to = today; }
    else if (range === 'month') { state.from = `${today.slice(0, 7)}-01`; state.to = today; }
    else if (range === 'previous-month') {
      state.to = shiftDate(`${today.slice(0, 7)}-01`, -1);
      state.from = `${state.to.slice(0, 7)}-01`;
    }
    ui.dateRange.hidden = range !== 'custom';
    if (range === 'custom') {
      ui.from.value = state.from || today;
      ui.to.value = state.to || today;
      state.from = ui.from.value;
      state.to = ui.to.value;
    } else {
      ui.from.value = state.from;
      ui.to.value = state.to;
    }
    document.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.range === range)));
    state.salesPage = 1;
  }
  function periodParams(withRange = true) {
    const params = new URLSearchParams();
    if (withRange) params.set('range', state.range);
    if (state.from) params.set('from', state.from);
    if (state.to) params.set('to', state.to);
    return params;
  }
  function loginRequired() {
    const stateBox = $el('div', 'state load-error');
    stateBox.setAttribute('role', 'alert');
    stateBox.append($el('h4', '', 'Connexion administrateur requise'));
    stateBox.append($el('p', '', 'Votre session privée a expiré ou n’est plus active. Reconnectez-vous pour accéder au registre Wi-Fi Business.'));
    const link = $el('a', 'btn btn-primary', 'Se reconnecter');
    link.href = '/admin/login';
    link.style.marginTop = '13px';
    stateBox.append(link);
    return stateBox;
  }
  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    if (response.status === 401) {
      showLogin();
      const error = new Error('Connexion administrateur requise.');
      error.status = 401;
      throw error;
    }
    let result = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try { result = await response.json(); } catch (_) { result = null; }
    }
    if (response.status === 503) {
      const error = new Error(result?.error || 'Service temporairement indisponible (503). Les données n’ont pas été modifiées.');
      error.status = 503;
      throw error;
    }
    if (!response.ok || result?.ok === false) {
      const error = new Error(result?.error || result?.message || (response.status >= 400 && response.status < 500
        ? `La demande a été refusée (${response.status}). Vérifiez les champs saisis.`
        : `Service indisponible (${response.status}). Réessayez.`));
      error.status = response.status;
      throw error;
    }
    if (!result || result.ok !== true) throw new Error('Réponse du service invalide. Aucune valeur n’a été remplacée.');
    return result;
  }
  function showLogin() {
    state.sessionExpired = true;
    state.dashboard = null; state.zones = []; state.plans = [];
    history.lock();
    closeDialog();
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.hidden = panel.id !== `panel-${state.activeTab}`;
      panel.replaceChildren(loginRequired());
    });
    document.querySelectorAll('.period-btn, .tab, #refresh-all, #open-plan-prices').forEach(button => { button.disabled = true; });
    document.querySelectorAll('.metric-value').forEach(node => { node.textContent = '—'; });
    document.querySelectorAll('.metric-detail').forEach(node => { node.textContent = 'Session expirée'; });
    $('#sales-chart').replaceChildren($el('div', 'chart-empty', 'Connexion administrateur requise.'));
    $('#zone-ranking').replaceChildren();
    $('#ranking-state').replaceChildren(loginRequired());
    $('#ranking-state').hidden = false;
    ui.periodStatus.textContent = 'Authentification requise.';
  }
  function stateView(target, heading, message, kind = 'empty', retry) {
    target.replaceChildren();
    target.className = `state${kind === 'error' ? ' load-error' : ''}`;
    if (heading) target.append($el('h4', '', heading));
    if (message) target.append($el('p', '', message));
    if (retry) {
      const button = $el('button', 'btn btn-primary', 'Réessayer');
      button.type = 'button';
      button.addEventListener('click', retry);
      target.append(button);
    }
    target.hidden = false;
  }
  function showRequestError(target, error, retry) {
    if (error.status === 401) {
      target.replaceChildren(loginRequired());
      target.hidden = false;
      return;
    }
    const msg = error.status === 503
      ? `${error.message} Réessayez dans quelques instants.`
      : error.message || 'Impossible de joindre le service. Vos filtres sont conservés.';
    stateView(target, error.status === 503 ? 'Service temporairement indisponible' : 'Données indisponibles', msg, 'error', retry);
  }
  function formatDate(value, withTime = true) {
    if (!value) return 'Non défini';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return safe(value);
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
    }).format(date);
  }
  function setText(selector, value) { const node = $(selector); if (node) node.textContent = value; }
  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      button.dataset.originalLabel = button.textContent;
      button.textContent = label || 'Enregistrement…';
    } else if (button.dataset.originalLabel) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
    button.disabled = busy;
  }
  function cell(row, text, className) {
    const td = $el('td', className || '', text);
    row.append(td);
    return td;
  }

  function setGauge(container, value, source, label, actualValue = value, targetFcfa = null, revenueFcfa = null) {
    const numeric = value == null || !Number.isFinite(Number(value)) ? null : Math.max(0, Math.min(100, Number(value)));
    const actual = actualValue == null || !Number.isFinite(Number(actualValue)) ? null : Number(actualValue);
    const tier = actual === null ? 'yellow' : actual >= 70 ? 'green' : actual >= 40 ? 'yellow' : 'red';
    const color = tier === 'green' ? 'var(--green)' : tier === 'yellow' ? 'var(--yellow)' : 'var(--red)';
    const wrap = $el('div', 'zone-performance');
    const gauge = $el('div', 'gauge');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', numeric === null ? 'Performance non définie' : `Performance ${pct(value)}`);
    const track = document.createElementNS(svg.namespaceURI, 'circle');
    track.setAttribute('class', 'gauge-track'); track.setAttribute('cx', '32'); track.setAttribute('cy', '32'); track.setAttribute('r', '26');
    const progress = document.createElementNS(svg.namespaceURI, 'circle');
    progress.setAttribute('class', 'gauge-progress'); progress.setAttribute('cx', '32'); progress.setAttribute('cy', '32'); progress.setAttribute('r', '26');
    progress.style.setProperty('--gauge-color', color);
    const circumference = 2 * Math.PI * 26;
    progress.style.setProperty('--offset', String(circumference * (1 - (numeric || 0) / 100)));
    progress.style.strokeDasharray = String(circumference);
    svg.append(track, progress);
    const val = $el('span', `gauge-value tier-${tier}`, numeric === null ? '—' : `${Math.round(numeric)}%`);
    gauge.append(svg, val);
    const copy = $el('div', 'zone-performance-copy');
    copy.append($el('strong', `tier-${tier}`, label || (source === 'manual_demo' ? 'Démonstration manuelle' : numeric === null ? 'Objectif non défini' : 'Ventes / objectif')));
    copy.append($el('span', '', source === 'manual_demo' ? 'Indication de démonstration · hors ventes' : actual === null ? 'Aucun calcul sans objectif' : 'Performance commerciale déclarée'));
    if (targetFcfa !== null && targetFcfa !== undefined) {
      copy.append($el('span', 'zone-goal', `Objectif période : ${money(targetFcfa)}`));
    }
    if (actual !== null && actual > 100) {
      const overage = targetFcfa != null && revenueFcfa != null
        ? ` · +${money(Math.max(0, Number(revenueFcfa) - Number(targetFcfa)))} au-dessus`
        : ' · objectif dépassé';
      copy.append($el('span', 'performance-overage', `${pct(actual)}${overage}`));
    }
    wrap.append(gauge, copy);
    container.append(wrap);
  }

  function makeSvg(tag, attrs = {}) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }
  function renderSeries(series) {
    const root = $('#sales-chart');
    root.replaceChildren();
    const values = Array.isArray(series) ? series : [];
    if (!values.length) {
      root.append($el('div', 'chart-empty', 'Aucune donnée de vente pour cette période.'));
      return;
    }
    const width = Math.max(520, root.clientWidth || 650), height = 250;
    const margin = { top: 14, right: 12, bottom: 37, left: 67 };
    const chartW = width - margin.left - margin.right, chartH = height - margin.top - margin.bottom;
    const max = Math.max(1, ...values.map(item => Number(item.revenueFcfa) || 0));
    const svg = makeSvg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'sales-chart-title sales-chart-desc' });
    const title = makeSvg('title', { id: 'sales-chart-title' }); title.textContent = 'Recettes Wi-Fi Business';
    const desc = makeSvg('desc', { id: 'sales-chart-desc' }); desc.textContent = 'Graphique des recettes journalières réelles renvoyées par le service.';
    svg.append(title, desc);
    for (let i = 0; i < 4; i += 1) {
      const y = margin.top + chartH * i / 3;
      svg.append(makeSvg('line', { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: 'chart-gridline' }));
      const label = makeSvg('text', { x: margin.left - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-label' });
      label.textContent = nf.format(Math.round(max * (1 - i / 3)));
      svg.append(label);
    }
    const step = chartW / values.length;
    const barW = Math.max(3, Math.min(25, step * .55));
    const points = [];
    values.forEach((item, index) => {
      const raw = Number(item.revenueFcfa) || 0;
      const barH = raw > 0 ? Math.max(1, chartH * raw / max) : 0;
      const x = margin.left + index * step + (step - barW) / 2;
      const y = margin.top + chartH - barH;
      if (barH) {
        const bar = makeSvg('rect', { x, y, width: barW, height: barH, rx: Math.min(4, barW / 2), class: 'chart-bar' });
        const tooltip = makeSvg('title'); tooltip.textContent = `${item.date || 'Date inconnue'} · ${money(raw)} · ${number(item.ticketsSold)} tickets`;
        bar.append(tooltip); svg.append(bar);
      }
      const cx = margin.left + index * step + step / 2;
      points.push(`${cx},${margin.top + chartH - chartH * raw / max}`);
      const labelStep = values.length > 18 ? Math.ceil(values.length / 8) : values.length > 10 ? 2 : 1;
      if (index % labelStep === 0 || index === values.length - 1) {
        const tick = makeSvg('text', { x: cx, y: height - 12, 'text-anchor': 'middle', class: 'chart-label' });
        tick.textContent = state.dashboard?.seriesGranularity === 'month'
          ? String(item.date || '').slice(0, 7) : String(item.date || '').slice(5);
        svg.append(tick);
      }
    });
    if (values.length > 1) svg.append(makeSvg('polyline', { points: points.join(' '), class: 'chart-line' }));
    root.append(svg);
  }
  function renderComparisons(comparisons) {
    const root = $('#comparison-chart'); root.replaceChildren();
    const rows = Array.isArray(comparisons) ? comparisons.filter(row => row && (row.currentFcfa != null || row.previousFcfa != null)) : [];
    if (!rows.length) { root.append($el('div', 'chart-empty', 'Aucune comparaison disponible.')); return; }
    const width = Math.max(450, root.clientWidth || 620), rowH = 43, height = Math.max(110, rows.length * rowH + 18);
    const left = Math.min(190, Math.max(110, width * .28)), right = 100, chartW = width - left - right;
    const max = Math.max(1, ...rows.flatMap(row => [Number(row.currentFcfa) || 0, Number(row.previousFcfa) || 0]));
    const svg = makeSvg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Comparaison des recettes courantes et précédentes par zone' });
    rows.forEach((row, i) => {
      const y = 10 + i * rowH;
      const name = makeSvg('text', { x: left - 9, y: y + 21, 'text-anchor': 'end', class: 'chart-label' });
      name.textContent = row.name || 'Zone non nommée'; svg.append(name);
      [['currentFcfa', 0, 'var(--green)'], ['previousFcfa', 15, 'var(--orange)']].forEach(([key, offset, fill]) => {
        const amount = row[key] == null ? null : Number(row[key]);
        if (amount === null || !Number.isFinite(amount)) return;
        const bar = makeSvg('rect', { x: left, y: y + Number(offset), width: Math.max(amount > 0 ? 2 : 0, chartW * amount / max), height: 10, rx: 4, fill });
        const title = makeSvg('title'); title.textContent = `${row.name || 'Zone'} · ${key === 'currentFcfa' ? 'Période actuelle' : 'Période précédente'} · ${money(amount)}`;
        bar.append(title); svg.append(bar);
      });
      const detail = makeSvg('text', { x: left + chartW + 8, y: y + 22, class: 'chart-label' });
      detail.textContent = `${row.currentFcfa == null ? '—' : nf.format(Number(row.currentFcfa))} / ${row.previousFcfa == null ? '—' : nf.format(Number(row.previousFcfa))}`;
      svg.append(detail);
    });
    root.append(svg);
  }
  function renderRanking(zones) {
    const list = $('#zone-ranking'), status = $('#ranking-state');
    list.replaceChildren();
    const rows = (Array.isArray(zones) ? zones : []).filter(zone => zone && Number(zone.revenueFcfa) > 0)
      .slice().sort((a, b) => Number(b.revenueFcfa) - Number(a.revenueFcfa)).slice(0, 6);
    if (!rows.length) {
      list.hidden = true; status.hidden = false;
      stateView(status, 'Aucune vente enregistrée', 'Le classement apparaîtra après saisie de ventes réelles pour cette période.');
      return;
    }
    const max = Math.max(1, ...rows.map(zone => Number(zone.revenueFcfa) || 0));
    rows.forEach(zone => {
      const li = $el('li', 'rank-row');
      li.append($el('span', 'rank-name', zone.name || 'Zone non nommée'));
      const track = $el('span', 'rank-track'); track.setAttribute('aria-hidden', 'true');
      const fill = $el('span', 'rank-fill'); fill.style.width = `${Math.max(1, Number(zone.revenueFcfa) / max * 100)}%`; track.append(fill);
      li.append(track, $el('span', 'rank-value', money(zone.revenueFcfa)));
      list.append(li);
    });
    list.hidden = false; status.hidden = true;
  }
  function renderDashboard(result) {
    if (state.sessionExpired) return;
    state.dashboard = result;
    const summary = result.summary || {};
    setText('#metric-revenue', money(summary.revenueFcfa));
    const global = result.globalReports;
    setText('#metric-global-revenue', global?.coveredDays ? money(global.totalFcfa) : 'Non renseigné');
    setText('#metric-global-coverage', global
      ? `${global.coveredDays} / ${global.selectedDays} jours couverts · ${global.partialCount} relevé(s) partiel(s) exclu(s) · non additionné aux tickets`
      : 'Aucun relevé chargé');
    setText('#detailed-revenue-heading', result.seriesGranularity === 'month' ? 'Ventes détaillées · recettes par mois' : 'Ventes détaillées · recettes par jour');
    setText('#metric-tickets', number(summary.ticketsSold));
    setText('#metric-zones', `${number(summary.zoneCount)} zone(s) non archivée(s)`);
    setText('#metric-today', money(summary.todayRevenueFcfa));
    setText('#metric-performance', pct(summary.performancePercent));
    setText('#metric-watch', `${number(summary.watchZones)} zone(s) avec objectif à surveiller`);
    const period = result.period || {};
    setText('#metric-period', `${safe(period.from)} → ${safe(period.to)}`);
    ui.periodStatus.textContent = `Période ${safe(period.from)} → ${safe(period.to)} · les chiffres reflètent les ventes enregistrées.`;
    setText('#comparison-period-label', `${safe(period.from)} → ${safe(period.to)} comparé à ${safe(period.previousFrom)} → ${safe(period.previousTo)}.`);
    state.from = period.from || state.from; state.to = period.to || state.to;
    history.onPeriodChange({ range: state.range, from: state.from, to: state.to });
    if (period.from) ui.from.value = period.from;
    if (period.to) ui.to.value = period.to;
    renderSeries(result.series);
    renderRanking(result.zones);
    renderComparisons(result.comparisons);
    if (summary.bestMonthZone) {
      const bestName = typeof summary.bestMonthZone === 'string' ? summary.bestMonthZone : summary.bestMonthZone.name;
      $('#best-zone-note').textContent = `Zone au meilleur chiffre du mois (donnée du service) : ${bestName}.`;
    } else $('#best-zone-note').textContent = 'Zone au meilleur chiffre du mois : non définie.';
    const exportUrl = `${API}/export.csv?${periodParams(false).toString()}`;
    $('#export-csv').href = exportUrl;
    if (Array.isArray(result.plans) && result.plans.length) {
      state.plans = result.plans;
      if (state.activeTab === 'plans') renderPlans(result.plans);
    }
    if (state.activeTab === 'zones' && state.zones.length) renderZones();
  }
  async function loadDashboard() {
    const id = ++state.request;
    ui.periodStatus.textContent = 'Actualisation des données enregistrées…';
    try {
      const result = await request(`${API}/dashboard?${periodParams().toString()}`);
      if (id !== state.request) return;
      renderDashboard(result);
    } catch (error) {
      if (error.status !== 401) {
        ui.periodStatus.textContent = error.status === 503 ? 'Service temporairement indisponible (503). Réessayez.' : error.message;
        $('#sales-chart').replaceChildren();
        stateView($('#sales-chart'), 'Données indisponibles', error.message || 'Impossible de charger les chiffres.', 'error', loadDashboard);
        $('#sales-chart').classList.add('chart-wrap');
        $('#zone-ranking').hidden = true;
        stateView($('#ranking-state'), 'Classement indisponible', 'Réessayez après le rétablissement du service.', 'error', loadDashboard);
      }
    }
  }

  function statusClass(status) {
    return status === 'active' ? '' : status === 'archived' ? 'status-archived' : status === 'inactive' ? 'status-inactive' : 'status-unconfirmed';
  }
  async function loadZones() {
    const stateBox = $('#zones-state'), wrap = $('#zones-wrap');
    stateView(stateBox, 'Chargement des zones', 'Nous récupérons les zones et leur statut commercial déclaré.');
    wrap.hidden = true;
    try {
      const result = await request(`${API}/zones`);
      state.zones = Array.isArray(result.zones) ? result.zones : [];
      renderZones();
    } catch (error) { showRequestError(stateBox, error, loadZones); }
  }
  function renderZones() {
    const tbody = $('#zones-body'), stateBox = $('#zones-state'), wrap = $('#zones-wrap');
    const query = $('#zone-search').value.trim().toLocaleLowerCase('fr');
    const all = state.zones.filter(zone => !query || String(zone.name || '').toLocaleLowerCase('fr').includes(query));
    tbody.replaceChildren();
    if (!all.length) {
      wrap.hidden = true;
      stateView(stateBox, state.zones.length ? 'Aucune zone correspondante' : 'Aucune zone enregistrée',
        state.zones.length ? 'Essayez un autre nom de recherche.' : 'Ajoutez une zone pour commencer à organiser les ventes et les objectifs.');
      return;
    }
    stateBox.hidden = true; wrap.hidden = false;
    all.forEach(zone => {
      const row = document.createElement('tr');
      const name = cell(row, '', '');
      name.append($el('strong', 'cell-title', zone.name || 'Zone sans nom'), $el('span', 'cell-sub', `ID ${safe(zone.id)}${zone.archived ? ' · historique conservé' : ''}`));
      const statusCell = cell(row, '', '');
      const badge = $el('span', `status-pill ${statusClass(zone.status)}`, statusLabels[zone.status] || 'À confirmer');
      statusCell.append(badge);
      const dashboardZone = (state.dashboard?.zones || []).find(item => String(item.id) === String(zone.id));
      cell(row, money(dashboardZone?.revenueFcfa ?? null), 'mono');
      cell(row, number(dashboardZone?.ticketsSold ?? null), 'mono');
      const trendCell = cell(row, '', 'trend-cell');
      const direction = dashboardZone?.trendDirection;
      if (direction === 'up' || direction === 'down' || direction === 'same') {
        const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
        const delta = dashboardZone.trendPercent;
        const detail = delta === null
          ? (direction === 'up' ? 'Nouvelles ventes' : 'Variation non calculable')
          : direction === 'same' ? 'Stable · 0 %' : `${direction === 'up' ? '+' : '−'}${pct(Math.abs(Number(delta)))}`;
        trendCell.setAttribute('aria-label', `Tendance ${direction === 'up' ? 'en hausse' : direction === 'down' ? 'en baisse' : 'stable'} : ${detail}`);
        trendCell.append($el('span', `trend-mark trend-${direction}`, arrow), $el('span', 'trend-detail', detail));
      } else {
        trendCell.textContent = 'Non définie';
      }
      const performance = cell(row, '', '');
      const source = dashboardZone?.performanceSource || 'no_goal';
      const value = dashboardZone?.gaugePercent ?? dashboardZone?.performancePercent ?? null;
      setGauge(
        performance, value, source,
        source === 'manual_demo' ? dashboardZone?.demoLabel || 'Démonstration manuelle' : undefined,
        dashboardZone?.performancePercent,
        dashboardZone?.targetFcfa,
        dashboardZone?.revenueFcfa
      );
      cell(row, dashboardZone?.lastSaleAt ? formatDate(dashboardZone.lastSaleAt) : 'Aucune vente enregistrée', '');
      const actions = cell(row, '', '');
      const group = $el('div', 'zone-actions');
      const goals = $el('button', 'icon-btn', 'Obj.'); goals.type = 'button'; goals.title = 'Gérer les objectifs'; goals.setAttribute('aria-label', `Gérer les objectifs de ${zone.name || 'la zone'}`); goals.addEventListener('click', () => openTargets(zone));
      const edit = $el('button', 'icon-btn', 'Édit.'); edit.type = 'button'; edit.title = 'Modifier la zone et son statut'; edit.addEventListener('click', () => openZoneEdit(zone));
      group.append(goals, edit); actions.append(group);
      tbody.append(row);
    });
  }
  function createField(labelText, name, type = 'text', value = '', options = {}) {
    const wrapper = $el('div', `field${options.wide ? ' wide' : ''}`);
    const label = $el('label', '', labelText); label.htmlFor = `field-${name}`;
    let input;
    if (type === 'select') {
      input = document.createElement('select');
      (options.items || []).forEach(item => input.add(new Option(item.label, item.value)));
    } else {
      input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
      if (type !== 'textarea') input.type = type;
      if (options.min !== undefined) input.min = options.min;
      if (options.step !== undefined) input.step = options.step;
      if (options.maxLength) input.maxLength = options.maxLength;
      if (options.required) input.required = true;
      if (options.placeholder) input.placeholder = options.placeholder;
    }
    input.id = `field-${name}`; input.name = name; input.value = value == null ? '' : String(value);
    if (options.required) input.required = true;
    wrapper.append(label, input);
    return wrapper;
  }
  function dialogForm(title, description, fields, submitLabel, submitFn, hint) {
    ui.dialogTitle.textContent = title;
    ui.dialogDescription.textContent = description || '';
    ui.dialogContent.replaceChildren();
    const form = document.createElement('form');
    form.noValidate = false;
    const grid = $el('div', 'form-grid');
    fields.forEach(field => grid.append(createField(field.label, field.name, field.type || 'text', field.value, field.options || {})));
    form.append(grid);
    if (hint) form.append($el('p', 'dialog-hint', hint));
    const message = $el('p', 'form-message'); message.setAttribute('role', 'status');
    const actions = $el('div', 'form-actions');
    const cancel = $el('button', 'btn btn-secondary', 'Annuler'); cancel.type = 'button'; cancel.addEventListener('click', closeDialog);
    const submit = $el('button', 'btn btn-primary', submitLabel); submit.type = 'submit';
    actions.append(cancel, submit); form.append(message, actions);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      message.className = 'form-message'; message.textContent = '';
      if (!form.reportValidity()) return;
      const data = Object.fromEntries(new FormData(form).entries());
      setBusy(submit, true);
      try {
        await submitFn(data);
        message.className = 'form-message success'; message.textContent = 'Enregistrement confirmé.';
        window.setTimeout(closeDialog, 500);
      } catch (error) {
        if (error.status === 401) return;
        message.className = 'form-message error';
        message.textContent = error.status === 503 ? `Service temporairement indisponible (503). ${error.message}` :
          error.status >= 400 && error.status < 500 ? `Donnée refusée : ${error.message}` :
            error.message || 'Impossible d’enregistrer. Réessayez.';
      } finally { setBusy(submit, false); }
    });
    ui.dialogContent.append(form);
    if (!ui.dialog.open) ui.dialog.showModal();
  }
  function closeDialog() { if (ui.dialog.open) ui.dialog.close(); }
  async function openAddZone() {
    dialogForm('Ajouter une zone', 'La création conserve les zones existantes et leurs historiques.', [
      { label: 'Nom de la zone', name: 'name', value: '', options: { required: true, maxLength: 100, placeholder: 'Nom commercial de la zone' } }
    ], 'Créer la zone', async data => {
      await request(`${API}/zones`, { method: 'POST', body: JSON.stringify({ name: data.name.trim() }) });
      await Promise.all([loadZones(), loadDashboard()]);
    });
  }
  function openZoneEdit(zone) {
    dialogForm('Modifier une zone', 'Les changements de statut sont des déclarations commerciales, pas des mesures réseau.', [
      { label: 'Nom de la zone', name: 'name', value: zone.name || '', options: { required: true, maxLength: 100 } },
      { label: 'Statut déclaré', name: 'status', type: 'select', value: zone.status || 'unconfirmed', options: { items: [
        { value: 'unconfirmed', label: 'À confirmer' }, { value: 'active', label: 'Actif · déclaré' },
        { value: 'inactive', label: 'Inactif · déclaré' }, { value: 'archived', label: 'Archivé · historique préservé' }
      ] } }
    ], 'Enregistrer', async data => {
      await request(`${API}/zones/${encodeURIComponent(zone.id)}`, {
        method: 'PATCH', body: JSON.stringify({ name: data.name.trim(), status: data.status })
      });
      await Promise.all([loadZones(), loadDashboard()]);
    }, 'Archiver ne supprime pas la zone ni son historique. Les états n’indiquent jamais une connexion Wi-Fi.');
  }
  function openTargets(zone) {
    const target = (key, label, value) => ({ label: `${label} · FCFA (laisser vide pour non défini)`, name: key, type: 'number', value, options: { min: 1, step: 1 } });
    dialogForm(`Objectifs · ${zone.name || 'Zone'}`, 'Sans objectif, aucun pourcentage de performance n’est calculé.', [
      target('dailyTargetFcfa', 'Objectif journalier', zone.dailyTargetFcfa),
      target('weeklyTargetFcfa', 'Objectif hebdomadaire', zone.weeklyTargetFcfa),
      target('monthlyTargetFcfa', 'Objectif mensuel', zone.monthlyTargetFcfa)
    ], 'Enregistrer les objectifs', async data => {
      const parseTarget = key => data[key].trim() === '' ? null : Number(data[key]);
      const payload = {
        dailyTargetFcfa: parseTarget('dailyTargetFcfa'),
        weeklyTargetFcfa: parseTarget('weeklyTargetFcfa'),
        monthlyTargetFcfa: parseTarget('monthlyTargetFcfa')
      };
      if (Object.values(payload).some(value => value !== null && (!Number.isInteger(value) || value <= 0))) {
        throw new Error('Les objectifs doivent être des montants entiers positifs ou laissés vides.');
      }
      await request(`${API}/zones/${encodeURIComponent(zone.id)}/targets`, { method: 'PUT', body: JSON.stringify(payload) });
      await Promise.all([loadZones(), loadDashboard()]);
    }, 'Effacer un champ puis enregistrer pour le remettre à Non défini. Les données historiques restent inchangées.');
  }

  async function loadPlans() {
    const status = $('#plans-state'), grid = $('#plans-grid');
    stateView(status, 'Chargement des offres', 'Récupération des offres et tarifs actuels.');
    grid.hidden = true;
    try {
      const result = await request(`${API}/plans`);
      state.plans = Array.isArray(result.plans) ? result.plans : [];
      renderPlans(state.plans);
    } catch (error) { showRequestError(status, error, loadPlans); }
  }
  function renderPlans(plans) {
    const grid = $('#plans-grid'), status = $('#plans-state');
    grid.replaceChildren();
    if (!plans.length) {
      grid.hidden = true;
      stateView(status, 'Aucune offre disponible', 'Aucune offre n’a été renvoyée par le service.');
      return;
    }
    plans.forEach(plan => {
      const card = $el('article', 'plan-card');
      const head = $el('div', 'plan-head');
      const identity = document.createElement('div');
      identity.append($el('h4', 'plan-name', plan.label || 'Offre sans libellé'), $el('span', 'plan-code', safe(plan.code)));
      const enabled = $el('span', `status-pill${plan.enabled ? '' : ' status-inactive'}`, plan.enabled ? 'Activée' : 'Désactivée');
      head.append(identity, enabled);
      const price = $el('strong', `plan-price${plan.priceFcfa == null ? ' undefined' : ''}`, money(plan.priceFcfa));
      const actions = $el('div', 'plan-actions');
      const toggleWrap = $el('label', 'toggle');
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = Boolean(plan.enabled); check.setAttribute('aria-label', `Activer l’offre ${plan.label || plan.code}`);
      const stateLabel = $el('span', '', plan.enabled ? 'Disponible à la vente' : 'Non disponible');
      check.addEventListener('change', async () => {
        check.disabled = true;
        try {
          await request(`${API}/plans/${encodeURIComponent(plan.code)}`, {
            method: 'PATCH', body: JSON.stringify({ priceFcfa: plan.priceFcfa == null ? null : Number(plan.priceFcfa), enabled: check.checked })
          });
          await loadPlans();
        } catch (error) {
          check.checked = Boolean(plan.enabled);
          stateLabel.textContent = error.message;
        } finally { check.disabled = false; }
      });
      toggleWrap.append(check, stateLabel);
      const edit = $el('button', 'btn btn-secondary', 'Modifier le prix'); edit.type = 'button'; edit.addEventListener('click', () => openPlanPrice(plan));
      actions.append(toggleWrap, edit);
      card.append(head, price, actions);
      if (plan.priceFcfa != null && plan.updatedAt) {
        card.append($el('p', 'cell-sub', `Dernière mise à jour : ${formatDate(plan.updatedAt)}`));
      }
      grid.append(card);
    });
    status.hidden = true; grid.hidden = false;
  }
  function openPlanPrice(plan) {
    dialogForm(`Prix · ${plan.label || plan.code}`, 'Saisissez le tarif de référence de ce ticket. Cela ne crée pas de vente et ne modifie pas les recettes passées.', [
      { label: 'Prix en FCFA · vide = non défini', name: 'priceFcfa', type: 'number', value: plan.priceFcfa, options: { min: 1, step: 1 } }
    ], 'Enregistrer le prix', async data => {
      const value = data.priceFcfa.trim() === '' ? null : Number(data.priceFcfa);
      if (value !== null && (!Number.isInteger(value) || value <= 0)) throw new Error('Le prix doit être un entier positif ou laissé vide.');
      const saved = await request(`${API}/plans/${encodeURIComponent(plan.code)}`, {
        method: 'PATCH', body: JSON.stringify({ priceFcfa: value, enabled: Boolean(plan.enabled) })
      });
      await loadPlans();
      setText('#plans-feedback', `Tarif ${saved.plan.label} enregistré : ${money(saved.plan.priceFcfa)} · ${formatDate(saved.plan.updatedAt)}. Les ventes et recettes historiques restent inchangées.`);
    }, 'Un prix non défini ne sera pas affiché comme zéro. Les ventes historiques ne sont pas recalculées.');
  }

  async function loadSales() {
    const stateBox = $('#sales-state'), wrap = $('#sales-wrap');
    stateView(stateBox, 'Chargement des ventes', 'Récupération du registre sur la période sélectionnée.');
    wrap.hidden = true;
    const params = periodParams(false);
    params.set('page', String(state.salesPage));
    try {
      const result = await request(`${API}/sales?${params.toString()}`);
      renderSales(result);
    } catch (error) { showRequestError(stateBox, error, loadSales); }
  }
  function renderSales(result) {
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const tbody = $('#sales-body'), stateBox = $('#sales-state');
    tbody.replaceChildren();
    state.salesPage = Number(result.page) || state.salesPage;
    state.salesTotal = Number(result.total) || 0;
    state.salesPageSize = Number(result.pageSize) || 25;
    setText('#sales-total', `${number(result.total)} vente(s) sur la période`);
    if (!rows.length) {
      $('#sales-wrap').hidden = true;
      stateView(stateBox, 'Aucune vente pour cette période', 'Saisissez une vente manuelle pour commencer le registre. Les ventes saisies sont réelles et ne sont pas des données de démonstration.');
      $('#sales-pagination').hidden = true;
      return;
    }
    rows.forEach(sale => {
      const row = document.createElement('tr');
      cell(row, formatDate(sale.soldAt), 'mono');
      cell(row, sale.zoneName || `Zone ${safe(sale.zoneId)}`, '');
      cell(row, sale.planLabel || safe(sale.planCode), '');
      cell(row, money(sale.amountFcfa), 'mono');
      cell(row, number(sale.ticketCount), 'mono');
      const history = cell(row, '', '');
      if (sale.corrected) {
        history.append($el('span', 'status-pill status-inactive', 'Correction auditée'));
        history.append($el('span', 'cell-sub', sale.correctionReason || 'Motif non renseigné'));
      } else history.append($el('span', 'cell-sub', 'Vente enregistrée'));
      const action = cell(row, '', '');
      const button = $el('button', 'btn btn-secondary', 'Corriger'); button.type = 'button'; button.addEventListener('click', () => openCorrection(sale));
      if (sale.corrected) {
        button.disabled = true;
        button.textContent = 'Déjà remplacée';
        button.title = 'La correction existe déjà. Ouvrez la correction la plus récente pour en ajouter une nouvelle.';
      }
      action.append(button);
      tbody.append(row);
    });
    stateBox.hidden = true; $('#sales-wrap').hidden = false;
    const pages = Math.max(1, Math.ceil(state.salesTotal / state.salesPageSize));
    $('#sales-page-label').textContent = `Page ${state.salesPage} sur ${pages}`;
    $('#sales-prev').disabled = state.salesPage <= 1;
    $('#sales-next').disabled = state.salesPage >= pages;
    $('#sales-pagination').hidden = false;
  }
  async function salesFormSubmit(data, correctionId) {
    const numericZoneId = Number(data.zoneId);
    const zoneId = Number.isSafeInteger(numericZoneId) && String(numericZoneId) === data.zoneId ? numericZoneId : data.zoneId;
    const body = {
      zoneId, planCode: data.planCode,
      amountFcfa: Number(data.amountFcfa), ticketCount: Number(data.ticketCount)
    };
    if (data.soldAt) body.soldAt = new Date(`${data.soldAt}:00+01:00`).toISOString();
    if (correctionId) body.reason = data.reason.trim();
    if (!data.zoneId || !Number.isInteger(body.amountFcfa) || !Number.isInteger(body.ticketCount) || body.amountFcfa <= 0 || body.ticketCount <= 0) {
      throw new Error('Choisissez une zone et indiquez un montant ainsi qu’un nombre de tickets entiers positifs.');
    }
    if (correctionId && !body.reason) throw new Error('Un motif est obligatoire pour conserver la trace de la correction.');
    const endpoint = correctionId ? `${API}/sales/${encodeURIComponent(correctionId)}/correct` : `${API}/sales`;
    await request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    state.salesPage = 1;
    await Promise.all([loadSales(), loadDashboard()]);
    if (state.activeTab === 'zones') await loadZones();
  }
  function saleFields(sale) {
    const zoneChoices = state.zones.filter(zone => sale
      ? String(zone.id) === String(sale.zoneId) || (!zone.archived && zone.status === 'active')
      : !zone.archived && zone.status === 'active'
    ).map(zone => ({ value: String(zone.id), label: `${zone.name || `Zone ${zone.id}`}${zone.archived || zone.status === 'archived' ? ' · archivée · historique' : ''}` }));
    const planChoices = state.plans.filter(plan => sale || plan.enabled).map(plan => ({ value: plan.code, label: plan.label || plan.code }));
    const fields = [
      { label: 'Zone commerciale', name: 'zoneId', type: 'select', value: sale ? String(sale.zoneId) : '', options: { required: true, items: [{ value: '', label: 'Choisir une zone' }, ...zoneChoices] } },
      { label: 'Offre', name: 'planCode', type: 'select', value: sale?.planCode || '', options: { required: true, items: [{ value: '', label: 'Choisir une offre' }, ...planChoices] } },
      { label: 'Montant réellement encaissé · FCFA', name: 'amountFcfa', type: 'number', value: sale?.amountFcfa ?? '', options: { required: true, min: 1, step: 1 } },
      { label: 'Nombre de tickets', name: 'ticketCount', type: 'number', value: sale?.ticketCount ?? 1, options: { required: true, min: 1, step: 1 } },
      { label: 'Date et heure · heure du Niger', name: 'soldAt', type: 'datetime-local', value: sale?.soldAt ? dateTimeLocal(sale.soldAt) : '', options: {} }
    ];
    if (sale) fields.push({ label: 'Motif obligatoire de correction', name: 'reason', type: 'textarea', value: sale.correctionReason || '', options: { required: true, maxLength: 500, wide: true, placeholder: 'Expliquez clairement la correction à ajouter à l’historique.' } });
    return fields;
  }
  function dateTimeLocal(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    return parts.replace(' ', 'T');
  }
  async function openSale() {
    if (!state.zones.length) await loadZones();
    if (!state.plans.length) await loadPlans();
    const activeZones = state.zones.filter(zone => !zone.archived && zone.status === 'active');
    const enabledPlans = state.plans.filter(plan => plan.enabled);
    if (!activeZones.length || !enabledPlans.length) {
      showDialogMessage('Saisie de vente indisponible',
        !activeZones.length
          ? 'Déclarez d’abord une zone comme active dans « Zones ». Cette déclaration reste commerciale et ne confirme aucune connexion réseau.'
          : 'Activez au moins une offre dans « Offres & prix » avant de saisir une vente.');
      return;
    }
    dialogForm('Saisir une vente réelle', 'Cette entrée est une vente manuellement enregistrée et sera incluse dans le registre.', saleFields(null), 'Enregistrer la vente', data => salesFormSubmit(data));
  }
  function openCorrection(sale) {
    dialogForm('Ajouter une correction auditée', `Vente ${sale.id} · l’entrée précédente reste conservée.`, saleFields(sale), 'Ajouter la correction', data => salesFormSubmit(data, sale.id),
      'La correction sera ajoutée avec un motif obligatoire. L’historique initial n’est jamais supprimé.');
  }
  function showDialogMessage(title, message) {
    ui.dialogTitle.textContent = title; ui.dialogDescription.textContent = '';
    ui.dialogContent.replaceChildren($el('div', 'dialog-hint', message));
    const close = $el('div', 'form-actions');
    const button = $el('button', 'btn btn-primary', 'Fermer'); button.type = 'button'; button.addEventListener('click', closeDialog); close.append(button);
    ui.dialogContent.append(close);
    if (!ui.dialog.open) ui.dialog.showModal();
  }

  async function loadAudit() {
    const status = $('#audit-state'), list = $('#audit-list');
    stateView(status, 'Chargement du journal', 'Récupération des actions auditées.');
    list.hidden = true;
    const params = periodParams(false); params.set('page', String(state.auditPage));
    try {
      const result = await request(`${API}/audit?${params.toString()}`);
      renderAudit(result);
    } catch (error) { showRequestError(status, error, loadAudit); }
  }
  function renderAudit(result) {
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const list = $('#audit-list'), status = $('#audit-state');
    state.auditTotal = Number(result.total) || 0;
    state.auditPage = Number(result.page) || state.auditPage;
    state.auditPageSize = Number(result.pageSize) || 25;
    setText('#audit-total', `${number(result.total)} action(s)`);
    list.replaceChildren();
    if (!rows.length) {
      list.hidden = true;
      stateView(status, 'Aucune action dans cette période', 'Les nouvelles actions administratives apparaîtront ici lorsqu’elles seront renvoyées par le service.');
      $('#audit-pagination').hidden = true;
      return;
    }
    rows.forEach(item => {
      const article = $el('article', 'audit-row');
      const time = $el('time', '', formatDate(item.createdAt)); article.append(time);
      const details = document.createElement('div');
      details.append($el('strong', '', item.summary || item.action || 'Action administrative'));
      details.append($el('p', '', `${safe(item.action)} · ${safe(item.entityType)} ${item.entityId == null ? '' : `#${item.entityId}`}`));
      if (item.action === 'plan_updated' && item.details?.before && item.details?.after) {
        details.append($el('p', '', `Tarif : ${money(item.details.before.priceFcfa)} → ${money(item.details.after.priceFcfa)}`));
      }
      if (item.reason) details.append($el('p', '', `Motif : ${item.reason}`));
      article.append(details); list.append(article);
    });
    status.hidden = true; list.hidden = false;
    const pages = Math.max(1, Math.ceil(state.auditTotal / state.auditPageSize));
    $('#audit-page-label').textContent = `Page ${state.auditPage} sur ${pages}`;
    $('#audit-prev').disabled = state.auditPage <= 1;
    $('#audit-next').disabled = state.auditPage >= pages;
    $('#audit-pagination').hidden = false;
  }

  function activateTab(name) {
    state.activeTab = name;
    document.querySelectorAll('[role="tab"]').forEach(tab => {
      const selected = tab.id === `tab-${name}`;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('[role="tabpanel"]').forEach(panel => { panel.hidden = panel.id !== `panel-${name}`; });
    if (name === 'zones' && !state.zones.length) loadZones();
    if (name === 'sales') loadSales();
    if (name === 'plans') {
      if (state.plans.length) renderPlans(state.plans);
      else loadPlans();
    }
    if (name === 'audit') loadAudit();
    if (name === 'reports') history.load();
  }
  function updateCustomDate() {
    if (!ui.from.value || !ui.to.value || !ui.from.checkValidity() || !ui.to.checkValidity() || ui.from.value > ui.to.value) {
      ui.periodStatus.textContent = 'Choisissez une plage de dates valide : la date de début ne peut pas dépasser la date de fin.';
      return;
    }
    state.from = ui.from.value; state.to = ui.to.value; state.range = 'custom'; state.salesPage = 1;
    loadDashboard();
    if (state.activeTab === 'sales') loadSales();
    if (state.activeTab === 'audit') { state.auditPage = 1; loadAudit(); }
  }
  function loadActiveTab() {
    if (state.activeTab === 'zones') loadZones();
    else if (state.activeTab === 'sales') loadSales();
    else if (state.activeTab === 'plans') loadPlans();
    else if (state.activeTab === 'audit') loadAudit();
    else if (state.activeTab === 'reports') history.load();
    loadDashboard();
  }
  function bind() {
    document.querySelectorAll('[data-range]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.range === 'month') { history.openCalendar(); return; }
      setRange(button.dataset.range); loadDashboard();
      if (state.activeTab === 'sales') loadSales();
      if (state.activeTab === 'audit') { state.auditPage = 1; loadAudit(); }
    }));
    ui.from.addEventListener('change', updateCustomDate);
    ui.to.addEventListener('change', updateCustomDate);
    $('#refresh-all').addEventListener('click', loadActiveTab);
    const showPlans = () => {
      activateTab('plans');
      $('#tab-plans').focus();
      $('#panel-plans').scrollIntoView({ block: 'start' });
    };
    $('#open-plan-prices').addEventListener('click', showPlans);
    $('#open-plan-audit').addEventListener('click', () => {
      setRange('today');
      loadDashboard();
      activateTab('audit');
      $('#tab-audit').focus();
      $('#panel-audit').scrollIntoView({ block: 'start' });
    });
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    tabs.forEach((tab, index) => {
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      tab.addEventListener('click', () => activateTab(tab.id.replace('tab-', '')));
      tab.addEventListener('keydown', event => {
        if (tab.disabled || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        const next = tabs[nextIndex];
        activateTab(next.id.replace('tab-', ''));
        next.focus();
      });
    });
    $('#zone-search').addEventListener('input', renderZones);
    $('#add-zone').addEventListener('click', openAddZone);
    $('#print-zones').addEventListener('click', () => window.print());
    $('#add-sale').addEventListener('click', openSale);
    $('#sales-prev').addEventListener('click', () => { if (state.salesPage > 1) { state.salesPage -= 1; loadSales(); } });
    $('#sales-next').addEventListener('click', () => { if (state.salesPage < Math.ceil(state.salesTotal / state.salesPageSize)) { state.salesPage += 1; loadSales(); } });
    $('#print-sales').addEventListener('click', () => window.print());
    $('#reload-plans').addEventListener('click', loadPlans);
    $('#reload-audit').addEventListener('click', loadAudit);
    $('#audit-prev').addEventListener('click', () => { if (state.auditPage > 1) { state.auditPage -= 1; loadAudit(); } });
    $('#audit-next').addEventListener('click', () => { if (state.auditPage < Math.ceil(state.auditTotal / state.auditPageSize)) { state.auditPage += 1; loadAudit(); } });
    $('#dialog-close').addEventListener('click', closeDialog);
    ui.dialog.addEventListener('click', event => { if (event.target === ui.dialog) closeDialog(); });
    $('#theme-toggle').addEventListener('click', () => {
      const html = document.documentElement;
      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      $('#theme-toggle').textContent = next === 'dark' ? 'Thème clair' : 'Thème sombre';
      try { localStorage.setItem('ibn-wifi-theme', next); } catch (_) { /* theme still works for this page */ }
    });
    try {
      const saved = localStorage.getItem('ibn-wifi-theme');
      if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
    } catch (_) { /* local theme preference is optional */ }
    $('#theme-toggle').textContent = document.documentElement.dataset.theme === 'dark' ? 'Thème clair' : 'Thème sombre';
  }

  const history = window.WifiBusinessHistory.init({
    request, activateTab, today: dateInNiger, refreshDashboard: loadDashboard,
    selectPeriod({ range, from, to }) {
      state.range = range; state.from = from; state.to = to; state.salesPage = 1;
      ui.from.value = from; ui.to.value = to; ui.dateRange.hidden = false;
      document.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.range === (range === 'calendar-month' ? 'month' : 'custom'))));
      loadDashboard();
      if (state.activeTab === 'sales') loadSales();
      if (state.activeTab === 'audit') { state.auditPage = 1; loadAudit(); }
    }
  });
  for (const input of [ui.from, ui.to]) {
    input.min = '1999-01-01';
    input.max = dateInNiger();
  }
  const wifiZoneEntry = window.location.hash === '#recettes';
  setRange(wifiZoneEntry ? 'month' : '30d');
  bind();
  if (window.location.hash === '#tarifs') activateTab('plans');
  if (wifiZoneEntry) {
    document.querySelector('.brand h1').textContent = 'Gestion des Wi-Fi Zones';
    document.title = 'Wi-Fi Zones — Administration privée';
    activateTab('reports');
  }
  loadDashboard();
})();
