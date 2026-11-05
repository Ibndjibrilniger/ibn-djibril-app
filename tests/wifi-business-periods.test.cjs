'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  localDateKey,
  periodRange,
  targetForPeriod,
  performance
} = require('../wifi-business-periods');
const { _test: routeHelpers } = require('../wifi-business-routes');

test('Wi-Fi periods use Niger local-day boundaries and equivalent comparison windows', () => {
  const now = new Date('2026-11-04T12:00:00.000Z');
  assert.equal(localDateKey(now), '2026-11-04');

  const today = periodRange({ range: 'today', now });
  assert.equal(today.from, '2026-11-04');
  assert.equal(today.previousFrom, '2026-11-03');
  assert.equal(today.startAt.toISOString(), '2026-11-03T23:00:00.000Z');
  assert.equal(today.endAt.toISOString(), '2026-11-04T23:00:00.000Z');

  const lastWeek = periodRange({ range: '7d', now });
  assert.equal(lastWeek.from, '2026-10-29');
  assert.equal(lastWeek.to, '2026-11-04');
  assert.equal(lastWeek.previousFrom, '2026-10-22');
  assert.equal(lastWeek.previousTo, '2026-10-28');

  const month = periodRange({ range: 'month', now });
  assert.equal(month.from, '2026-11-01');
  assert.equal(month.previousFrom, '2026-10-01');
  assert.equal(month.previousTo, '2026-10-04');
});

test('custom periods validate dates and scale only defined daily objectives', () => {
  const period = periodRange({
    range: 'custom',
    from: '2026-10-30',
    to: '2026-11-04',
    now: new Date('2026-11-04T12:00:00Z')
  });
  assert.equal(period.days, 6);
  assert.equal(period.previousFrom, '2026-10-24');
  assert.equal(targetForPeriod({ dailyTargetFcfa: 500, weeklyTargetFcfa: 4000, monthlyTargetFcfa: null }, period), 3000);
  assert.equal(targetForPeriod({ dailyTargetFcfa: null, weeklyTargetFcfa: null, monthlyTargetFcfa: null }, period), null);
  assert.throws(() => periodRange({
    range: 'custom',
    from: '2026-11-05',
    to: '2026-11-06',
    now: new Date('2026-11-04T12:00:00Z')
  }), { status: 400 });
});

test('previous month uses complete calendar months and the monthly objective', () => {
  const october = periodRange({ range: 'previous-month', now: new Date('2026-11-05T12:00:00Z') });
  assert.deepEqual([october.from, october.to, october.previousFrom, october.previousTo],
    ['2026-10-01', '2026-10-31', '2026-09-01', '2026-09-30']);
  assert.equal(targetForPeriod({ dailyTargetFcfa: 10, monthlyTargetFcfa: 9000 }, october), 9000);
  const december = periodRange({ range: 'previous-month', now: new Date('2027-01-01T00:00:00Z') });
  assert.equal(december.from, '2026-12-01');
  assert.equal(december.to, '2026-12-31');
  const leap = periodRange({ range: 'previous-month', now: new Date('2028-03-01T00:00:00Z') });
  assert.equal(leap.to, '2028-02-29');
});

test('goal percentage remains uncapped while a gauge can clamp at 100', () => {
  assert.equal(performance(2500, 2000), 125);
  assert.equal(performance(0, 2000), 0);
  assert.equal(performance(2500, null), null);
});

test('historical periods span 1999 to today and calendar months respect leap years', () => {
  const now = new Date('2026-11-05T12:00:00Z');
  const all = periodRange({ range: 'custom', from: '1999-01-01', to: '2026-11-05', now });
  assert.ok(all.days > 10000);
  for (const [year, end] of [['1999', '28'], ['2000', '29'], ['2024', '29'], ['2026', '28']]) {
    const period = periodRange({ range: 'calendar-month', from: `${year}-02-01`, to: `${year}-02-${end}`, now });
    assert.equal(period.days, Number(end));
    assert.equal(targetForPeriod({ monthlyTargetFcfa: 500, dailyTargetFcfa: 1 }, period), 500);
    assert.equal(period.previousTo, `${year}-01-31`);
  }
  const futureYear = periodRange({ range: 'custom', from: '1999-01-01', to: '2027-01-02', now: new Date('2027-01-02T12:00:00Z') });
  assert.equal(futureYear.to, '2027-01-02');
  for (const [from, to] of [['1998-12-31', '1999-01-01'], ['2026-02-01', '2026-02-29'],
    ['2026-11-05', '2026-11-06'], ['2026-11-05', '2026-11-01']]) {
    assert.throws(() => periodRange({ range: 'custom', from, to, now }), { status: 400 });
  }
  assert.throws(() => periodRange({ range: 'calendar-month', from: '2024-02-01', to: '2024-02-28', now }), { status: 400 });
});

test('CSV values are quoted and spreadsheet formulas are neutralized', () => {
  assert.equal(routeHelpers.csvCell('=1+2'), '"\'=1+2"');
  assert.equal(routeHelpers.csvCell('une "zone"'), '"une ""zone"""');
});
