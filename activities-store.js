'use strict';

const { metadata, SOURCES } = require('./activity-metadata');
const TYPES = new Set(['page_view', 'service_view', 'finance_open', 'finance_category', 'external_click', 'action', 'click', 'heartbeat']);
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
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS brand VARCHAR(80);
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS model VARCHAR(80);
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS os_version VARCHAR(40);
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS browser_version VARCHAR(24);
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(35);
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS region VARCHAR(80);
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS city VARCHAR(80);
    ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS source VARCHAR(20);
  `);
}

async function cleanup(pool) {
  // Only newly introduced analytics records are eligible for the 90-day retention.
  await pool.query("DELETE FROM activity_events WHERE occurred_at < NOW() - INTERVAL '90 days'");
  await pool.query(`DELETE FROM activity_sessions s WHERE last_at < NOW() - INTERVAL '90 days'
    AND NOT EXISTS (SELECT 1 FROM activity_events e WHERE e.session_id=s.session_id)`);
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
  const source = SOURCES.has(body.source) ? body.source : null;
  const inserted = await pool.query(`INSERT INTO activity_sessions
    (session_id,visitor_id,country,device,browser,os,brand,model,os_version,browser_version,language,region,city,source)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (session_id) DO UPDATE SET session_id=EXCLUDED.session_id
    WHERE activity_sessions.visitor_id=EXCLUDED.visitor_id RETURNING session_id`,
  [body.session, body.visitor, meta.country, meta.device, meta.browser, meta.os,
    meta.brand,meta.model,meta.os_version,meta.browser_version,meta.language,meta.region,meta.city,source]);
  if (!inserted.rowCount) throw new Error('Session invalide.');
  await pool.query(`WITH recorded AS (INSERT INTO activity_events(event_id,session_id,type,page,service,occurred_at)
    SELECT (x.event->>'id')::uuid,$1::uuid,x.event->>'type',x.event->>'page',x.event->>'service',
      statement_timestamp()+(x.ordinality*INTERVAL '1 microsecond')
    FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS x(event,ordinality)
    ON CONFLICT (event_id) DO NOTHING RETURNING occurred_at)
    UPDATE activity_sessions SET last_at=(SELECT MAX(occurred_at) FROM recorded)
    WHERE session_id=$1 AND EXISTS (SELECT 1 FROM recorded)`,
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
    if (key === 'device' && !['mobile','tablet','desktop','unknown'].includes(query[key])) throw new Error('Appareil invalide.');
    add(`${column} = ?`, query[key]);
  }
  if (query.q) {
    if (typeof query.q !== 'string' || query.q.length > 100) throw new Error('Recherche trop longue.');
    values.push('%' + query.q.replace(/[\\%_]/g, '\\$&') + '%');
    const p = '$' + values.length;
    clauses.push(`(e.service ILIKE ${p} OR e.page ILIKE ${p} OR e.type ILIKE ${p}
      OR s.visitor_id::text ILIKE ${p} OR e.session_id::text ILIKE ${p}
      OR s.browser ILIKE ${p} OR s.os ILIKE ${p} OR s.country ILIKE ${p}
      OR s.model ILIKE ${p} OR s.brand ILIKE ${p} OR s.city ILIKE ${p}
      OR s.region ILIKE ${p} OR s.language ILIKE ${p} OR s.source ILIKE ${p})`);
  }
  const page = Number(query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new Error('Page invalide.');
  return { where: clauses.join(' AND '), values, page };
}

const JOIN = 'FROM activity_events e JOIN activity_sessions s ON s.session_id=e.session_id';
const COLUMNS = `e.id,e.session_id,e.occurred_at,e.type,e.page,e.service,s.visitor_id,s.country,s.device,s.browser,s.os,
  s.brand,s.model,s.os_version,s.browser_version,s.language,s.region,s.city,s.source,s.first_at,s.last_at`;

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
  const rolling = {};
  for (const [key,days] of [['todayVisits',1],['weekVisits',7],['monthVisits',30]]) {
    const from = new Date(Date.parse(today) - (days-1)*86400000).toISOString().slice(0,10);
    const rf = filters({...query,from,to:today});
    const rows = await pool.query(`SELECT COUNT(DISTINCT e.session_id)::int count ${JOIN} WHERE ${rf.where}`,rf.values);
    rolling[key]=rows.rows[0].count;
  }
  const active = await pool.query(`SELECT COUNT(DISTINCT s.visitor_id)::int count ${JOIN}
    WHERE ${f.where} AND s.last_at >= NOW()-INTERVAL '5 minutes'`,f.values);
  const breakdowns = {};
  for (const [key,column,aggregate,extra] of [
    ['countries','s.country','COUNT(DISTINCT s.visitor_id)',''],
    ['devices','s.device','COUNT(DISTINCT s.visitor_id)',''],
    ['services','e.service','COUNT(*)'," AND e.service<>'' AND e.type IN ('service_view','finance_open','finance_category')"]
  ]) {
    const groups=await pool.query(`SELECT ${column} name,${aggregate}::int count ${JOIN}
      WHERE ${f.where}${extra} GROUP BY ${column} ORDER BY count DESC,name NULLS LAST`,f.values);
    breakdowns[key]=groups.rows;
  }
  const result = await pool.query(`SELECT ${COLUMNS} ${JOIN} WHERE ${f.where}
    ORDER BY e.occurred_at DESC,e.id DESC LIMIT 50 OFFSET $${f.values.length+1}`, [...f.values,(f.page-1)*50]);
  const facets = await pool.query(`SELECT array_remove(array_agg(DISTINCT s.country),NULL) countries,
    array_remove(array_agg(DISTINCT NULLIF(e.service,'')),NULL) services ${JOIN} WHERE ${f.where}`,f.values);
  return {ok:true,summary:{...summaryResult.rows[0],todayVisitors:todays.rows[0].count,...rolling,activeVisitors:active.rows[0].count},
    breakdowns,events:result.rows,
    total:summaryResult.rows[0].total,page:f.page,pageSize:50,facets:facets.rows[0],retentionDays:RETENTION_DAYS};
}

async function visitorDetail(pool, id) {
  if (!UUID.test(id)) throw new Error('Visiteur invalide.');
  const sessions=await pool.query(`SELECT s.*,
    GREATEST(0,EXTRACT(EPOCH FROM (s.last_at-s.first_at)))::int approx_duration_seconds
    FROM activity_sessions s WHERE s.visitor_id=$1
    AND EXISTS (SELECT 1 FROM activity_events e WHERE e.session_id=s.session_id)
    ORDER BY s.last_at DESC LIMIT 1001`,[id]);
  const summary=await pool.query(`SELECT $1::uuid::text visitor_id,MIN(s.first_at) first_at,MAX(s.last_at) last_at,
    COUNT(*)::int visits,COALESCE(SUM(GREATEST(0,EXTRACT(EPOCH FROM (s.last_at-s.first_at)))),0)::int approx_duration_seconds
    FROM activity_sessions s WHERE s.visitor_id=$1
    AND EXISTS (SELECT 1 FROM activity_events e WHERE e.session_id=s.session_id)`,[id]);
  const events=await pool.query(`SELECT ${COLUMNS} ${JOIN} WHERE s.visitor_id=$1
    ORDER BY e.occurred_at DESC,e.id DESC LIMIT 2001`,[id]);
  return {ok:true,visitor:summary.rows[0],sessions:sessions.rows.slice(0,1000),
    events:events.rows.slice(0,2000),truncated:events.rows.length>2000 || sessions.rows.length>1000};
}

function csvCell(value) {
  let text = String(value == null ? '' : value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text; // spreadsheet formula injection
  return '"' + text.replace(/"/g,'""') + '"';
}

module.exports = { initialize,cleanup,metadata,validateBatch,record,filters,report,visitorDetail,JOIN,COLUMNS,UUID,slug,csvCell,RETENTION_DAYS };
