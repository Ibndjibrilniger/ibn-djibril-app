'use strict';

// Global declarations are intentionally NOT ticket sales: no zone, ticket count,
// daily distribution or revenue addition can be inferred from an all-zone total.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS wifi_business_global_reports (
  id BIGSERIAL PRIMARY KEY,
  start_day DATE NOT NULL CHECK (start_day >= DATE '1999-01-01'),
  end_day DATE NOT NULL CHECK (end_day >= start_day),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa BETWEEN 0 AND 1000000000),
  note TEXT NOT NULL CHECK (length(btrim(note)) BETWEEN 5 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  CHECK ((voided_at IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND length(btrim(void_reason)) BETWEEN 5 AND 500)),
  EXCLUDE USING gist (daterange(start_day, end_day, '[]') WITH &&)
    WHERE (voided_at IS NULL)
);
`;

function mapReport(row) {
  return {
    id: String(row.id), from: row.start_day, to: row.end_day,
    amountFcfa: Number(row.amount_fcfa), note: row.note,
    createdAt: row.created_at, voidedAt: row.voided_at, voidReason: row.void_reason,
    included: Boolean(row.included)
  };
}

function createReports(pool, ensure) {
  async function summary(period) {
    await ensure();
    const result = await pool.query(`
      SELECT COUNT(*)::int AS total,
        COALESCE(SUM(amount_fcfa) FILTER (WHERE voided_at IS NULL
          AND start_day >= $1::date AND end_day <= $2::date), 0)::bigint AS amount,
        COALESCE(SUM(end_day - start_day + 1) FILTER (WHERE voided_at IS NULL
          AND start_day >= $1::date AND end_day <= $2::date), 0)::int AS covered_days,
        COUNT(*) FILTER (WHERE voided_at IS NULL
          AND (start_day < $1::date OR end_day > $2::date))::int AS partial_count
      FROM wifi_business_global_reports
      WHERE start_day <= $2::date AND end_day >= $1::date
    `, [period.from, period.to]);
    const row = result.rows[0];
    const totalFcfa = Number(row.amount), coveredDays = Number(row.covered_days);
    return {
      total: Number(row.total), totalFcfa, coveredDays,
      selectedDays: period.days, partialCount: Number(row.partial_count),
      dailyAverageFcfa: coveredDays ? totalFcfa / coveredDays : null
    };
  }
  async function list({ period, page = 1, exportAll = false }) {
    await ensure();
    const [result, totals] = await Promise.all([
      pool.query(`
        SELECT id, start_day::text, end_day::text, amount_fcfa, note,
          created_at, voided_at, void_reason,
          (voided_at IS NULL AND start_day >= $1::date AND end_day <= $2::date) AS included
        FROM wifi_business_global_reports
        WHERE start_day <= $2::date AND end_day >= $1::date
        ORDER BY start_day DESC, id DESC
        LIMIT $3::int OFFSET $4
      `, [period.from, period.to, exportAll ? null : 50, exportAll ? 0 : (page - 1) * 50]),
      summary(period)
    ]);
    return { ok: true, rows: result.rows.map(mapReport), total: totals.total, page, pageSize: 50, summary: totals };
  }
  async function create({ from, to, amountFcfa, note }) {
    await ensure();
    // Native range exclusion + ON CONFLICT makes overlap refusal race-safe and
    // non-destructive even when two administrators submit concurrently.
    const result = await pool.query(`
      WITH inserted AS (
        INSERT INTO wifi_business_global_reports(start_day,end_day,amount_fcfa,note)
        VALUES ($1::date,$2::date,$3,$4) ON CONFLICT DO NOTHING
        RETURNING *
      ), audit AS (
        INSERT INTO wifi_business_audit(action,entity_type,entity_id,summary,details)
        SELECT 'global_report_created','global_report',id::text,
          'Recettes globales déclarées : ' || start_day::text || ' au ' || end_day::text,
          jsonb_build_object('from',start_day,'to',end_day,'amountFcfa',amount_fcfa,'note',note)
        FROM inserted
      )
      SELECT id,start_day::text,end_day::text,amount_fcfa,note,
        created_at,voided_at,void_reason,TRUE AS included FROM inserted
    `, [from, to, amountFcfa, note]);
    return result.rows[0] ? mapReport(result.rows[0]) : null;
  }
  async function voidReport(id, reason) {
    await ensure();
    const result = await pool.query(`
      WITH updated AS (
        UPDATE wifi_business_global_reports SET voided_at=statement_timestamp(), void_reason=$2
        WHERE id=$1 AND voided_at IS NULL RETURNING *
      ), audit AS (
        INSERT INTO wifi_business_audit(action,entity_type,entity_id,summary,reason,details)
        SELECT 'global_report_voided','global_report',id::text,
          'Relevé de recettes globales annulé', $2,
          jsonb_build_object('from',start_day,'to',end_day,'amountFcfa',amount_fcfa)
        FROM updated
      )
      SELECT id,start_day::text,end_day::text,amount_fcfa,note,
        created_at,voided_at,void_reason,FALSE AS included FROM updated
    `, [id, reason]);
    return result.rows[0] ? mapReport(result.rows[0]) : null;
  }
  return { list, summary, create, voidReport };
}

module.exports = { SCHEMA_SQL, createReports };
