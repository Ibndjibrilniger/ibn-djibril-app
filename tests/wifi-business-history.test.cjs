'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./support/admin-fixture.cjs');

test('historical all-zone receipts persist separately from tickets, reject overlap and support calendar UI', { timeout: 180000 }, async () => {
  const app = await fixture();
  let browser;
  try {
    const cookie = await app.login();
    const api = '/api/admin/wifi-business';
    async function json(path, method = 'GET', body, authenticated = true, origin) {
      const response = await fetch(app.base + path, { method, redirect: 'manual', headers: {
        Accept: 'application/json', ...(authenticated ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(origin ? { Origin: origin } : {})
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : null };
    }
    const sample = { from: '1999-01-01', to: '1999-01-31', amountFcfa: 10000, note: 'Rapport papier janvier 1999 <img src=x onerror=alert(1)>' };
    assert.equal((await json(api + '/reports', 'GET', undefined, false)).status, 401);
    assert.equal((await json(api + '/reports', 'POST', sample, false)).status, 401);
    assert.equal((await json(api + '/reports/export.csv', 'GET', undefined, false)).status, 401);
    assert.equal((await json(api + '/reports/1/void', 'POST', { reason: 'Annulation de contrôle' }, false)).status, 401);
    const asset = await fetch(app.base + '/admin/wifi-business/wifi-business-history.js', { redirect: 'manual' });
    assert.equal(asset.status, 302);
    assert.equal((await json(api + '/reports', 'POST', sample, true, 'https://example.invalid')).status, 403);
    for (const patch of [{ from: '1998-12-31' }, { to: '1999-02-30' }, { from: '2999-01-01', to: '2999-01-31' },
      { from: '1999-02-01' }, { amountFcfa: -1 }, { amountFcfa: 1.5 }, { amountFcfa: '100' }, { amountFcfa: 1000000001 }, { note: '' }]) {
      assert.equal((await json(api + '/reports', 'POST', { ...sample, ...patch })).status, 400);
    }
    const created = await json(api + '/reports', 'POST', sample);
    assert.equal(created.status, 201);
    assert.equal(created.data.report.amountFcfa, 10000);
    assert.equal((await json(api + '/reports', 'POST', sample)).status, 409);
    assert.equal((await json(api + '/reports', 'POST', { ...sample, from: '1999-01-31', to: '1999-02-02' })).status, 409);
    const zero = await json(api + '/reports', 'POST', { from: '2000-02-01', to: '2000-02-29', amountFcfa: 0, note: 'Rapport confirmé sans recette' });
    assert.equal(zero.status, 201);
    const partial = await json(api + '/reports?from=1999-01-15&to=1999-01-20');
    assert.equal(partial.data.rows.length, 1);
    assert.equal(partial.data.rows[0].included, false);
    assert.equal(partial.data.summary.totalFcfa, 0);
    assert.equal(partial.data.summary.coveredDays, 0);
    assert.equal(partial.data.summary.dailyAverageFcfa, null);
    assert.equal(partial.data.summary.partialCount, 1);

    const zone = (await json(api + '/zones')).data.zones[0];
    await app.client.query("UPDATE wifi_business_zones SET commercial_status='active' WHERE id=$1", [zone.id]);
    assert.equal((await json(api + '/sales', 'POST', {
      zoneId: zone.id, planCode: '2h', amountFcfa: 1250, ticketCount: 2, soldAt: '1999-01-15T12:00'
    })).status, 201);
    const dashboard = (await json(api + '/dashboard?range=custom&from=1999-01-01&to=2026-01-01')).data;
    assert.equal(dashboard.summary.revenueFcfa, 1250);
    assert.equal(dashboard.summary.ticketsSold, 2);
    assert.equal(dashboard.globalReports.totalFcfa, 10000);
    assert.equal(dashboard.globalReports.coveredDays, 60);
    assert.equal(dashboard.seriesGranularity, 'month');
    assert.ok(dashboard.series.length < 350);
    assert.equal(dashboard.series.reduce((sum, row) => sum + row.revenueFcfa, 0), 1250);
    app.wifiBusiness.stop(); await app.wifiBusiness.start();
    assert.equal((await json(api + '/reports?from=1999-01-01&to=1999-01-31')).data.summary.totalFcfa, 10000);
    const csv = await fetch(app.base + api + '/reports/export.csv?from=1999-01-01&to=2000-02-29', { headers: { Cookie: cookie } });
    assert.equal(csv.status, 200);
    assert.match(await csv.text(), /10000.*Rapport papier/s);

    browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const [name, ...value] = cookie.split('=');
    await context.addCookies([{ name, value: value.join('='), url: app.base }]);
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(app.base + '/admin/wifi-business');
    await page.waitForSelector('#sales-chart svg');
    await page.locator('[data-range="month"]').click();
    assert.equal(await page.locator('#tab-reports').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#reports-month option').count(), 12);
    assert.equal(await page.locator('#reports-year option').last().getAttribute('value'), '1999');
    const currentYear = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Niamey', year: 'numeric' }).format(new Date());
    assert.equal(await page.locator('#reports-year option').first().getAttribute('value'), currentYear);
    assert.equal(await page.locator('#filter-from').getAttribute('min'), '1999-01-01');
    await page.selectOption('#reports-year', '1999');
    await page.selectOption('#reports-month', '3');
    assert.match(await page.locator('#reports-range-preview').textContent(), /30 avril 1999/);
    await page.selectOption('#reports-month', '1');
    assert.match(await page.locator('#reports-range-preview').textContent(), /28 février 1999/);
    async function month(year, monthValue, from) {
      await page.selectOption('#reports-year', year);
      await page.selectOption('#reports-month', String(Number(monthValue) - 1));
      await page.locator('#reports-apply-month').click();
      await page.waitForFunction(date => document.querySelector('#metric-period').textContent.startsWith(date), from);
      await page.waitForFunction(() => document.querySelector('#reports-state').hidden || !document.querySelector('#reports-state').textContent.includes('Chargement'));
    }
    await month('2000', '2', '2000-02-01');
    assert.match(await page.locator('#metric-period').textContent(), /2000-02-29/);
    await page.waitForFunction(() => document.querySelector('#reports-coverage').textContent.includes('29'));
    assert.match(await page.locator('#metric-global-revenue').textContent(), /^0 FCFA$/);
    assert.equal(await page.locator('#reports-average').textContent(), '0 FCFA');
    await month('1999', '1', '1999-01-01');
    await page.waitForSelector('#reports-chart svg');
    assert.equal((await page.locator('#metric-global-revenue').textContent()).replace(/\s/g, ''), '10000FCFA');
    assert.equal((await page.locator('#metric-revenue').textContent()).replace(/\s/g, ''), '1250FCFA');
    assert.equal(await page.locator('#reports-body img').count(), 0, 'report notes must remain inert text');
    await page.locator('#reports-apply-year').click();
    await page.waitForFunction(() => document.querySelector('#metric-period').textContent.includes('1999-12-31'));
    await month('2001', '11', '2001-11-01');
    assert.equal(await page.locator('#reports-total').textContent(), 'Non renseigné');
    assert.equal(await page.locator('#reports-average').textContent(), 'Non renseigné');
    await page.locator('#reports-add-button').click();
    await page.fill('#reports-form-from', '2001-11-01');
    await page.fill('#reports-form-to', '2001-11-30');
    await page.fill('#reports-form-amount', '30000');
    await page.fill('#reports-form-note', 'Rapport mensuel confirmé novembre 2001');
    await page.locator('#reports-submit').click();
    await page.waitForFunction(() => document.querySelector('#reports-receipt').textContent.includes('30'));
    await page.waitForFunction(() => document.querySelector('#reports-total').textContent.replace(/\s/g, '') === '30000FCFA');
    assert.match(await page.locator('#reports-body').textContent(), /Incluse/);
    assert.match(await page.locator('#reports-export').getAttribute('href'), /from=2001-11-01/);
    await page.locator('[data-range="custom"]').click();
    await page.fill('#filter-from', '1999-01-01');
    await page.locator('#filter-from').blur();
    await page.waitForFunction(() => document.querySelector('#metric-period').textContent.startsWith('1999-01-01'));
    await page.waitForFunction(() => document.querySelector('#reports-total').textContent.replace(/\s/g, '') === '40000FCFA');
    assert.match(await page.locator('#detailed-revenue-heading').textContent(), /par mois/);
    assert.deepEqual(await page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('[id]'), node => node.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    }), []);
    assert.equal(await page.locator('#reports-body tr').count(), 3);
    await page.locator('#panel-reports').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/wifi-history-desktop.jpg', type: 'jpeg', quality: 80, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: '/tmp/wifi-history-mobile.jpg', type: 'jpeg', quality: 80 });

    await month('2001', '11', '2001-11-01');
    await page.locator('#reports-body').getByRole('button', { name: /Annuler/ }).click();
    await page.fill('#reports-void-reason', 'Erreur de recopie du rapport, remplacement nécessaire');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#reports-void-submit').click();
    await page.waitForFunction(() => document.querySelector('#reports-body').textContent.includes('Annulée'));
    assert.equal((await json(api + '/reports?from=2001-11-01&to=2001-11-30')).data.summary.totalFcfa, 0);
    const replacement = await json(api + '/reports', 'POST', { from: '2001-11-01', to: '2001-11-30', amountFcfa: 31000, note: 'Rapport rectifié et vérifié' });
    assert.equal(replacement.status, 201);
    const journal = await json(api + '/audit?range=today');
    assert.ok(journal.data.rows.some(row => row.action === 'global_report_created'));
    assert.ok(journal.data.rows.some(row => row.action === 'global_report_voided' && row.reason.includes('recopie')));
    assert.equal((await json(api + '/reports/' + zero.data.report.id + '/void', 'POST', { reason: 'Correction documentée du relevé' })).status, 200);
    assert.equal((await json(api + '/reports/' + zero.data.report.id + '/void', 'POST', { reason: 'Correction documentée du relevé' })).status, 409);
    const logout = await fetch(app.base + '/admin/logout', { method: 'POST', headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(logout.status, 302);
    await page.locator('#refresh-all').click();
    await page.waitForSelector('#panel-reports a[href="/admin/login"]');
    assert.equal(await page.locator('#metric-global-revenue').textContent(), '—');
    assert.equal(await page.locator('#open-global-reports').isDisabled(), true);
    assert.equal(await page.locator('#reports-body').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
  } catch (error) {
    const page = browser?.contexts()[0]?.pages()[0];
    if (page) {
      await page.screenshot({ path: '/tmp/wifi-history-failure.jpg', type: 'jpeg', fullPage: true });
      console.error('HISTORY_UI_CHECK', await page.evaluate(() => ({
        period: document.querySelector('#metric-period')?.textContent,
        state: document.querySelector('#reports-state')?.textContent,
        feedback: document.querySelector('#reports-feedback')?.textContent
      })));
    }
    throw error;
  } finally { await browser?.close(); await app.close(); }
});
