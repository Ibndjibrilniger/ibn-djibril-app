'use strict';

const { periodRange, targetForPeriod, performance } = require('./wifi-business-periods');

const INITIAL_ZONES = [
  'LINK ZONE 2.1',
  'LINK ZONE 2.2',
  'LINK ZONE M.3',
  'LINK ZONE M.4',
  'LINK ZONE M.5',
  'LINK ZONE TARA',
  'LINK ZONE TARA 1.1',
  'LINK ZONE TARA M.1',
  'LINK ZONE TARA 2.2',
  'LINK ZONE TARA M.3',
  'LINK ZONE KONZA M.4',
  'LINK ZONE TARA M.5',
  'LINK ZONE TARA M.6',
  'LINK ZONE BIRNIN LAFIA 1.7',
  'LINK ZONE TONDI KOUARIA 1.8',
  'LINK ZONE KONZA M.9',
  'LINK ZONE',
  'LINK ZONE TARA 1.5'
];

const INITIAL_PLANS = [
  { code: '2h', label: '2 heures' },
  { code: '5h', label: '5 heures' },
  { code: '24h', label: '24 heures' },
  { code: '7d', label: '7 jours' },
  { code: '30d', label: '30 jours' }
];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS wifi_business_zones (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 100),
  seed_key TEXT,
  seed_order SMALLINT CHECK (seed_order IS NULL OR seed_order BETWEEN 1 AND 18),
  commercial_status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (commercial_status IN ('unconfirmed', 'active', 'inactive')),
  archived_at TIMESTAMPTZ,
  daily_target_fcfa BIGINT CHECK (daily_target_fcfa IS NULL OR daily_target_fcfa > 0),
  weekly_target_fcfa BIGINT CHECK (weekly_target_fcfa IS NULL OR weekly_target_fcfa > 0),
  monthly_target_fcfa BIGINT CHECK (monthly_target_fcfa IS NULL OR monthly_target_fcfa > 0),
  manual_performance_percent NUMERIC(5,2)
    CHECK (manual_performance_percent IS NULL OR manual_performance_percent BETWEEN 0 AND 100),
  manual_performance_kind TEXT
    CHECK (manual_performance_kind IS NULL OR manual_performance_kind IN ('demo', 'manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  CHECK ((manual_performance_percent IS NULL) = (manual_performance_kind IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS wifi_business_zones_name_unique
  ON wifi_business_zones ((lower(btrim(name))));
ALTER TABLE wifi_business_zones ADD COLUMN IF NOT EXISTS seed_key TEXT;
ALTER TABLE wifi_business_zones ADD COLUMN IF NOT EXISTS seed_order SMALLINT;
CREATE UNIQUE INDEX IF NOT EXISTS wifi_business_zones_seed_key_unique
  ON wifi_business_zones (seed_key) WHERE seed_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wifi_business_zones_seed_order_unique
  ON wifi_business_zones (seed_order) WHERE seed_order IS NOT NULL;

CREATE TABLE IF NOT EXISTS wifi_business_plans (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  price_fcfa BIGINT CHECK (price_fcfa IS NULL OR price_fcfa > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE IF NOT EXISTS wifi_business_sales (
  id BIGSERIAL PRIMARY KEY,
  zone_id BIGINT NOT NULL REFERENCES wifi_business_zones(id) ON DELETE RESTRICT,
  plan_code TEXT NOT NULL REFERENCES wifi_business_plans(code) ON DELETE RESTRICT,
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  ticket_count INTEGER NOT NULL DEFAULT 1 CHECK (ticket_count BETWEEN 1 AND 10000),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  replaces_sale_id BIGINT UNIQUE REFERENCES wifi_business_sales(id) ON DELETE RESTRICT,
  correction_reason TEXT,
  CHECK (
    (replaces_sale_id IS NULL AND correction_reason IS NULL) OR
    (replaces_sale_id IS NOT NULL AND length(btrim(correction_reason)) BETWEEN 5 AND 500)
  )
);

CREATE INDEX IF NOT EXISTS wifi_business_sales_sold_at_idx
  ON wifi_business_sales (sold_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS wifi_business_sales_zone_sold_at_idx
  ON wifi_business_sales (zone_id, sold_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS wifi_business_audit (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 60),
  entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 40),
  entity_id TEXT NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 100),
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 220),
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

CREATE INDEX IF NOT EXISTS wifi_business_audit_created_idx
  ON wifi_business_audit (created_at DESC, id DESC);

INSERT INTO wifi_business_zones (name, seed_key, seed_order, commercial_status)
VALUES ${INITIAL_ZONES.map((name, index) => `('${name.replaceAll("'", "''")}', '${name.replaceAll("'", "''")}', ${index + 1}, 'unconfirmed')`).join(',\n')}
ON CONFLICT DO NOTHING;

UPDATE wifi_business_zones
SET manual_performance_percent = 30,
    manual_performance_kind = 'demo',
    updated_at = statement_timestamp()
WHERE seed_key = 'LINK ZONE TARA 1.5'
  AND manual_performance_percent IS NULL
  AND manual_performance_kind IS NULL
  AND NOT EXISTS (SELECT 1 FROM wifi_business_sales);

INSERT INTO wifi_business_plans (code, label)
VALUES ${INITIAL_PLANS.map(plan => `('${plan.code}', '${plan.label}')`).join(',\n')}
ON CONFLICT (code) DO NOTHING;
`;

function asNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function currentStatus(row) {
  return row.archived_at ? 'archived' : row.commercial_status;
}

function trend(current, previous) {
  if (current === previous) return { trendPercent: 0, trendDirection: 'same' };
  if (previous === 0) return { trendPercent: null, trendDirection: current > 0 ? 'up' : 'down' };
  return {
    trendPercent: ((current - previous) / previous) * 100,
    trendDirection: current > previous ? 'up' : 'down'
  };
}

function mapZone(row, period) {
  const actualRevenue = asNumber(row.revenue_fcfa) || 0;
  const target = targetForPeriod({
    dailyTargetFcfa: asNumber(row.daily_target_fcfa),
    weeklyTargetFcfa: asNumber(row.weekly_target_fcfa),
    monthlyTargetFcfa: asNumber(row.monthly_target_fcfa)
  }, period);
  let source = 'no_goal';
  let calculated = null;
  if (target !== null && target > 0) {
    source = 'sales';
    calculated = performance(actualRevenue, target);
  } else if (row.manual_performance_percent !== null && row.manual_performance_percent !== undefined) {
    source = row.manual_performance_kind === 'demo' ? 'manual_demo' : 'manual';
    calculated = asNumber(row.manual_performance_percent);
  }

  const change = trend(actualRevenue, asNumber(row.previous_revenue_fcfa) || 0);
  return {
    id: String(row.id),
    name: row.name,
    status: currentStatus(row),
    archived: Boolean(row.archived_at),
    ticketsSold: asNumber(row.tickets_sold) || 0,
    revenueFcfa: actualRevenue,
    lastSaleAt: row.last_sale_at,
    targetFcfa: target,
    performancePercent: calculated,
    gaugePercent: calculated === null ? null : Math.min(100, calculated),
    performanceSource: source,
    demoLabel: source === 'manual_demo' ? 'Démonstration initiale — pas un résultat de ventes' : null,
    trendPercent: change.trendPercent,
    trendDirection: change.trendDirection,
    dailyTargetFcfa: asNumber(row.daily_target_fcfa),
    weeklyTargetFcfa: asNumber(row.weekly_target_fcfa),
    monthlyTargetFcfa: asNumber(row.monthly_target_fcfa),
    manualPerformance: asNumber(row.manual_performance_percent)
  };
}

function createStore(pool) {
  let initialized = null;

  async function ensure() {
    if (!process.env.DATABASE_URL) {
      throw Object.assign(new Error('La base de données Wi-Fi Business est indisponible.'), { status: 503 });
    }
    if (!initialized) {
      initialized = pool.query(SCHEMA_SQL).catch(error => {
        initialized = null;
        throw error;
      });
    }
    await initialized;
  }

  async function start() {
    if (!process.env.DATABASE_URL) return false;
    await ensure();
    return true;
  }

  function stop() {
    initialized = null;
  }

  async function listZones() {
    await ensure();
    const result = await pool.query(`
      SELECT id, name, commercial_status, archived_at, daily_target_fcfa,
        weekly_target_fcfa, monthly_target_fcfa, manual_performance_percent,
        manual_performance_kind, created_at, updated_at
      FROM wifi_business_zones
      ORDER BY COALESCE(seed_order, 32767), lower(name), id
    `);
    return result.rows.map(row => ({
      id: String(row.id),
      name: row.name,
      status: currentStatus(row),
      archived: Boolean(row.archived_at),
      dailyTargetFcfa: asNumber(row.daily_target_fcfa),
      weeklyTargetFcfa: asNumber(row.weekly_target_fcfa),
      monthlyTargetFcfa: asNumber(row.monthly_target_fcfa),
      manualPerformance: asNumber(row.manual_performance_percent),
      manualPerformanceKind: row.manual_performance_kind,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async function createZone(name) {
    await ensure();
    const result = await pool.query(`
      WITH inserted AS (
        INSERT INTO wifi_business_zones (name)
        VALUES ($1)
        ON CONFLICT DO NOTHING
        RETURNING *
      ), audit AS (
        INSERT INTO wifi_business_audit (action, entity_type, entity_id, summary, details)
        SELECT 'zone_created', 'zone', id::text, 'Zone ajoutée : ' || name,
          jsonb_build_object('name', name, 'status', commercial_status)
        FROM inserted
      )
      SELECT id, name, commercial_status, archived_at, daily_target_fcfa,
        weekly_target_fcfa, monthly_target_fcfa, manual_performance_percent,
        manual_performance_kind, created_at, updated_at
      FROM inserted
    `, [name]);
    return result.rows[0] || null;
  }

  async function updateZone(id, { name, status }) {
    await ensure();
    const result = await pool.query(`
      WITH previous AS (
        SELECT * FROM wifi_business_zones WHERE id = $1 FOR UPDATE
      ), updated AS (
        UPDATE wifi_business_zones AS zone
        SET name = $2,
            commercial_status = CASE WHEN $3 = 'archived' THEN previous.commercial_status ELSE $3 END,
            archived_at = CASE
              WHEN $3 = 'archived' THEN COALESCE(previous.archived_at, statement_timestamp())
              ELSE NULL
            END,
            updated_at = statement_timestamp()
        FROM previous
        WHERE zone.id = previous.id
          AND NOT EXISTS (
            SELECT 1 FROM wifi_business_zones AS duplicate
            WHERE duplicate.id <> previous.id
              AND lower(btrim(duplicate.name)) = lower(btrim($2))
          )
        RETURNING zone.*
      ), audit AS (
        INSERT INTO wifi_business_audit (action, entity_type, entity_id, summary, details)
        SELECT 'zone_updated', 'zone', updated.id::text,
          'Zone modifiée : ' || previous.name,
          jsonb_build_object(
            'before', jsonb_build_object('name', previous.name, 'status',
              CASE WHEN previous.archived_at IS NOT NULL THEN 'archived' ELSE previous.commercial_status END),
            'after', jsonb_build_object('name', updated.name, 'status',
              CASE WHEN updated.archived_at IS NOT NULL THEN 'archived' ELSE updated.commercial_status END)
          )
        FROM previous JOIN updated ON updated.id = previous.id
      )
      SELECT id, name, commercial_status, archived_at, daily_target_fcfa,
        weekly_target_fcfa, monthly_target_fcfa, manual_performance_percent,
        manual_performance_kind, created_at, updated_at
      FROM updated
    `, [id, name, status]);
    return result.rows[0] || null;
  }

  async function listPlans() {
    await ensure();
    const result = await pool.query(`
      SELECT code, label, price_fcfa, enabled, updated_at
      FROM wifi_business_plans ORDER BY
        CASE code WHEN '2h' THEN 1 WHEN '5h' THEN 2 WHEN '24h' THEN 3 WHEN '7d' THEN 4 WHEN '30d' THEN 5 ELSE 6 END
    `);
    return result.rows.map(row => ({
      code: row.code,
      label: row.label,
      priceFcfa: asNumber(row.price_fcfa),
      enabled: row.enabled,
      updatedAt: row.updated_at
    }));
  }

  async function updatePlan(code, { priceFcfa, enabled }) {
    await ensure();
    const result = await pool.query(`
      WITH previous AS (
        SELECT * FROM wifi_business_plans WHERE code = $1 FOR UPDATE
      ), updated AS (
        UPDATE wifi_business_plans AS plan
        SET price_fcfa = $2, enabled = $3, updated_at = statement_timestamp()
        FROM previous WHERE plan.code = previous.code
        RETURNING plan.*
      ), audit AS (
        INSERT INTO wifi_business_audit (action, entity_type, entity_id, summary, details)
        SELECT 'plan_updated', 'plan', updated.code,
          'Forfait modifié : ' || updated.label,
          jsonb_build_object(
            'before', jsonb_build_object('priceFcfa', previous.price_fcfa, 'enabled', previous.enabled),
            'after', jsonb_build_object('priceFcfa', updated.price_fcfa, 'enabled', updated.enabled)
          )
        FROM previous JOIN updated ON updated.code = previous.code
      )
      SELECT code, label, price_fcfa, enabled, updated_at FROM updated
    `, [code, priceFcfa, enabled]);
    return result.rows[0] ? {
      code: result.rows[0].code,
      label: result.rows[0].label,
      priceFcfa: asNumber(result.rows[0].price_fcfa),
      enabled: result.rows[0].enabled,
      updatedAt: result.rows[0].updated_at
    } : null;
  }

  async function updateTargets(id, targets) {
    await ensure();
    const result = await pool.query(`
      WITH previous AS (
        SELECT * FROM wifi_business_zones WHERE id = $1 FOR UPDATE
      ), updated AS (
        UPDATE wifi_business_zones AS zone
        SET daily_target_fcfa = $2,
            weekly_target_fcfa = $3,
            monthly_target_fcfa = $4,
            updated_at = statement_timestamp()
        FROM previous WHERE zone.id = previous.id
        RETURNING zone.*
      ), audit AS (
        INSERT INTO wifi_business_audit (action, entity_type, entity_id, summary, details)
        SELECT 'targets_updated', 'zone', updated.id::text,
          'Objectifs modifiés : ' || updated.name,
          jsonb_build_object(
            'before', jsonb_build_object('daily', previous.daily_target_fcfa,
              'weekly', previous.weekly_target_fcfa, 'monthly', previous.monthly_target_fcfa),
            'after', jsonb_build_object('daily', updated.daily_target_fcfa,
              'weekly', updated.weekly_target_fcfa, 'monthly', updated.monthly_target_fcfa)
          )
        FROM previous JOIN updated ON updated.id = previous.id
      )
      SELECT id, name, daily_target_fcfa, weekly_target_fcfa, monthly_target_fcfa
      FROM updated
    `, [id, targets.dailyTargetFcfa, targets.weeklyTargetFcfa, targets.monthlyTargetFcfa]);
    return result.rows[0] || null;
  }

  async function dashboard({ range, from, to, now } = {}) {
    await ensure();
    const period = periodRange({ range, from, to, now });
    const month = periodRange({ range: 'month', now });
    const [zoneResult, seriesResult, planRows, monthResult] = await Promise.all([
      pool.query(`
        WITH effective_sales AS (
          SELECT sale.*
          FROM wifi_business_sales AS sale
          WHERE NOT EXISTS (
            SELECT 1 FROM wifi_business_sales AS replacement
            WHERE replacement.replaces_sale_id = sale.id
          )
        ), current_totals AS (
          SELECT zone_id, COALESCE(SUM(amount_fcfa), 0) AS revenue_fcfa,
            COALESCE(SUM(ticket_count), 0) AS tickets_sold
          FROM effective_sales WHERE sold_at >= $1 AND sold_at < $2
          GROUP BY zone_id
        ), previous_totals AS (
          SELECT zone_id, COALESCE(SUM(amount_fcfa), 0) AS revenue_fcfa
          FROM effective_sales WHERE sold_at >= $3 AND sold_at < $4
          GROUP BY zone_id
        ), last_sales AS (
          SELECT zone_id, MAX(sold_at) AS last_sale_at FROM effective_sales GROUP BY zone_id
        )
        SELECT zone.id, zone.name, zone.commercial_status, zone.archived_at,
          zone.daily_target_fcfa, zone.weekly_target_fcfa, zone.monthly_target_fcfa,
          zone.manual_performance_percent, zone.manual_performance_kind,
          COALESCE(current.revenue_fcfa, 0)::bigint AS revenue_fcfa,
          COALESCE(current.tickets_sold, 0)::bigint AS tickets_sold,
          COALESCE(previous.revenue_fcfa, 0)::bigint AS previous_revenue_fcfa,
          last.last_sale_at
        FROM wifi_business_zones AS zone
        LEFT JOIN current_totals AS current ON current.zone_id = zone.id
        LEFT JOIN previous_totals AS previous ON previous.zone_id = zone.id
        LEFT JOIN last_sales AS last ON last.zone_id = zone.id
        ORDER BY zone.archived_at NULLS FIRST, COALESCE(zone.seed_order, 32767), lower(zone.name), zone.id
      `, [period.startAt, period.endAt, period.previousStartAt, period.previousEndAt]),
      pool.query(`
        WITH dates AS (
          SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
        ), effective_sales AS (
          SELECT sale.* FROM wifi_business_sales AS sale
          WHERE sale.sold_at >= $3 AND sale.sold_at < $4
            AND NOT EXISTS (
              SELECT 1 FROM wifi_business_sales AS replacement
              WHERE replacement.replaces_sale_id = sale.id
            )
        ), daily AS (
          SELECT (sold_at AT TIME ZONE 'Africa/Porto-Novo')::date AS day,
            SUM(amount_fcfa)::bigint AS revenue_fcfa, SUM(ticket_count)::bigint AS tickets_sold
          FROM effective_sales GROUP BY 1
        )
        SELECT dates.day::text AS date,
          COALESCE(daily.revenue_fcfa, 0)::bigint AS revenue_fcfa,
          COALESCE(daily.tickets_sold, 0)::bigint AS tickets_sold
        FROM dates LEFT JOIN daily USING(day) ORDER BY dates.day
      `, [period.from, period.to, period.startAt, period.endAt]),
      listPlans(),
      pool.query(`
        SELECT zone.id, zone.name, SUM(sale.amount_fcfa)::bigint AS revenue_fcfa
        FROM wifi_business_sales AS sale
        JOIN wifi_business_zones AS zone ON zone.id = sale.zone_id
        WHERE sale.sold_at >= $1 AND sale.sold_at < $2
          AND NOT EXISTS (
            SELECT 1 FROM wifi_business_sales AS replacement
            WHERE replacement.replaces_sale_id = sale.id
          )
        GROUP BY zone.id, zone.name
        HAVING SUM(sale.amount_fcfa) > 0
        ORDER BY SUM(sale.amount_fcfa) DESC, lower(zone.name), zone.id
        LIMIT 1
      `, [month.startAt, month.endAt])
    ]);

    const zones = zoneResult.rows.map(row => mapZone(row, period));
    const summaryTargets = zoneResult.rows.reduce((result, row) => {
      const zone = {
        dailyTargetFcfa: asNumber(row.daily_target_fcfa),
        weeklyTargetFcfa: asNumber(row.weekly_target_fcfa),
        monthlyTargetFcfa: asNumber(row.monthly_target_fcfa)
      };
      const target = targetForPeriod(zone, period);
      if (target !== null && target > 0) {
        result.revenue += asNumber(row.revenue_fcfa) || 0;
        result.target += target;
      }
      return result;
    }, { revenue: 0, target: 0 });
    const actualPerf = summaryTargets.target > 0
      ? performance(summaryTargets.revenue, summaryTargets.target)
      : null;
    const watchZones = zones.filter(zone => !zone.archived && zone.performanceSource === 'sales' &&
      zone.performancePercent !== null && zone.performancePercent < 40).length;

    return {
      ok: true,
      period: {
        from: period.from,
        to: period.to,
        previousFrom: period.previousFrom,
        previousTo: period.previousTo,
        range: period.range
      },
      summary: {
        zoneCount: zones.filter(zone => !zone.archived).length,
        ticketsSold: zones.reduce((total, zone) => total + zone.ticketsSold, 0),
        revenueFcfa: zones.reduce((total, zone) => total + zone.revenueFcfa, 0),
        todayRevenueFcfa: asNumber((await pool.query(`
          SELECT COALESCE(SUM(sale.amount_fcfa), 0)::bigint AS value
          FROM wifi_business_sales AS sale
          WHERE sale.sold_at >= $1 AND sale.sold_at < $2
            AND NOT EXISTS (
              SELECT 1 FROM wifi_business_sales AS replacement
              WHERE replacement.replaces_sale_id = sale.id
            )
        `, [
          periodRange({ range: 'today', now }).startAt,
          periodRange({ range: 'today', now }).endAt
        ])).rows[0].value) || 0,
        performancePercent: actualPerf,
        watchZones,
        bestMonthZone: monthResult.rows[0] ? {
          id: String(monthResult.rows[0].id),
          name: monthResult.rows[0].name,
          revenueFcfa: asNumber(monthResult.rows[0].revenue_fcfa)
        } : null
      },
      zones,
      series: seriesResult.rows.map(row => ({
        date: row.date,
        revenueFcfa: asNumber(row.revenue_fcfa) || 0,
        ticketsSold: asNumber(row.tickets_sold) || 0
      })),
      comparisons: zones.map(zone => ({
        name: zone.name,
        currentFcfa: zone.revenueFcfa,
        previousFcfa: asNumber(zoneResult.rows.find(row => String(row.id) === zone.id)?.previous_revenue_fcfa) || 0
      })),
      plans: planRows
    };
  }

  async function listSales({ period, zoneId, page = 1 }) {
    await ensure();
    const offset = (page - 1) * 50;
    const result = await pool.query(`
      SELECT sale.id, sale.zone_id, zone.name AS zone_name,
        sale.plan_code, plan.label AS plan_label, sale.amount_fcfa,
        sale.ticket_count, sale.sold_at, sale.created_at,
        sale.replaces_sale_id, sale.correction_reason,
        EXISTS (SELECT 1 FROM wifi_business_sales replacement WHERE replacement.replaces_sale_id = sale.id) AS corrected,
        COALESCE((SELECT replacement.correction_reason FROM wifi_business_sales replacement
          WHERE replacement.replaces_sale_id = sale.id LIMIT 1), sale.correction_reason) AS history_reason,
        COUNT(*) OVER()::int AS total
      FROM wifi_business_sales AS sale
      JOIN wifi_business_zones AS zone ON zone.id = sale.zone_id
      JOIN wifi_business_plans AS plan ON plan.code = sale.plan_code
      WHERE sale.sold_at >= $1 AND sale.sold_at < $2
        AND ($3::bigint IS NULL OR sale.zone_id = $3)
      ORDER BY sale.sold_at DESC, sale.id DESC
      LIMIT 50 OFFSET $4
    `, [period.startAt, period.endAt, zoneId || null, offset]);
    return {
      ok: true,
      rows: result.rows.map(row => ({
        id: String(row.id),
        zoneId: String(row.zone_id),
        zoneName: row.zone_name,
        planCode: row.plan_code,
        planLabel: row.plan_label,
        amountFcfa: asNumber(row.amount_fcfa),
        ticketCount: asNumber(row.ticket_count),
        soldAt: row.sold_at,
        createdAt: row.created_at,
        replacesSaleId: row.replaces_sale_id === null ? null : String(row.replaces_sale_id),
        corrected: row.corrected,
        correctionReason: row.history_reason
      })),
      total: Number(result.rows[0]?.total || 0),
      page,
      pageSize: 50
    };
  }

  async function listAudit({ period, page = 1 }) {
    await ensure();
    const result = await pool.query(`
      SELECT id, action, entity_type, entity_id, summary, reason, details, created_at,
        COUNT(*) OVER()::int AS total
      FROM wifi_business_audit
      WHERE created_at >= $1 AND created_at < $2
      ORDER BY created_at DESC, id DESC
      LIMIT 50 OFFSET $3
    `, [period.startAt, period.endAt, (page - 1) * 50]);
    return {
      ok: true,
      rows: result.rows.map(row => ({
        id: String(row.id),
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        summary: row.summary,
        reason: row.reason,
        details: row.details,
        createdAt: row.created_at
      })),
      total: Number(result.rows[0]?.total || 0),
      page,
      pageSize: 50
    };
  }

  async function createSale({ zoneId, planCode, amountFcfa, ticketCount, soldAt }) {
    await ensure();
    const result = await pool.query(`
      WITH eligible_zone AS (
        SELECT id FROM wifi_business_zones
        WHERE id = $1 AND archived_at IS NULL AND commercial_status = 'active'
      ), eligible_plan AS (
        SELECT code FROM wifi_business_plans WHERE code = $2 AND enabled = TRUE
      ), inserted AS (
        INSERT INTO wifi_business_sales (zone_id, plan_code, amount_fcfa, ticket_count, sold_at)
        SELECT eligible_zone.id, eligible_plan.code, $3, $4, COALESCE($5::timestamptz, statement_timestamp())
        FROM eligible_zone CROSS JOIN eligible_plan
        RETURNING *
      ), audit AS (
        INSERT INTO wifi_business_audit (action, entity_type, entity_id, summary, details)
        SELECT 'sale_created', 'sale', inserted.id::text,
          'Vente enregistrée — ' || zone.name,
          jsonb_build_object('zoneId', inserted.zone_id, 'planCode', inserted.plan_code,
            'amountFcfa', inserted.amount_fcfa, 'ticketCount', inserted.ticket_count,
            'soldAt', inserted.sold_at)
        FROM inserted JOIN wifi_business_zones zone ON zone.id = inserted.zone_id
      )
      SELECT * FROM inserted
    `, [zoneId, planCode, amountFcfa, ticketCount, soldAt || null]);
    return result.rows[0] || null;
  }

  async function correctSale(id, { zoneId, planCode, amountFcfa, ticketCount, soldAt, reason }) {
    await ensure();
    const result = await pool.query(`
      WITH original AS (
        SELECT sale.* FROM wifi_business_sales AS sale
        WHERE sale.id = $1
          AND NOT EXISTS (
            SELECT 1 FROM wifi_business_sales AS replacement WHERE replacement.replaces_sale_id = sale.id
          )
        FOR UPDATE OF sale
      ), eligible_zone AS (
        SELECT zone.id FROM wifi_business_zones AS zone
        WHERE zone.id = $2
          AND (zone.id = (SELECT zone_id FROM original) OR
            (zone.archived_at IS NULL AND zone.commercial_status = 'active'))
      ), known_plan AS (
        SELECT code FROM wifi_business_plans WHERE code = $3
      ), inserted AS (
        INSERT INTO wifi_business_sales
          (zone_id, plan_code, amount_fcfa, ticket_count, sold_at, replaces_sale_id, correction_reason)
        SELECT zone.id, plan.code, $4, $5,
          COALESCE($6::timestamptz, original.sold_at), original.id, $7
        FROM original CROSS JOIN eligible_zone AS zone CROSS JOIN known_plan AS plan
        RETURNING *
      ), audit AS (
        INSERT INTO wifi_business_audit (action, entity_type, entity_id, summary, reason, details)
        SELECT 'sale_corrected', 'sale', inserted.replaces_sale_id::text,
          'Vente corrigée — ' || zone.name, inserted.correction_reason,
          jsonb_build_object(
            'previousSaleId', inserted.replaces_sale_id,
            'replacementSaleId', inserted.id,
            'amountFcfa', inserted.amount_fcfa,
            'ticketCount', inserted.ticket_count,
            'soldAt', inserted.sold_at
          )
        FROM inserted JOIN wifi_business_zones zone ON zone.id = inserted.zone_id
      )
      SELECT * FROM inserted
    `, [id, zoneId, planCode, amountFcfa, ticketCount, soldAt || null, reason]);
    return result.rows[0] || null;
  }

  async function exportSales(period) {
    await ensure();
    const result = await pool.query(`
      SELECT sale.id, sale.sold_at, zone.name AS zone_name, plan.label AS plan_label,
        sale.amount_fcfa, sale.ticket_count, sale.replaces_sale_id, sale.correction_reason,
        EXISTS (SELECT 1 FROM wifi_business_sales replacement WHERE replacement.replaces_sale_id = sale.id) AS corrected
      FROM wifi_business_sales AS sale
      JOIN wifi_business_zones AS zone ON zone.id = sale.zone_id
      JOIN wifi_business_plans AS plan ON plan.code = sale.plan_code
      WHERE sale.sold_at >= $1 AND sale.sold_at < $2
        AND NOT EXISTS (
          SELECT 1 FROM wifi_business_sales replacement WHERE replacement.replaces_sale_id = sale.id
        )
      ORDER BY sale.sold_at DESC, sale.id DESC
      LIMIT 50001
    `, [period.startAt, period.endAt]);
    if (result.rows.length > 50000) {
      throw Object.assign(new Error('Réduisez la période : l’export dépasse 50 000 lignes.'), { status: 413 });
    }
    return result.rows;
  }

  return {
    start,
    stop,
    ensure,
    listZones,
    createZone,
    updateZone,
    listPlans,
    updatePlan,
    updateTargets,
    dashboard,
    listSales,
    listAudit,
    createSale,
    correctSale,
    exportSales
  };
}

module.exports = {
  createStore,
  INITIAL_ZONES,
  INITIAL_PLANS,
  SCHEMA_SQL,
  mapZone
};
