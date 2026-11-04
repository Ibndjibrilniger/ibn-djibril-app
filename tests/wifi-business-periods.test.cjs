'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  localDateKey,
  periodRange,
  targetForPeriod,
  performance
} = require('../wifi-business-periods');

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

test('goal percentage remains uncapped while a gauge can clamp at 100', () => {
  assert.equal(performance(2500, 2000), 125);
  assert.equal(performance(0, 2000), 0);
  assert.equal(performance(2500, null), null);
});
