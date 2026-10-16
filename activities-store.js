'use strict';

const TYPES = new Set(['page_view', 'service_view', 'finance_open', 'finance_category', 'external_click', 'action', 'click']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RETENTION_DAYS = 90;
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

async function initialize(pool) {
  // Additive only: never recreates the database or changes products/prices.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_sessions (
      session_id UUID PRIMARY KEY, visitor_id UUID NOT NULL,
      country VARCHAR(2), device VARCHAR(10) NOT NULL,
      browser VARCHAR(24) NOT NULL, os VARCHAR(20) NOT NULL,
      first_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id BIGSERIAL PRIMARY KEY, event_id UUID UNIQUE NOT NULL,
      session_id UUID NOT NULL REFERENCES activity_sessions(session_id) ON DELETE CASCADE,
      type VARCHAR(24) NOT NULL, page VARCHAR(120) NOT NULL,
      service VARCHAR(80) NOT NULL DEFAULT '',
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS activity_events_time_idx ON activity_events(occurred_at);
    CREATE INDEX IF NOT EXISTS activity_events_session_idx ON activity_events(session_id, occurred_at, id);
    CREATE INDEX IF NOT EXISTS activity_events_service_idx ON activity_events(service, occurred_at);
    CREATE INDEX IF NOT EXISTS activity_sessions_visitor_idx ON activity_sessions(visitor_id);
    CREATE INDEX IF NOT EXISTS activity_sessions_last_idx ON activity_sessions(last_at);
  `);
}

async function cleanup(pool) {
  // Only newly introduced analytics records are eligible for the 90-day retention.
  await pool.query("DELETE FROM activity_events WHERE occurred_at < NOW() - INTERVAL '90 days'");
  await pool.query(`DELETE FROM activity_sessions s WHERE last_at < NOW() - INTERVAL '90 days'
    AND NOT EXISTS (SELECT 1 FROM activity_events e WHERE e.session_id=s.session_id)`);
}

function metadata(req) {
  const ua = String(req.get('user-agent') || '').slice(0, 500);
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet' : /Mobile|iPhone|Android/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Autre';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Autre';
  // Enable only for a geo header overwritten by a trusted deployment proxy.
  // No IP lookup, third-party geolocation, browser location or country guessing.
  const header = process.env.ANALYTICS_COUNTRY_HEADER;
  const candidate = header ? String(req.get(header) || '').toUpperCase() : '';
  const country = /^[A-Z]{2}$/.test(candidate) && candidate !== 'XX' ? candidate : null;
  return { device, browser, os, country };
}

function validateBatch(body, pages, services) {
  if (!body || !UUID.test(body.visitor) || !UUID.test(body.session) ||
      !Array.isArray(body.events) || !body.events.length || body.events.length > 20) {
    throw new Error('Activités invalides.');
  }
  return body.events.map(event => {
    if (!event || !UUID.test(event.id) || !TYPES.has(event.type) || !pages.has(event.page) ||
        typeof event.service !== 'string' || (event.service && !services.has(event.service))) {
      throw new Error('Activité non autorisée.');
    }
    // Only these allowlisted fields reach SQL. Never persist arbitrary metadata.
    return { id: event.id, type: event.type, page: event.page, service: event.service };
  });
}

async function record(pool, body, events, meta) {
  const inserted = await pool.query(`INSERT INTO activity_sessions
    (session_id,visitor_id,country,device,browser,os) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (session_id) DO UPDATE SET last_at=NOW()
    WHERE activity_sessions.visitor_id=EXCLUDED.visitor_id RETURNING session_id`,
  [body.session, body.visitor, meta.country, meta.device, meta.browser, meta.os]);
  if (!inserted.rowCount) throw new Error('Session invalide.');
  await pool.query(`INSERT INTO activity_events(event_id,session_id,type,page,service,occurred_at)
    SELECT (x.event->>'id')::uuid,$1::uuid,x.event->>'type',x.event->>'page',x.event->>'service',
      statement_timestamp()+(x.ordinality*INTERVAL '1 microsecond')
    FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS x(event,ordinality)
    ON CONFLICT (event_id) DO NOTHING`,
  [body.session, JSON.stringify(events)]);
}

function dateValue(value, fallback) {
  if (!value) return fallback;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Date invalide.');
  return value;
}

function filters(query) {
  const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  const from = dateValue(query.from, today), to = dateValue(query.to, today);
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) throw new Error('Période invalide (maximum 366 jours).');
  const values = [from, to], clauses = [
    "e.occurred_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Porto-Novo')",
    "e.occurred_at < (($2::date + 1)::timestamp AT TIME ZONE 'Africa/Porto-Novo')"
  ];
  const add = (sql, value) => { values.push(value); clauses.push(sql.replace('?', '$' + values.length)); };
  for (const [key, column] of Object.entries({country:'s.country',device:'s.device',type:'e.type',service:'e.service',visitor:'s.visitor_id::text',session:'e.session_id::text'})) {
    if (!query[key]) continue;
    if (typeof query[key] !== 'string' || query[key].length > 80) throw new Error('Filtre invalide.');
    if (key === 'type' && !TYPES.has(query[key])) throw new Error('Type invalide.');
    if (key === 'device' && !['mobile','tablet','desktop'].includes(query[key])) throw new Error('Appareil invalide.');
    add(`${column} = ?`, query[key]);
  }
  if (query.q) {
    if (typeof query.q !== 'string' || query.q.length > 100) throw new Error('Recherche trop longue.');
    values.push('%' + query.q.replace(/[\\%_]/g, '\\$&') + '%');
    const p = '$' + values.length;
    clauses.push(`(e.service ILIKE ${p} OR e.page ILIKE ${p} OR e.type ILIKE ${p}
      OR s.visitor_id::text ILIKE ${p} OR e.session_id::text ILIKE ${p}
      OR s.browser ILIKE ${p} OR s.os ILIKE ${p} OR s.country ILIKE ${p})`);
  }
  const page = Number(query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error('Page invalide.');
  return { where: clauses.join(' AND '), values, page };
}

const JOIN = 'FROM activity_events e JOIN activity_sessions s ON s.session_id=e.session_id';
const COLUMNS = 'e.id,e.session_id,e.occurred_at,e.type,e.page,e.service,s.visitor_id,s.country,s.device,s.browser,s.os';

async function report(pool, query) {
  const f = filters(query);
  const summaryResult = await pool.query(`SELECT COUNT(*)::int total, COUNT(DISTINCT s.visitor_id)::int visitors,
    COUNT(DISTINCT e.session_id)::int sessions,
    COUNT(*) FILTER (WHERE e.type='page_view')::int pages,
    COUNT(*) FILTER (WHERE e.type IN ('service_view','finance_open','finance_category'))::int services,
    COUNT(*) FILTER (WHERE e.type IN ('click','external_click','action'))::int clicks,
    COUNT(*) FILTER (WHERE e.type='external_click')::int external ${JOIN} WHERE ${f.where}`, f.values);
  const today = new Date(Date.now()+3600000).toISOString().slice(0,10);
  const tf = filters({...query,from:today,to:today});
  const todays = await pool.query(`SELECT COUNT(DISTINCT s.visitor_id)::int count ${JOIN} WHERE ${tf.where}`, tf.values);
  const result = await pool.query(`SELECT ${COLUMNS} ${JOIN} WHERE ${f.where}
    ORDER BY e.occurred_at DESC,e.id DESC LIMIT 50 OFFSET $${f.values.length+1}`, [...f.values,(f.page-1)*50]);
  const facets = await pool.query(`SELECT array_remove(array_agg(DISTINCT s.country),NULL) countries,
    array_remove(array_agg(DISTINCT NULLIF(e.service,'')),NULL) services ${JOIN} WHERE ${f.where}`,f.values);
  return {ok:true,summary:{...summaryResult.rows[0],todayVisitors:todays.rows[0].count},events:result.rows,
    total:summaryResult.rows[0].total,page:f.page,pageSize:50,facets:facets.rows[0],retentionDays:RETENTION_DAYS};
}

function csvCell(value) {
  let text = String(value == null ? '' : value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text; // spreadsheet formula injection
  return '"' + text.replace(/"/g,'""') + '"';
}

module.exports = { initialize,cleanup,metadata,validateBatch,record,filters,report,JOIN,COLUMNS,UUID,slug,csvCell,RETENTION_DAYS };
