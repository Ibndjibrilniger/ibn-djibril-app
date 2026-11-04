'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./support/admin-fixture.cjs');

const EXPECTED_ZONES = [
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

test('private Wi-Fi Business dashboard persists zones, plans, goals, sales and audited corrections', { timeout: 180000 }, async () => {
  const app = await fixture();
  console.log('wifi-test: fixture');
  let browser;
  const json = async (path, { method = 'GET', body, cookie, origin } = {}) => {
    const headers = { Accept: 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (origin !== undefined) headers.Origin = origin;
    const response = await fetch(app.base + path, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      redirect: 'manual'
    });
    const data = (response.headers.get('content-type') || '').includes('application/json')
      ? await response.json() : null;
    return { response, data };
  };

  try {
    for (const route of [
      '/admin/wifi-business',
      '/admin/wifi-business/wifi-business.css',
      '/admin/wifi-business/wifi-business.js',
      '/api/admin/wifi-business/dashboard',
      '/api/admin/wifi-business/zones',
      '/api/admin/wifi-business/plans'
    ]) {
      const response = await fetch(app.base + route, { redirect: 'manual' });
      assert.equal(response.status, route.startsWith('/api/') ? 401 : 302, `unauthenticated ${route}`);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
    }
    console.log('wifi-test: protected routes');

    const cookie = await app.login();
    const pageResponse = await fetch(app.base + '/admin/wifi-business', { headers: { Cookie: cookie } });
    assert.equal(pageResponse.status, 200);
    assert.match(await pageResponse.text(), /Wi-Fi Business/);
    for (const asset of ['wifi-business.css', 'wifi-business.js']) {
      const response = await fetch(app.base + `/admin/wifi-business/${asset}`, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, asset);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
    }

    const initialZones = await json('/api/admin/wifi-business/zones', { cookie });
    assert.equal(initialZones.response.status, 200);
    assert.equal(initialZones.data.zones.length, 18);
    assert.deepEqual(initialZones.data.zones.map(zone => zone.name), EXPECTED_ZONES);
    assert.equal(initialZones.data.zones.some(zone => /al izza/i.test(zone.name)), false);
    assert.ok(initialZones.data.zones.every(zone => zone.status === 'unconfirmed' && !zone.archived));
    const demoZone = initialZones.data.zones.find(zone => zone.name === 'LINK ZONE TARA 1.5');
    assert.equal(demoZone.manualPerformance, 30);

    const initialPlans = await json('/api/admin/wifi-business/plans', { cookie });
    assert.deepEqual(initialPlans.data.plans.map(plan => plan.code), ['2h', '5h', '24h', '7d', '30d']);
    assert.ok(initialPlans.data.plans.every(plan => plan.priceFcfa === null));
    assert.ok(initialPlans.data.plans.every(plan => plan.enabled));
    console.log('wifi-test: seeded data');

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Porto-Novo',
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const initialDashboard = await json('/api/admin/wifi-business/dashboard?range=today', { cookie });
    assert.equal(initialDashboard.data.summary.revenueFcfa, 0);
    assert.equal(initialDashboard.data.summary.ticketsSold, 0);
    assert.equal(initialDashboard.data.summary.performancePercent, null);
    const demoScore = initialDashboard.data.zones.find(zone => zone.name === 'LINK ZONE TARA 1.5');
    assert.equal(demoScore.performancePercent, 30);
    assert.equal(demoScore.gaugePercent, 30);
    assert.equal(demoScore.performanceSource, 'manual_demo');
    assert.match(demoScore.demoLabel, /pas un résultat de ventes/);

    const originalZone = initialZones.data.zones.find(zone => zone.name === 'LINK ZONE 2.1');
    const unconfirmedSale = await json('/api/admin/wifi-business/sales', {
      method: 'POST', cookie, origin: app.base,
      body: { zoneId: originalZone.id, planCode: '2h', amountFcfa: 1000, ticketCount: 1 }
    });
    assert.equal(unconfirmedSale.response.status, 409);
    const forgedOrigin = await json('/api/admin/wifi-business/zones', {
      method: 'POST', cookie, origin: 'https://attacker.example', body: { name: 'Zone interdite' }
    });
    assert.equal(forgedOrigin.response.status, 403);
    console.log('wifi-test: zone status and origin checks');

    const duplicate = await json('/api/admin/wifi-business/zones', {
      method: 'POST', cookie, origin: app.base, body: { name: 'link zone 2.1' }
    });
    assert.equal(duplicate.response.status, 409);

    const activated = await json(`/api/admin/wifi-business/zones/${originalZone.id}`, {
      method: 'PATCH', cookie, origin: app.base, body: { status: 'active' }
    });
    assert.equal(activated.response.status, 200);
    assert.equal(activated.data.zone.name, 'LINK ZONE 2.1');
    assert.equal(activated.data.zone.status, 'active');

    const goal = await json(`/api/admin/wifi-business/zones/${originalZone.id}/targets`, {
      method: 'PUT', cookie, origin: app.base,
      body: { dailyTargetFcfa: 2000, weeklyTargetFcfa: 1000, monthlyTargetFcfa: 2500 }
    });
    assert.equal(goal.response.status, 200);
    assert.equal(goal.data.targets.dailyTargetFcfa, 2000);
    const zeroGoal = await json(`/api/admin/wifi-business/zones/${originalZone.id}/targets`, {
      method: 'PUT', cookie, origin: app.base,
      body: { dailyTargetFcfa: 0, weeklyTargetFcfa: null, monthlyTargetFcfa: null }
    });
    assert.equal(zeroGoal.response.status, 400);

    const planUpdate = await json('/api/admin/wifi-business/plans/2h', {
      method: 'PATCH', cookie, origin: app.base, body: { priceFcfa: 500, enabled: true }
    });
    assert.equal(planUpdate.response.status, 200);
    assert.equal(planUpdate.data.plan.priceFcfa, 500);

    const badAmount = await json('/api/admin/wifi-business/sales', {
      method: 'POST', cookie, origin: app.base,
      body: { zoneId: originalZone.id, planCode: '2h', amountFcfa: 0, ticketCount: 1 }
    });
    assert.equal(badAmount.response.status, 400);
    const invalidDate = await json('/api/admin/wifi-business/sales', {
      method: 'POST', cookie, origin: app.base,
      body: { zoneId: originalZone.id, planCode: '2h', amountFcfa: 1000, soldAt: '2026-02-30T12:30:00Z' }
    });
    assert.equal(invalidDate.response.status, 400);

    const created = await json('/api/admin/wifi-business/sales', {
      method: 'POST', cookie, origin: app.base,
      body: { zoneId: originalZone.id, planCode: '2h', amountFcfa: 1000, ticketCount: 2 }
    });
    assert.equal(created.response.status, 201);
    const saleId = created.data.sale.id;
    const afterSale = await json('/api/admin/wifi-business/dashboard?range=today', { cookie });
    assert.equal(afterSale.data.summary.revenueFcfa, 1000);
    assert.equal(afterSale.data.summary.ticketsSold, 2);
    assert.equal(afterSale.data.summary.performancePercent, 50);
    const trackedZone = afterSale.data.zones.find(zone => zone.id === originalZone.id);
    assert.equal(trackedZone.gaugePercent, 50);
    assert.equal(trackedZone.trendDirection, 'up');
    assert.equal(trackedZone.trendPercent, null);
    assert.ok(trackedZone.lastSaleAt);
    console.log('wifi-test: real sale');

    const correction = await json(`/api/admin/wifi-business/sales/${saleId}/correct`, {
      method: 'POST', cookie, origin: app.base,
      body: {
        zoneId: originalZone.id, planCode: '2h', amountFcfa: 1200,
        ticketCount: 3, reason: 'Montant et quantité corrigés'
      }
    });
    assert.equal(correction.response.status, 201);
    const correctedId = correction.data.sale.id;

    const repeatedCorrection = await json(`/api/admin/wifi-business/sales/${saleId}/correct`, {
      method: 'POST', cookie, origin: app.base,
      body: {
        zoneId: originalZone.id, planCode: '2h', amountFcfa: 1300,
        ticketCount: 3, reason: 'Deuxième correction'
      }
    });
    assert.equal(repeatedCorrection.response.status, 409);

    const history = await json(`/api/admin/wifi-business/sales?from=${today}&to=${today}`, { cookie });
    assert.equal(history.data.total, 2);
    const originalRecord = history.data.rows.find(row => row.id === saleId);
    const correctionRecord = history.data.rows.find(row => row.id === correctedId);
    assert.equal(originalRecord.corrected, true);
    assert.equal(originalRecord.correctionReason, 'Montant et quantité corrigés');
    assert.equal(correctionRecord.replacesSaleId, saleId);
    assert.equal(correctionRecord.amountFcfa, 1200);

    const afterCorrection = await json('/api/admin/wifi-business/dashboard?range=today', { cookie });
    assert.equal(afterCorrection.data.summary.revenueFcfa, 1200);
    assert.equal(afterCorrection.data.summary.ticketsSold, 3);
    assert.equal(afterCorrection.data.summary.performancePercent, 60);
    assert.equal(afterCorrection.data.zones.find(zone => zone.id === originalZone.id).gaugePercent, 60);

    const overGoal = await json(`/api/admin/wifi-business/zones/${originalZone.id}/targets`, {
      method: 'PUT', cookie, origin: app.base,
      body: { dailyTargetFcfa: 500, weeklyTargetFcfa: 1000, monthlyTargetFcfa: 2500 }
    });
    assert.equal(overGoal.response.status, 200);
    const exceeded = await json('/api/admin/wifi-business/dashboard?range=today', { cookie });
    const exceededZone = exceeded.data.zones.find(zone => zone.id === originalZone.id);
    assert.equal(exceededZone.performancePercent, 240);
    assert.equal(exceededZone.gaugePercent, 100);
    console.log('wifi-test: correction and targets');

    const csv = await fetch(app.base + `/api/admin/wifi-business/export.csv?from=${today}&to=${today}`, {
      headers: { Cookie: cookie }
    });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type') || '', /text\/csv/);
    assert.match(csv.headers.get('content-disposition') || '', /attachment/);
    const csvText = await csv.text();
    assert.match(csvText, /Montant FCFA/);
    assert.match(csvText, /Correction ajoutée/);

    const audit = await json(`/api/admin/wifi-business/audit?from=${today}&to=${today}`, { cookie });
    assert.ok(audit.data.rows.some(row => row.action === 'sale_corrected' && row.reason === 'Montant et quantité corrigés'));
    assert.ok(audit.data.rows.some(row => row.action === 'targets_updated'));
    assert.ok(audit.data.rows.some(row => row.action === 'plan_updated'));
    console.log('wifi-test: export and audit');

    const beforeRenameCount = Number((await app.client.query('SELECT COUNT(*) FROM wifi_business_zones')).rows[0].count);
    const renamed = await json(`/api/admin/wifi-business/zones/${originalZone.id}`, {
      method: 'PATCH', cookie, origin: app.base,
      body: { name: 'LINK ZONE 2.1 RENOMMÉE', status: 'active' }
    });
    assert.equal(renamed.response.status, 200);
    app.wifiBusiness.stop();
    await app.wifiBusiness.start();
    const afterRestart = await json('/api/admin/wifi-business/zones', { cookie });
    assert.equal(afterRestart.data.zones.length, beforeRenameCount);
    assert.equal(afterRestart.data.zones.some(zone => zone.name === 'LINK ZONE 2.1'), false);
    assert.equal(afterRestart.data.zones.some(zone => zone.name === 'LINK ZONE 2.1 RENOMMÉE'), true);
    console.log('wifi-test: startup idempotency');

    const archive = await json(`/api/admin/wifi-business/zones/${originalZone.id}`, {
      method: 'PATCH', cookie, origin: app.base,
      body: { status: 'archived' }
    });
    assert.equal(archive.data.zone.status, 'archived');
    const restore = await json(`/api/admin/wifi-business/zones/${originalZone.id}`, {
      method: 'PATCH', cookie, origin: app.base,
      body: { status: 'active' }
    });
    assert.equal(restore.data.zone.status, 'active');
    assert.equal(restore.data.zone.archived, false);

    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM wifi_business_sales')).rows[0].count), 2);
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM prices')).rows[0].count), Object.keys(app.prices).length);
    console.log('wifi-test: archive and data preservation');

    browser = await chromium.launch({
      executablePath: '/repl/tools/bin/chromium',
      headless: true,
      args: ['--no-sandbox']
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const equals = cookie.indexOf('=');
    await context.addCookies([{
      name: cookie.slice(0, equals),
      value: cookie.slice(equals + 1),
      url: app.base,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }]);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(app.base + '/admin/wifi-business', { waitUntil: 'domcontentloaded' });
    console.log('wifi-test: browser page loaded');
    await page.waitForSelector('#sales-chart svg');
    assert.match(await page.locator('#period-status').textContent(), /Période/);
    await page.locator('#tab-zones').click();
    await page.waitForSelector('#zones-body tr');
    await page.locator('[data-range="today"]').click();
    await page.waitForFunction(() => document.querySelector('#panel-zones .performance-overage')?.textContent.includes('240'));
    const taraRow = page.locator('#zones-body tr').filter({ hasText: 'LINK ZONE TARA 1.5' });
    assert.equal(await taraRow.locator('.gauge-value').textContent(), '30%');
    assert.ok((await taraRow.locator('.gauge-value').getAttribute('class')).includes('tier-red'));
    const activeRow = page.locator('#zones-body tr').filter({ hasText: 'LINK ZONE 2.1 RENOMMÉE' });
    assert.ok((await activeRow.locator('.gauge-value').textContent()).includes('100'));
    assert.match(await activeRow.locator('.performance-overage').textContent(), /240/);
    assert.match(await activeRow.locator('.performance-overage').textContent(), /700/);
    await page.locator('#tab-sales').click();
    await page.waitForSelector('#sales-body tr');
    assert.equal(await page.locator('#sales-body tr').count(), 2);
    assert.equal(await page.locator('#sales-body button:disabled').count(), 1);
    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileWidth = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    }));
    assert.ok(mobileWidth.scroll <= mobileWidth.viewport + 1, `mobile horizontal overflow: ${JSON.stringify(mobileWidth)}`);
    assert.deepEqual(pageErrors, []);
    await context.close();
  } finally {
    if (browser) await browser.close();
    await app.close();
  }
});
