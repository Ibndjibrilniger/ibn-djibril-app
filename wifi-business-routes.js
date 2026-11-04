'use strict';

const path = require('node:path');
const { createStore } = require('./wifi-business-store');
const { periodRange, isDateKey } = require('./wifi-business-periods');

const MAX_AMOUNT_FCFA = 1_000_000_000;
const PAGE_SIZE = 50;

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function positiveInteger(value, label, { max = MAX_AMOUNT_FCFA } = {}) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > max) {
    throw Object.assign(new Error(`${label} doit être un entier positif valide.`), { status: 400 });
  }
  return value;
}

function nullableTarget(value, label) {
  if (value === null) return null;
  return positiveInteger(value, label);
}

function routeId(value, label = 'Identifiant') {
  if (!/^[1-9]\d{0,17}$/.test(String(value))) {
    throw Object.assign(new Error(`${label} invalide.`), { status: 400 });
  }
  return String(value);
}

function pageNumber(value) {
  if (value === undefined) return 1;
  if (!/^[1-9]\d{0,5}$/.test(String(value)) || Number(value) > 100000) {
    throw Object.assign(new Error('Numéro de page invalide.'), { status: 400 });
  }
  return Number(value);
}

function queryString(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw Object.assign(new Error(`${label} invalide.`), { status: 400 });
  return value;
}

function requestedPeriod(query) {
  const range = queryString(query.range, 'Période');
  const from = queryString(query.from, 'Date de début');
  const to = queryString(query.to, 'Date de fin');
  if (range) return periodRange({ range, from, to });
  if (from !== undefined || to !== undefined) return periodRange({ range: 'custom', from, to });
  return periodRange({ range: 'today' });
}

function timestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 40) {
    throw Object.assign(new Error('Date de vente invalide.'), { status: 400 });
  }
  let parsed;
  const localMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (localMatch) {
    if (!isDateKey(localMatch[1]) || Number(localMatch[2]) > 23 || Number(localMatch[3]) > 59) {
      throw Object.assign(new Error('Date de vente invalide.'), { status: 400 });
    }
    parsed = new Date(`${value}:00+01:00`);
  } else {
    const isoMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
    if (!isoMatch || !isDateKey(isoMatch[1]) || Number(isoMatch[2]) > 23 ||
      Number(isoMatch[3]) > 59 || Number(isoMatch[4]) > 59 ||
      (isoMatch[6] && (Number(isoMatch[7]) > 23 || Number(isoMatch[8]) > 59))) {
      throw Object.assign(new Error('Date de vente invalide.'), { status: 400 });
    }
    parsed = new Date(value);
  }
  if (!parsed || Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error('Date de vente invalide.'), { status: 400 });
  }
  if (parsed.getTime() > Date.now() + 5 * 60 * 1000) {
    throw Object.assign(new Error('La date de vente ne peut pas être dans le futur.'), { status: 400 });
  }
  return parsed.toISOString();
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function sendError(res, error) {
  const duplicate = error?.code === '23505';
  const constraint = ['23514', '22001', '22003', '22P02'].includes(error?.code);
  const foreignKey = error?.code === '23503';
  const status = Number(error?.status) || (duplicate || foreignKey ? 409 : constraint ? 400 : 500);
  if (status >= 500) {
    console.error('WIFI_BUSINESS_API_ERROR', error?.code || 'unexpected');
  }
  const message = error?.status && status < 500
    ? error.message
    : duplicate ? 'Ce nom de zone ou cette correction existe déjà.'
      : foreignKey ? 'La zone ou l’offre sélectionnée n’est plus disponible.'
        : constraint ? 'Les valeurs saisies ne sont pas valides.'
          : status === 503 ? 'Le stockage PostgreSQL est indisponible.'
            : status === 413 ? error.message
              : status === 500 ? 'Impossible de traiter cette demande.' : error.message;
  res.status(status).json({ ok: false, error: message });
}

module.exports = function registerWifiBusinessRoutes(app, requireAdmin, pool) {
  const store = createStore(pool);
  const adminDir = path.join(__dirname, 'admin', 'wifi-business');
  const api = '/api/admin/wifi-business';

  function privateHeaders(req, res, next) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    next();
  }

  app.get('/admin/wifi-business', privateHeaders, requireAdmin, (req, res) => {
    res.sendFile(path.join(adminDir, 'index.html'));
  });
  app.get('/admin/wifi-business/wifi-business.css', privateHeaders, requireAdmin, (req, res) => {
    res.type('text/css').sendFile(path.join(adminDir, 'wifi-business.css'));
  });
  app.get('/admin/wifi-business/wifi-business.js', privateHeaders, requireAdmin, (req, res) => {
    res.type('application/javascript').sendFile(path.join(adminDir, 'wifi-business.js'));
  });

  app.use(api, privateHeaders);
  app.use(api, requireAdmin);
  app.use(api, (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (parsed.host !== req.get('host') || !['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(403).json({ ok: false, error: 'Origine de requête refusée.' });
        }
      } catch (_) {
        return res.status(403).json({ ok: false, error: 'Origine de requête refusée.' });
      }
    }
    if (req.get('sec-fetch-site') === 'cross-site') {
      return res.status(403).json({ ok: false, error: 'Requête intersite refusée.' });
    }
    next();
  });

  const asyncRoute = handler => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

  app.get(`${api}/dashboard`, asyncRoute(async (req, res) => {
    const period = requestedPeriod(req.query);
    const result = await store.dashboard({
      range: period.range,
      from: period.from,
      to: period.to
    });
    res.json(result);
  }));

  app.get(`${api}/zones`, asyncRoute(async (req, res) => {
    res.json({ ok: true, zones: await store.listZones() });
  }));

  app.post(`${api}/zones`, asyncRoute(async (req, res) => {
    if (!isRecord(req.body) || typeof req.body.name !== 'string') {
      throw Object.assign(new Error('Nom de zone requis.'), { status: 400 });
    }
    const name = req.body.name.trim();
    if (name.length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw Object.assign(new Error('Le nom doit contenir entre 2 et 100 caractères.'), { status: 400 });
    }
    const row = await store.createZone(name);
    if (!row) return res.status(409).json({ ok: false, error: 'Une zone porte déjà ce nom.' });
    res.status(201).json({ ok: true, zone: {
      id: String(row.id), name: row.name, status: row.commercial_status,
      archived: Boolean(row.archived_at)
    } });
  }));

  app.patch(`${api}/zones/:id`, asyncRoute(async (req, res) => {
    const id = routeId(req.params.id, 'Zone');
    if (!isRecord(req.body)) throw Object.assign(new Error('Données de zone invalides.'), { status: 400 });
    const zones = await store.listZones();
    const existing = zones.find(zone => zone.id === id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Zone introuvable.' });
    const name = req.body.name === undefined ? existing.name : req.body.name;
    const status = req.body.status === undefined ? existing.status : req.body.status;
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100 ||
      /[\u0000-\u001f\u007f]/.test(name)) {
      throw Object.assign(new Error('Le nom doit contenir entre 2 et 100 caractères.'), { status: 400 });
    }
    if (!['unconfirmed', 'active', 'inactive', 'archived'].includes(status)) {
      throw Object.assign(new Error('Statut commercial invalide.'), { status: 400 });
    }
    const row = await store.updateZone(id, { name: name.trim(), status });
    if (!row) return res.status(409).json({ ok: false, error: 'Une zone porte déjà ce nom.' });
    res.json({ ok: true, zone: {
      id: String(row.id), name: row.name,
      status: row.archived_at ? 'archived' : row.commercial_status,
      archived: Boolean(row.archived_at)
    } });
  }));

  app.put(`${api}/zones/:id/targets`, asyncRoute(async (req, res) => {
    const id = routeId(req.params.id, 'Zone');
    if (!isRecord(req.body)) throw Object.assign(new Error('Objectifs invalides.'), { status: 400 });
    const targets = {
      dailyTargetFcfa: nullableTarget(req.body.dailyTargetFcfa, 'Objectif journalier'),
      weeklyTargetFcfa: nullableTarget(req.body.weeklyTargetFcfa, 'Objectif hebdomadaire'),
      monthlyTargetFcfa: nullableTarget(req.body.monthlyTargetFcfa, 'Objectif mensuel')
    };
    const row = await store.updateTargets(id, targets);
    if (!row) return res.status(404).json({ ok: false, error: 'Zone introuvable.' });
    res.json({ ok: true, targets: {
      zoneId: String(row.id),
      dailyTargetFcfa: row.daily_target_fcfa === null ? null : Number(row.daily_target_fcfa),
      weeklyTargetFcfa: row.weekly_target_fcfa === null ? null : Number(row.weekly_target_fcfa),
      monthlyTargetFcfa: row.monthly_target_fcfa === null ? null : Number(row.monthly_target_fcfa)
    } });
  }));

  app.get(`${api}/plans`, asyncRoute(async (req, res) => {
    res.json({ ok: true, plans: await store.listPlans() });
  }));

  app.patch(`${api}/plans/:code`, asyncRoute(async (req, res) => {
    if (!isRecord(req.body) || !/^(2h|5h|24h|7d|30d)$/.test(req.params.code)) {
      throw Object.assign(new Error('Offre ou données invalides.'), { status: 400 });
    }
    const plans = await store.listPlans();
    const existing = plans.find(plan => plan.code === req.params.code);
    if (!existing) return res.status(404).json({ ok: false, error: 'Offre introuvable.' });
    const priceFcfa = req.body.priceFcfa === undefined
      ? existing.priceFcfa
      : req.body.priceFcfa === null ? null : positiveInteger(req.body.priceFcfa, 'Prix du forfait');
    const enabled = req.body.enabled === undefined ? existing.enabled : req.body.enabled;
    if (typeof enabled !== 'boolean') {
      throw Object.assign(new Error('Disponibilité de l’offre invalide.'), { status: 400 });
    }
    const plan = await store.updatePlan(req.params.code, { priceFcfa, enabled });
    if (!plan) return res.status(404).json({ ok: false, error: 'Offre introuvable.' });
    res.json({ ok: true, plan });
  }));

  app.get(`${api}/sales`, asyncRoute(async (req, res) => {
    const period = requestedPeriod(req.query);
    const page = pageNumber(req.query.page);
    const zoneId = req.query.zoneId === undefined ? null : routeId(queryString(req.query.zoneId, 'Zone'), 'Zone');
    res.json(await store.listSales({ period, zoneId, page }));
  }));

  app.post(`${api}/sales`, asyncRoute(async (req, res) => {
    if (!isRecord(req.body)) throw Object.assign(new Error('Données de vente invalides.'), { status: 400 });
    const zoneId = routeId(req.body.zoneId, 'Zone');
    if (typeof req.body.planCode !== 'string' || !/^(2h|5h|24h|7d|30d)$/.test(req.body.planCode)) {
      throw Object.assign(new Error('Choisissez une offre disponible.'), { status: 400 });
    }
    const payload = {
      zoneId,
      planCode: req.body.planCode,
      amountFcfa: positiveInteger(req.body.amountFcfa, 'Montant'),
      ticketCount: req.body.ticketCount === undefined
        ? 1 : positiveInteger(req.body.ticketCount, 'Nombre de tickets', { max: 10000 }),
      soldAt: timestamp(req.body.soldAt)
    };
    const row = await store.createSale(payload);
    if (!row) {
      return res.status(409).json({ ok: false, error: 'La zone doit être déclarée active et le forfait disponible avant la saisie.' });
    }
    res.status(201).json({ ok: true, sale: { id: String(row.id), soldAt: row.sold_at } });
  }));

  app.post(`${api}/sales/:id/correct`, asyncRoute(async (req, res) => {
    const id = routeId(req.params.id, 'Vente');
    if (!isRecord(req.body)) throw Object.assign(new Error('Données de correction invalides.'), { status: 400 });
    const zoneId = routeId(req.body.zoneId, 'Zone');
    if (typeof req.body.planCode !== 'string' || !/^(2h|5h|24h|7d|30d)$/.test(req.body.planCode)) {
      throw Object.assign(new Error('Choisissez une offre valide.'), { status: 400 });
    }
    if (typeof req.body.reason !== 'string' || req.body.reason.trim().length < 5 || req.body.reason.trim().length > 500) {
      throw Object.assign(new Error('Un motif de correction de 5 à 500 caractères est obligatoire.'), { status: 400 });
    }
    const payload = {
      zoneId,
      planCode: req.body.planCode,
      amountFcfa: positiveInteger(req.body.amountFcfa, 'Montant'),
      ticketCount: req.body.ticketCount === undefined
        ? 1 : positiveInteger(req.body.ticketCount, 'Nombre de tickets', { max: 10000 }),
      soldAt: timestamp(req.body.soldAt),
      reason: req.body.reason.trim()
    };
    const row = await store.correctSale(id, payload);
    if (!row) {
      return res.status(409).json({ ok: false, error: 'Cette vente a déjà été remplacée, ou la zone ou l’offre n’est plus disponible.' });
    }
    res.status(201).json({ ok: true, sale: { id: String(row.id), replacesSaleId: String(row.replaces_sale_id) } });
  }));

  app.get(`${api}/audit`, asyncRoute(async (req, res) => {
    const period = requestedPeriod(req.query);
    res.json(await store.listAudit({ period, page: pageNumber(req.query.page) }));
  }));

  app.get(`${api}/export.csv`, asyncRoute(async (req, res) => {
    const period = requestedPeriod(req.query);
    const rows = await store.exportSales(period);
    const lines = [
      ['ID vente', 'Date de vente', 'Zone', 'Offre', 'Montant FCFA', 'Tickets', 'Correction ajoutée', 'Remplace la vente', 'Motif'].map(csvCell).join(',')
    ];
    for (const row of rows) {
      lines.push([
        row.id, row.sold_at?.toISOString?.() || row.sold_at, row.zone_name,
        row.plan_label, row.amount_fcfa, row.ticket_count,
        row.replaces_sale_id !== null ? 'oui' : row.corrected ? 'remplacée' : 'non',
        row.replaces_sale_id, row.correction_reason
      ].map(csvCell).join(','));
    }
    res.status(200).type('text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="wifi-business-${period.from}-${period.to}.csv"`)
      .send(`\uFEFF${lines.join('\r\n')}`);
  }));

  app.use(api, (error, req, res, next) => {
    if (res.headersSent) return next(error);
    sendError(res, error);
  });

  return {
    store,
    start: () => store.start(),
    stop: () => store.stop()
  };
};

module.exports._test = { timestamp, csvCell, requestedPeriod, isDateKey, PAGE_SIZE };
