(() => {
  'use strict';

  const API = '/api/admin/wifi-business';
  const MONTHS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const numberFormat = new Intl.NumberFormat('fr-FR');
  const $ = (id) => document.getElementById(id);

  function init(options) {
    const config = options || {};
    const request = config.request;
    const selectPeriod = config.selectPeriod;
    const activateTab = config.activateTab;
    const refreshDashboard = config.refreshDashboard;
    const todaySource = config.today;
    const state = { range: '', from: '', to: '', page: 1, pageSize: 50, total: 0, rows: [], locked: false, busy: false, voidId: null, requestId: 0 };
    const ui = {
      tab: $('tab-reports'), panel: $('panel-reports'), calendar: document.querySelector('.reports-calendar'),
      year: $('reports-year'), month: $('reports-month'), preview: $('reports-range-preview'),
      applyMonth: $('reports-apply-month'), applyYear: $('reports-apply-year'),
      export: $('reports-export'), feedback: $('reports-feedback'), receipt: $('reports-receipt'),
      total: $('reports-total'), coverage: $('reports-coverage'), selectedDays: $('reports-selected-days'),
      average: $('reports-average'), partialCount: $('reports-partial-count'),
      chart: $('reports-chart'), chartCap: $('reports-chart-cap'),
      chartTable: $('reports-chart-table-wrap'), chartTableBody: $('reports-chart-table-body'),
      totalCount: $('reports-total-count'), state: $('reports-state'), listWrap: $('reports-list-wrap'),
      body: $('reports-body'), pagination: $('reports-pagination'), pageLabel: $('reports-page-label'),
      previous: $('reports-prev'), next: $('reports-next'),
      add: $('reports-add-button'), createPanel: $('reports-form-panel'), createForm: $('reports-create-form'),
      createFrom: $('reports-form-from'), createTo: $('reports-form-to'), createAmount: $('reports-form-amount'),
      createNote: $('reports-form-note'), createSubmit: $('reports-submit'), createClose: $('reports-cancel-create'),
      voidPanel: $('reports-void-panel'), voidForm: $('reports-void-form'), voidReason: $('reports-void-reason'),
      voidDescription: $('reports-void-description'), voidSubmit: $('reports-void-submit'), voidClose: $('reports-cancel-void')
    };

    function today() {
      const value = typeof todaySource === 'function' ? todaySource() : todaySource;
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : new Date().toISOString().slice(0, 10);
    }
    function shiftDate(value, days) {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day + days));
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    }
    function monthEnd(year, monthIndex) {
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()).padStart(2, '0')}`;
    }
    function fmtDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value || 'Date non définie');
      const [year, month, day] = value.split('-').map(Number);
      return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })
        .format(new Date(Date.UTC(year, month - 1, day)));
    }
    function fmtCreated(value) {
      if (!value) return 'Date non définie';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Africa/Niamey', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }).format(date);
    }
    function money(value) {
      if (value == null || value === '') return 'Non renseigné';
      const amount = Number(value);
      return Number.isFinite(amount) ? `${numberFormat.format(amount)} FCFA` : '—';
    }
    function setText(node, value) {
      if (node) node.textContent = value == null ? '' : String(value);
    }
    function make(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    }
    function active() {
      return Boolean(ui.panel && !ui.panel.hidden && ui.tab?.getAttribute('aria-selected') === 'true');
    }
    function queryUrl(page) {
      const params = new URLSearchParams({ from: state.from, to: state.to, page: String(page || 1) });
      return `${API}/reports?${params.toString()}`;
    }
    function updateExport() {
      if (!ui.export || !state.from || !state.to) return;
      const params = new URLSearchParams({ from: state.from, to: state.to });
      ui.export.href = `${API}/reports/export.csv?${params.toString()}`;
    }
    function feedback(message, type) {
      setText(ui.feedback, message);
      if (ui.feedback) ui.feedback.className = `form-message reports-feedback${type ? ` ${type}` : ''}`;
    }
    function setState(title, message, isError, retry) {
      if (!ui.state) return;
      ui.state.replaceChildren();
      ui.state.className = `state${isError ? ' load-error' : ''}`;
      if (title) ui.state.append(make('h4', '', title));
      if (message) ui.state.append(make('p', '', message));
      if (retry) {
        const button = make('button', 'btn btn-primary', 'Réessayer');
        button.type = 'button';
        button.addEventListener('click', retry);
        ui.state.append(button);
      }
      ui.state.hidden = false;
      if (ui.listWrap) ui.listWrap.hidden = true;
    }
    function selectedRanges(monthOnly = true) {
      const selectedYear = Number(ui.year.value);
      const monthIndex = Number(ui.month.value);
      const current = today();
      let from = `${selectedYear}-01-01`;
      let to = `${selectedYear}-12-31`;
      if (selectedYear === Number(current.slice(0, 4)) && to > current) to = current;
      if (monthOnly && monthIndex >= 0) {
        from = `${selectedYear}-${String(monthIndex + 1).padStart(2, '0')}-01`;
        to = monthEnd(selectedYear, monthIndex);
        if (to > current) to = current;
      }
      return { from, to };
    }
    function refreshCalendarPreview() {
      if (!ui.year || !ui.month) return;
      const selectedYear = Number(ui.year.value);
      const current = today();
      const thisYear = Number(current.slice(0, 4));
      const currentMonth = Number(current.slice(5, 7)) - 1;
      Array.from(ui.month.options).forEach(option => {
        option.disabled = selectedYear === thisYear && Number(option.value) > currentMonth;
      });
      if (ui.month.selectedOptions[0]?.disabled) ui.month.value = String(currentMonth);
      const { from, to } = selectedRanges(true);
      setText(ui.preview, `${fmtDate(from)} → ${fmtDate(to)} · sélection à appliquer`);
      const selectedMonth = Number(ui.month.value);
      const monthIsFuture = selectedYear === thisYear && selectedMonth > currentMonth;
      if (ui.applyMonth) ui.applyMonth.disabled = state.locked || monthIsFuture;
      if (ui.applyYear) ui.applyYear.disabled = state.locked;
    }
    function buildCalendar() {
      if (!ui.year || !ui.month) return;
      const currentYear = Number(today().slice(0, 4));
      ui.year.replaceChildren();
      for (let year = currentYear; year >= 1999; year -= 1) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        ui.year.append(option);
      }
      ui.year.value = String(currentYear);
      ui.month.replaceChildren();
      MONTHS.forEach((name, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = name;
        ui.month.append(option);
      });
      ui.month.value = String(Number(today().slice(5, 7)) - 1);
      ui.year.onchange = () => {
        const currentYearNow = Number(today().slice(0, 4));
        const monthIndex = Number(ui.month.value);
        if (Number(ui.year.value) === currentYearNow && monthIndex > Number(today().slice(5, 7)) - 1) {
          ui.month.value = String(Number(today().slice(5, 7)) - 1);
        }
        refreshCalendarPreview();
      };
      ui.month.onchange = refreshCalendarPreview;
      refreshCalendarPreview();
    }
    function statusFor(row) {
      if (row.voidedAt) return { text: 'Annulée · montant exclu', className: 'reports-status-cancelled' };
      if (row.included === true) return { text: 'Incluse · période complète', className: 'reports-status-included' };
      if (row.from > state.to || row.to < state.from) return { text: 'Hors sélection · exclue', className: 'reports-status-outside' };
      return { text: 'Partielle · exclue', className: 'reports-status-partial' };
    }
    function renderRows(rows) {
      if (!ui.body) return;
      ui.body.replaceChildren();
      rows.forEach(row => {
        const tr = document.createElement('tr');
        const period = make('td');
        period.append(make('strong', 'cell-title', `${fmtDate(row.from)} → ${fmtDate(row.to)}`));
        period.append(make('span', 'cell-sub', `Déclaration ${row.id == null ? '' : `n° ${row.id}`}`));
        tr.append(period);
        const amount = make('td', 'mono', money(row.amountFcfa));
        tr.append(amount);
        tr.append(make('td', '', row.note || 'Source non renseignée'));
        const status = statusFor(row);
        const statusCell = make('td');
        statusCell.append(make('span', `status-pill ${status.className}`, status.text));
        tr.append(statusCell);
        tr.append(make('td', '', fmtCreated(row.createdAt)));
        const action = make('td');
        if (!row.voidedAt) {
          const cancel = make('button', 'btn btn-danger', 'Annuler');
          cancel.type = 'button';
          cancel.setAttribute('aria-label', `Annuler la déclaration ${row.id == null ? '' : `n° ${row.id}`}`);
          cancel.addEventListener('click', () => openVoidForm(row));
          action.append(cancel);
        } else {
          action.append(make('span', 'cell-sub', `Annulée le ${fmtCreated(row.voidedAt)}`));
          if (row.voidReason) action.append(make('span', 'cell-sub', `Motif : ${row.voidReason}`));
        }
        tr.append(action);
        ui.body.append(tr);
      });
    }
    function renderChart(rows) {
      const included = rows.filter(row => row.included === true && !row.voidedAt);
      if (ui.chartTableBody) ui.chartTableBody.replaceChildren();
      if (!included.length) {
        ui.chart.replaceChildren(make('div', 'chart-empty', 'Aucune déclaration entièrement incluse sur cette page.'));
        ui.chartTable.hidden = true;
        setText(ui.chartCap, 'Aucune barre à afficher pour la page courante.');
        return;
      }
      const width = Math.max(560, ui.chart.clientWidth || 720);
      const rowHeight = 34;
      const height = Math.max(110, included.length * rowHeight + 22);
      const labelX = 8;
      const barX = 208;
      const valueSpace = 118;
      const barMax = Math.max(80, width - barX - valueSpace);
      const maximum = Math.max(1, ...included.map(row => Number(row.amountFcfa) || 0));
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-labelledby', 'reports-svg-title reports-svg-desc');
      const title = document.createElementNS(svg.namespaceURI, 'title');
      title.id = 'reports-svg-title';
      title.textContent = 'Montants des déclarations globales incluses';
      const desc = document.createElementNS(svg.namespaceURI, 'desc');
      desc.id = 'reports-svg-desc';
      desc.textContent = `Graphique de ${included.length} déclarations réelles entièrement comprises dans la sélection courante. Aucune répartition par jour.`;
      svg.append(title, desc);
      included.forEach((row, index) => {
        const y = 14 + index * rowHeight;
        const label = document.createElementNS(svg.namespaceURI, 'text');
        label.setAttribute('x', String(labelX));
        label.setAttribute('y', String(y + 12));
        label.setAttribute('class', 'chart-label');
        label.textContent = `${row.from} → ${row.to}`;
        svg.append(label);
        const barWidth = Math.max(Number(row.amountFcfa) > 0 ? 2 : 0, barMax * (Number(row.amountFcfa) || 0) / maximum);
        const bar = document.createElementNS(svg.namespaceURI, 'rect');
        bar.setAttribute('x', String(barX));
        bar.setAttribute('y', String(y));
        bar.setAttribute('width', String(barWidth));
        bar.setAttribute('height', '18');
        bar.setAttribute('rx', '5');
        bar.setAttribute('class', 'chart-bar');
        const tip = document.createElementNS(svg.namespaceURI, 'title');
        tip.textContent = `${row.from} → ${row.to} · ${money(row.amountFcfa)}`;
        bar.append(tip);
        svg.append(bar);
        const value = document.createElementNS(svg.namespaceURI, 'text');
        value.setAttribute('x', String(width - 8));
        value.setAttribute('y', String(y + 13));
        value.setAttribute('text-anchor', 'end');
        value.setAttribute('class', 'chart-label');
        value.textContent = money(row.amountFcfa);
        svg.append(value);
        const tableRow = document.createElement('tr');
        tableRow.append(make('td', '', `${fmtDate(row.from)} → ${fmtDate(row.to)}`));
        tableRow.append(make('td', 'mono', money(row.amountFcfa)));
        ui.chartTableBody.append(tableRow);
      });
      ui.chart.replaceChildren(svg);
      ui.chartTable.hidden = false;
      setText(ui.chartCap, `Graphique limité aux ${included.length} déclaration(s) incluse(s) de cette page (50 lignes maximum par page). Les périodes complètes sont celles de chaque déclaration.`);
    }
    function render(result) {
      const rows = Array.isArray(result.rows) ? result.rows : [];
      state.rows = rows;
      state.total = Number(result.total) || 0;
      state.page = Number(result.page) || state.page;
      state.pageSize = Number(result.pageSize) || 50;
      const summary = result.summary || {};
      setText(ui.total, summary.coveredDays > 0 ? money(summary.totalFcfa) : 'Non renseigné');
      setText(ui.coverage, numberFormat.format(Number(summary.coveredDays) || 0));
      setText(ui.selectedDays, `sur ${numberFormat.format(Number(summary.selectedDays) || 0)} jours sélectionnés`);
      setText(ui.average, money(summary.dailyAverageFcfa));
      setText(ui.partialCount, numberFormat.format(Number(summary.partialCount) || 0));
      setText(ui.totalCount, `${numberFormat.format(state.total)} déclaration(s) · ${state.from} → ${state.to}`);
      renderRows(rows);
      renderChart(rows);
      if (ui.state) ui.state.hidden = true;
      if (ui.listWrap) ui.listWrap.hidden = rows.length === 0;
      const pageCount = Math.max(1, Math.ceil(state.total / state.pageSize));
      if (ui.pagination) ui.pagination.hidden = state.total <= state.pageSize;
      setText(ui.pageLabel, `Page ${state.page} sur ${pageCount} · ${rows.length} ligne(s) affichée(s)`);
      if (ui.previous) ui.previous.disabled = state.locked || state.page <= 1;
      if (ui.next) ui.next.disabled = state.locked || state.page >= pageCount;
      updateExport();
      if (!rows.length) setState('Aucune déclaration sur cette page', 'Aucune déclaration globale ne correspond à la sélection courante.', false);
    }
    function clearReceipt() {
      if (ui.receipt) {
        ui.receipt.replaceChildren();
        ui.receipt.hidden = true;
      }
    }
    function renderReceipt(row, action) {
      if (!ui.receipt) return;
      const box = make('div');
      box.append(make('strong', '', action === 'void' ? 'Annulation enregistrée' : 'Déclaration enregistrée'));
      if (row) {
        box.append(make('span', '', `Déclaration ${row.id == null ? '' : `n° ${row.id} · `}${fmtDate(row.from)} → ${fmtDate(row.to)} · ${money(row.amountFcfa)}`));
        if (row.note) box.append(make('span', 'cell-sub', `Source confirmée : ${row.note}`));
        if (row.voidReason) box.append(make('span', 'cell-sub', `Motif conservé : ${row.voidReason}`));
      } else {
        box.append(make('span', '', 'Le service a confirmé l’opération. Le registre vient d’être actualisé avec les données enregistrées.'));
      }
      ui.receipt.replaceChildren(box);
      ui.receipt.hidden = false;
    }
    function extractRow(result) {
      const report = result?.report;
      if (!report?.id || !report.from || !report.to || !Number.isSafeInteger(report.amountFcfa)) {
        throw new Error('Confirmation du serveur incomplète. Consultez le registre avant toute nouvelle saisie.');
      }
      return report;
    }
    function fail(error, operation) {
      if (error && error.status === 401) {
        lock();
        return;
      }
      if (error && error.status === 409 && operation === 'create') {
        feedback(`Conflit (409) : une déclaration active chevauche déjà tout ou partie de cette période. Choisissez une période sans chevauchement. ${error.message || ''}`.trim(), 'error');
      } else {
        feedback(error?.message || 'Le service est indisponible. Aucune modification n’a été confirmée.', 'error');
      }
    }
    async function load(page) {
      if (state.locked || typeof request !== 'function') return;
      const requestId = ++state.requestId;
      if (!state.from || !state.to) {
        const current = today();
        state.from = `${current.slice(0, 7)}-01`;
        state.to = current;
      }
      if (state.from > state.to) {
        setState('Période invalide', 'La date de début doit précéder ou être égale à la date de fin.', true);
        return;
      }
      state.page = Number(page) || state.page || 1;
      updateExport();
      setState('Chargement des déclarations', 'Nous récupérons les données comptables enregistrées pour toutes les zones.');
      try {
        const result = await request(queryUrl(state.page));
        if (state.locked || requestId !== state.requestId) return;
        if (!result || result.ok !== true) throw new Error('Réponse du service invalide. Les données affichées ne sont pas remplacées.');
        render(result);
      } catch (error) {
        if (state.locked || requestId !== state.requestId) return;
        if (error?.status === 401) {
          lock();
          return;
        }
        setState(error?.status === 503 ? 'Service temporairement indisponible' : 'Déclarations indisponibles',
          error?.message || 'Impossible de charger les déclarations. Vos filtres sont conservés.', true, () => load(state.page));
      }
    }
    function onPeriodChange(period) {
      if (state.locked || !period) return;
      if (period.range) state.range = String(period.range);
      if (period.from && period.to) {
        state.from = String(period.from);
        state.to = String(period.to);
        state.page = 1;
        updateExport();
        if (active()) return load(1);
      }
      return undefined;
    }
    function localActivateReports() {
      if (typeof activateTab === 'function') {
        activateTab('reports');
        return;
      }
      document.querySelectorAll('[role="tab"][aria-selected]').forEach(tab => tab.setAttribute('aria-selected', String(tab === ui.tab)));
      document.querySelectorAll('.tab-panel').forEach(panel => { panel.hidden = panel !== ui.panel; });
      load(1);
    }
    function openCalendar() {
      if (state.locked) return;
      if (ui.year.options[0]?.value !== today().slice(0, 4)) buildCalendar();
      localActivateReports();
      if (ui.calendar) ui.calendar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (ui.month) ui.month.focus({ preventScroll: true });
    }
    function applyCalendar(monthOnly) {
      if (state.locked || !ui.year || !ui.month) return;
      const range = selectedRanges(monthOnly);
      if (typeof selectPeriod === 'function') {
        selectPeriod({ range: monthOnly ? 'calendar-month' : 'custom', from: range.from, to: range.to });
      }
    }
    function openCreateForm() {
      if (state.locked || state.busy) return;
      ui.createPanel.hidden = false;
      ui.voidPanel.hidden = true;
      const max = today();
      ui.createFrom.max = max;
      ui.createTo.max = max;
      ui.createFrom.min = '1999-01-01';
      ui.createTo.min = '1999-01-01';
      if (state.from) {
        ui.createFrom.value = state.from;
        ui.createTo.value = state.to;
      } else {
        ui.createFrom.value = `${max.slice(0, 7)}-01`;
        ui.createTo.value = max;
      }
      ui.createPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ui.createFrom.focus({ preventScroll: true });
    }
    function closeCreateForm() {
      if (state.busy) return;
      ui.createPanel.hidden = true;
      ui.createForm.reset();
    }
    function openVoidForm(row) {
      if (state.locked || state.busy || !row || row.voidedAt) return;
      state.voidId = row.id;
      ui.voidDescription.textContent = `Déclaration ${row.id == null ? '' : `n° ${row.id} · `}${fmtDate(row.from)} → ${fmtDate(row.to)} · ${money(row.amountFcfa)}. L’annulation conserve la déclaration et son motif dans l’historique.`;
      ui.voidReason.value = '';
      ui.voidPanel.hidden = false;
      ui.createPanel.hidden = true;
      ui.voidPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ui.voidReason.focus({ preventScroll: true });
    }
    function setBusy(busy, button) {
      state.busy = busy;
      if (button) {
        button.disabled = busy || state.locked;
        button.textContent = busy ? (button === ui.createSubmit ? 'Enregistrement…' : 'Annulation…') :
          (button === ui.createSubmit ? 'Enregistrer la déclaration' : 'Confirmer l’annulation');
      }
      if (ui.add) ui.add.disabled = busy || state.locked;
      if (ui.previous) ui.previous.disabled = busy || state.locked || state.page <= 1;
      if (ui.next) ui.next.disabled = busy || state.locked;
    }
    async function afterMutation() {
      if (typeof refreshDashboard === 'function') {
        try { await refreshDashboard(); } catch (_) { /* The report reload below remains required. */ }
      }
      if (!state.locked) await load(1);
    }
    async function createReport(event) {
      event.preventDefault();
      if (state.locked || state.busy || !ui.createForm.reportValidity()) return;
      const from = ui.createFrom.value;
      const to = ui.createTo.value;
      const amountFcfa = Number(ui.createAmount.value);
      const note = ui.createNote.value.trim();
      const maxDate = today();
      if (from < '1999-01-01' || to > maxDate || from > to || !Number.isInteger(amountFcfa) || amountFcfa < 0 || amountFcfa > 1000000000 || note.length < 5 || note.length > 500) {
        feedback('Vérifiez les dates (1999 à aujourd’hui), le montant entier (0 à 1 000 000 000 FCFA) et la source (5 à 500 caractères).', 'error');
        return;
      }
      state.busy = true;
      feedback('', '');
      clearReceipt();
      setBusy(true, ui.createSubmit);
      try {
        const result = await request(`${API}/reports`, {
          method: 'POST',
          body: JSON.stringify({ from, to, amountFcfa, note })
        });
        if (state.locked) return;
        const saved = extractRow(result);
        renderReceipt(saved, 'create');
        feedback('Enregistrement confirmé par le service. Le reçu et le registre affichent les données enregistrées.', 'success');
        ui.createPanel.hidden = true;
        ui.createForm.reset();
        await afterMutation();
      } catch (error) {
        fail(error, 'create');
      } finally {
        if (!state.locked) setBusy(false, ui.createSubmit);
      }
    }
    async function voidReport(event) {
      event.preventDefault();
      if (state.locked || state.busy || !ui.voidForm.reportValidity()) return;
      const reason = ui.voidReason.value.trim();
      if (reason.length < 5 || reason.length > 500) {
        feedback('Le motif d’annulation doit contenir de 5 à 500 caractères.', 'error');
        return;
      }
      const prompt = `Confirmer l’annulation comptable de la déclaration ${state.voidId} ? Le montant sera exclu, mais l’enregistrement et le motif resteront dans l’historique.`;
      if (!window.confirm(prompt)) return;
      state.busy = true;
      feedback('', '');
      clearReceipt();
      setBusy(true, ui.voidSubmit);
      try {
        const result = await request(`${API}/reports/${encodeURIComponent(state.voidId)}/void`, {
          method: 'POST',
          body: JSON.stringify({ reason })
        });
        if (state.locked) return;
        const saved = extractRow(result);
        renderReceipt(saved, 'void');
        feedback('Annulation comptable confirmée par le service. La déclaration reste conservée pour audit.', 'success');
        ui.voidPanel.hidden = true;
        ui.voidForm.reset();
        state.voidId = null;
        await afterMutation();
      } catch (error) {
        fail(error, 'void');
      } finally {
        if (!state.locked) setBusy(false, ui.voidSubmit);
      }
    }
    function lock() {
      state.locked = true;
      state.requestId += 1;
      state.busy = false;
      state.from = '';
      state.to = '';
      state.range = '';
      state.page = 1;
      state.total = 0;
      state.rows = [];
      state.voidId = null;
      document.querySelectorAll('#tab-reports, #panel-reports button, #panel-reports input, #panel-reports select, #panel-reports textarea, #panel-reports a, #open-global-reports').forEach(control => {
        if ('disabled' in control) control.disabled = true;
        if (control.tagName === 'A') control.removeAttribute('href');
      });
      if (ui.body) ui.body.replaceChildren();
      if (ui.chart) ui.chart.replaceChildren();
      if (ui.chartTableBody) ui.chartTableBody.replaceChildren();
      if (ui.chartTable) ui.chartTable.hidden = true;
      if (ui.listWrap) ui.listWrap.hidden = true;
      if (ui.pagination) ui.pagination.hidden = true;
      if (ui.createForm) ui.createForm.reset();
      if (ui.voidForm) ui.voidForm.reset();
      if (ui.createPanel) ui.createPanel.hidden = true;
      if (ui.voidPanel) ui.voidPanel.hidden = true;
      clearReceipt();
      setText(ui.total, '—');
      setText(ui.coverage, '—');
      setText(ui.selectedDays, '—');
      setText(ui.average, '—');
      setText(ui.partialCount, '—');
      setText(ui.totalCount, '');
      setText(ui.pageLabel, '');
      setText(ui.chartCap, '');
      feedback('', '');
      setState('Session expirée', 'Reconnectez-vous pour consulter les déclarations globales.', true);
    }

    buildCalendar();
    ui.applyMonth?.addEventListener('click', () => applyCalendar(true));
    ui.applyYear?.addEventListener('click', () => applyCalendar(false));
    ui.add?.addEventListener('click', openCreateForm);
    ui.createClose?.addEventListener('click', closeCreateForm);
    ui.createForm?.addEventListener('submit', createReport);
    ui.voidClose?.addEventListener('click', () => {
      if (state.busy) return;
      ui.voidPanel.hidden = true;
      ui.voidForm.reset();
      state.voidId = null;
    });
    ui.voidForm?.addEventListener('submit', voidReport);
    ui.previous?.addEventListener('click', () => { if (!state.locked && state.page > 1) load(state.page - 1); });
    ui.next?.addEventListener('click', () => {
      const pageCount = Math.ceil(state.total / state.pageSize);
      if (!state.locked && state.page < pageCount) load(state.page + 1);
    });
    $('open-global-reports')?.addEventListener('click', () => localActivateReports());

    return { load, onPeriodChange, lock, openCalendar };
  }

  window.WifiBusinessHistory = { init };
})();
