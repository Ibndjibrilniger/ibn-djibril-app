'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./support/admin-fixture.cjs');
const { periodRange } = require('../wifi-business-periods');

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
    const deniedWrite = await json('/api/admin/wifi-business/zones', {
      method: 'POST', body: { name: 'Zone sans session' }
    });
    assert.equal(deniedWrite.response.status, 401);

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

    const duplicate = await json('/api/admin/wifi-business/zones', {
      method: 'POST', cookie, origin: app.base, body: { name: 'link zone 2.1' }
    });
    assert.equal(duplicate.response.status, 409);
    const addedZone = await json('/api/admin/wifi-business/zones', {
      method: 'POST', cookie, origin: app.base, body: { name: 'LINK ZONE ESSAI' }
    });
    assert.equal(addedZone.response.status, 201);
    assert.equal(addedZone.data.zone.status, 'unconfirmed');
    const duplicateRename = await json(`/api/admin/wifi-business/zones/${addedZone.data.zone.id}`, {
      method: 'PATCH', cookie, origin: app.base, body: { name: 'link zone 2.1' }
    });
    assert.equal(duplicateRename.response.status, 409);

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
    const disabledPlan = await json('/api/admin/wifi-business/plans/2h', {
      method: 'PATCH', cookie, origin: app.base, body: { enabled: false }
    });
    assert.equal(disabledPlan.data.plan.enabled, false);
    const unavailableSale = await json('/api/admin/wifi-business/sales', {
      method: 'POST', cookie, origin: app.base,
      body: { zoneId: originalZone.id, planCode: '2h', amountFcfa: 1000 }
    });
    assert.equal(unavailableSale.response.status, 409);
    await json('/api/admin/wifi-business/plans/2h', {
      method: 'PATCH', cookie, origin: app.base, body: { enabled: true }
    });

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

    const csv = await fetch(app.base + `/api/admin/wifi-business/export.csv?from=${today}&to=${today}`, {
      headers: { Cookie: cookie }
    });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type') || '', /text\/csv/);
    assert.match(csv.headers.get('content-disposition') || '', /attachment/);
    const csvText = await csv.text();
    assert.match(csvText, /Montant FCFA/);
    assert.match(csvText, /Correction ajoutée/);
    assert.equal(csvText.trim().split(/\r?\n/).length, 2, 'CSV excludes superseded sales');
    assert.match(csvText, /"1200"/);

    const audit = await json(`/api/admin/wifi-business/audit?from=${today}&to=${today}`, { cookie });
    assert.ok(audit.data.rows.some(row => row.action === 'sale_corrected' && row.reason === 'Montant et quantité corrigés'));
    assert.ok(audit.data.rows.some(row => row.action === 'targets_updated'));
    assert.ok(audit.data.rows.some(row => row.action === 'plan_updated'));

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
    const persistedPlans = await json('/api/admin/wifi-business/plans', { cookie });
    assert.equal(persistedPlans.data.plans.find(plan => plan.code === '2h').priceFcfa, 500);

    const archive = await json(`/api/admin/wifi-business/zones/${originalZone.id}`, {
      method: 'PATCH', cookie, origin: app.base,
      body: { status: 'archived' }
    });
    assert.equal(archive.data.zone.status, 'archived');
    const archivedTotals = await json('/api/admin/wifi-business/dashboard?range=today', { cookie });
    assert.equal(archivedTotals.data.summary.revenueFcfa, 1200, 'archiving never removes historical revenue');
    const restore = await json(`/api/admin/wifi-business/zones/${originalZone.id}`, {
      method: 'PATCH', cookie, origin: app.base,
      body: { status: 'active' }
    });
    assert.equal(restore.data.zone.status, 'active');
    assert.equal(restore.data.zone.archived, false);

    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM wifi_business_sales')).rows[0].count), 2);
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM prices')).rows[0].count), Object.keys(app.prices).length);

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
    await page.goto(app.base + '/admin', { waitUntil: 'domcontentloaded' });
    const accessButton = page.getByRole('link', { name: 'Wi-Fi Business — Link Zones', exact: true });
    assert.ok((await accessButton.boundingBox()).height >= 46);
    assert.equal(await page.getByRole('link', { name: 'Tarifs des tickets', exact: true }).getAttribute('href'), '/admin/wifi-business#tarifs');
    await accessButton.click();
    await page.waitForSelector('#sales-chart svg');
    assert.match(await page.locator('#period-status').textContent(), /Période/);
    assert.match(await page.locator('#metric-period').textContent(), /\d{4}-\d{2}-\d{2}/);
    await page.locator('#open-plan-prices').click();
    await page.waitForSelector('#plans-grid .plan-card');
    assert.equal(await page.locator('#plans-grid .plan-card').count(), 5);
    const twoHourPlan = page.locator('#plans-grid .plan-card').filter({ has: page.locator('.plan-code', { hasText: /^2h$/ }) });
    await twoHourPlan.getByRole('button', { name: 'Modifier le prix' }).click();
    await page.locator('#field-priceFcfa').fill('0');
    assert.equal(await page.locator('#field-priceFcfa').evaluate(input => input.checkValidity()), false);
    await page.locator('#field-priceFcfa').fill('750');
    await page.locator('#work-dialog button[type="submit"]').click();
    await page.waitForFunction(() => !document.querySelector('#work-dialog').open);
    assert.match(await page.locator('#plans-feedback').textContent(), /750 FCFA/);
    await page.screenshot({ path: '/tmp/wifi-prices-confirmation.jpg', type: 'jpeg', quality: 80 });
    await page.goto(app.base + '/admin/wifi-business#tarifs', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#plans-grid .plan-card');
    assert.equal(await page.locator('#tab-plans').getAttribute('aria-selected'), 'true');
    assert.match(await twoHourPlan.locator('.plan-price').textContent(), /750 FCFA/);
    const revenueAfterPrice = await json('/api/admin/wifi-business/dashboard?range=today', { cookie });
    assert.equal(revenueAfterPrice.data.summary.revenueFcfa, 1200, 'a tariff change never rewrites actual receipts');
    await page.locator('#open-plan-audit').click();
    await page.waitForSelector('#audit-list .audit-row');
    assert.match(await page.locator('#audit-list').textContent(), /500 FCFA → 750 FCFA/);
    const previousMonth = periodRange({ range: 'previous-month' });
    const previousResponse = page.waitForResponse(response => response.url().includes('/dashboard?range=previous-month') && response.status() === 200);
    await page.locator('[data-range="previous-month"]').click();
    assert.equal((await (await previousResponse).json()).period.from, previousMonth.from);
    await page.waitForFunction(from => document.querySelector('#metric-period').textContent.includes(from), previousMonth.from);
    await page.locator('#tab-sales').click();
    await page.waitForFunction(from => document.querySelector('#export-csv').href.includes(from), previousMonth.from);
    await page.locator('#tab-overview').click();
    await page.locator('#tab-overview').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#tab-zones').getAttribute('aria-selected'), 'true');
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
    await page.locator('#panel-zones').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/wifi-business-desktop.jpg', type: 'jpeg', quality: 80 });
    await page.locator('#tab-sales').click();
    await page.waitForSelector('#sales-body tr');
    assert.equal(await page.locator('#sales-body tr').count(), 2);
    assert.equal(await page.locator('#sales-body button:disabled').count(), 1);

    await page.locator('#add-sale').click();
    await page.locator('#field-zoneId').selectOption(originalZone.id);
    await page.locator('#field-planCode').selectOption('2h');
    await page.locator('#field-amountFcfa').fill('500');
    await page.locator('#field-ticketCount').fill('1');
    await page.locator('#work-dialog button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#sales-body tr').length === 3 &&
      !document.querySelector('#work-dialog').open);
    await page.locator('#sales-body tr').filter({ hasText: '500 FCFA' })
      .getByRole('button', { name: 'Corriger', exact: true }).click();
    await page.locator('#field-amountFcfa').fill('600');
    await page.locator('#field-reason').fill('Correction depuis le formulaire Admin');
    await page.locator('#work-dialog button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#sales-body tr').length === 4 &&
      !document.querySelector('#work-dialog').open);
    assert.equal((await page.locator('#metric-revenue').textContent()).replace(/\D/g, ''), '1800');
    assert.equal(await page.locator('#sales-body button:disabled').count(), 2);

    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileWidth = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth
    }));
    assert.ok(mobileWidth.scroll <= mobileWidth.viewport + 1, `mobile horizontal overflow: ${JSON.stringify(mobileWidth)}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: '/tmp/wifi-business-mobile.jpg', type: 'jpeg', quality: 80 });
    assert.deepEqual(pageErrors, []);

    const clearGoals = await json(`/api/admin/wifi-business/zones/${originalZone.id}/targets`, {
      method: 'PUT', cookie, origin: app.base,
      body: { dailyTargetFcfa: null, weeklyTargetFcfa: null, monthlyTargetFcfa: null }
    });
    assert.equal(clearGoals.response.status, 200);
    const noGoal = await json('/api/admin/wifi-business/dashboard?range=today', { cookie });
    const noGoalZone = noGoal.data.zones.find(zone => zone.id === originalZone.id);
    assert.equal(noGoalZone.performancePercent, null);
    assert.equal(noGoalZone.performanceSource, 'no_goal');
    assert.equal(noGoal.data.summary.revenueFcfa, 1800);
    assert.equal(noGoal.data.summary.ticketsSold, 4);
    assert.equal(noGoal.data.summary.performancePercent, null);

    const inactive = await json(`/api/admin/wifi-business/zones/${addedZone.data.zone.id}`, {
      method: 'PATCH', cookie, origin: app.base, body: { status: 'inactive' }
    });
    assert.equal(inactive.data.zone.status, 'inactive');

    const logout = await fetch(app.base + '/admin/logout', {
      method: 'POST', headers: { Cookie: cookie }, redirect: 'manual'
    });
    assert.equal(logout.status, 302);
    await page.locator('#refresh-all').click();
    await page.waitForSelector('#panel-sales a[href="/admin/login"]', { state: 'visible' });
    assert.equal(await page.locator('#metric-revenue').textContent(), '—');
    assert.equal(await page.locator('#refresh-all').isDisabled(), true);
    assert.deepEqual(pageErrors, []);
    await context.close();
  } finally {
    if (browser) await browser.close();
    await app.close();
  }
});
