'use strict';

const TIME_ZONE = 'Africa/Porto-Novo';
const DAY_MS = 24 * 60 * 60 * 1000;

function dateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function localDateKey(date = new Date()) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(value, months) {
  const [year, month, day] = value.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1, 12));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dayCount(from, to) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS) + 1;
}

function localBoundary(value) {
  return new Date(`${value}T00:00:00.000+01:00`);
}

function periodRange({ range = 'today', from, to, now = new Date() } = {}) {
  const today = localDateKey(now);
  let start;
  let end = today;
  let previousStart;
  let previousEnd;
  let normalizedRange = range;

  if (range === 'today') {
    start = today;
    previousStart = previousEnd = shiftDate(today, -1);
  } else if (range === '7d') {
    start = shiftDate(today, -6);
    previousEnd = shiftDate(start, -1);
    previousStart = shiftDate(previousEnd, -6);
  } else if (range === '30d') {
    start = shiftDate(today, -29);
    previousEnd = shiftDate(start, -1);
    previousStart = shiftDate(previousEnd, -29);
  } else if (range === 'month') {
    start = `${today.slice(0, 7)}-01`;
    previousStart = shiftMonth(start, -1);
    previousEnd = shiftMonth(today, -1);
  } else if (range === 'previous-month') {
    const firstThisMonth = `${today.slice(0, 7)}-01`;
    start = shiftMonth(firstThisMonth, -1);
    end = shiftDate(firstThisMonth, -1);
    previousStart = shiftMonth(start, -1);
    previousEnd = shiftDate(start, -1);
  } else if (range === 'custom') {
    normalizedRange = 'custom';
    if (!isDateKey(from) || !isDateKey(to) || from > to || to > today) {
      throw Object.assign(new Error('Période personnalisée invalide.'), { status: 400 });
    }
    start = from;
    end = to;
    const length = dayCount(start, end);
    if (length > 366) throw Object.assign(new Error('La période ne peut pas dépasser 366 jours.'), { status: 400 });
    previousEnd = shiftDate(start, -1);
    previousStart = shiftDate(previousEnd, -(length - 1));
  } else {
    throw Object.assign(new Error('Période invalide.'), { status: 400 });
  }

  const endExclusive = shiftDate(end, 1);
  const previousEndExclusive = shiftDate(previousEnd, 1);
  return {
    range: normalizedRange,
    from: start,
    to: end,
    previousFrom: previousStart,
    previousTo: previousEnd,
    startAt: localBoundary(start),
    endAt: localBoundary(endExclusive),
    previousStartAt: localBoundary(previousStart),
    previousEndAt: localBoundary(previousEndExclusive),
    days: dayCount(start, end)
  };
}

function targetForPeriod(zone, period) {
  if (period.range === 'today') return zone.dailyTargetFcfa;
  if (period.range === '7d') return zone.weeklyTargetFcfa;
  if (['30d', 'month', 'previous-month'].includes(period.range)) return zone.monthlyTargetFcfa;
  return zone.dailyTargetFcfa === null ? null : zone.dailyTargetFcfa * period.days;
}

function performance(revenue, target) {
  if (!Number.isFinite(target) || target <= 0) return null;
  return (revenue / target) * 100;
}

module.exports = {
  TIME_ZONE,
  localDateKey,
  shiftDate,
  shiftMonth,
  isDateKey,
  dayCount,
  periodRange,
  targetForPeriod,
  performance
};
