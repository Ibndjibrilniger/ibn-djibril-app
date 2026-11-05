'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { fixture } = require('./support/admin-fixture.cjs');
const { localDateKey } = require('../wifi-business-periods');

test('public Wi-Fi Zone card is commercial only; receipts are accessible inside authenticated Admin', { timeout: 90000 }, async () => {
  const f = await fixture();
  let browser;
  try {
    const day = localDateKey();
    const cookie = await f.login();
    const seeded = await fetch(f.base + '/api/admin/wifi-business/reports', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: day, to: day, amountFcfa: 61937, note: 'Rapport MikroTik Ticket de test isolé' })
    });
    assert.equal(seeded.status, 201);
    await seeded.arrayBuffer();
    for (const [query, expected] of [
      ['?section=wifi-zones', '/admin/wifi-business#recettes'],
      ['?section=https://example.invalid&returnTo=//example.invalid', '/admin'],
      ['', '/admin']
    ]) {
      const r = await fetch(f.base + '/admin/login' + query, { headers: { Cookie: cookie }, redirect: 'manual' });
      assert.equal(r.status, 302); assert.equal(r.headers.get('location'), expected);
      await r.arrayBuffer();
    }
    const rejected = await fetch(f.base + '/admin/login?section=wifi-zones', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: f.username, password: 'deliberately-invalid-fixture-password' })
    });
    assert.equal(rejected.status, 401);
    assert.match(await rejected.text(), /href="\/admin\/login\?section=wifi-zones"/);
    const guard = await fetch(f.base + '/api/admin/wifi-business/reports');
    assert.equal(guard.status, 401);
    await guard.arrayBuffer();

    browser = await chromium.launch({ executablePath: '/repl/tools/bin/chromium', headless: true, args: ['--no-sandbox'] });
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => {
        localStorage.setItem('ibn_pwa_installed', '1');
        localStorage.setItem('ibn_activity_consent_v1', 'refused');
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [], privateReads = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().includes('/api/admin/wifi-business/')) privateReads.push(request.url()); });
      await page.goto(f.base, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-open-services]');
      const refuse = page.getByRole('button', { name: 'Refuser les statistiques', exact: true });
      if (await refuse.isVisible()) await refuse.click();
      assert.equal(await page.locator('.ibn-featured-categories > *').count(), 6);
      assert.equal((await page.locator('body').textContent()).includes('61937'), false);
      assert.deepEqual(privateReads, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('a[href*="/admin"], .ibn-wifi-admin-link').count(), 0);
      await page.locator('[data-open-services]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/wifi-zone-entry-${viewport.width}.jpg`, type: 'jpeg', quality: 80 });
      // The existing commercial opening still works, with all original offers.
      await page.locator('[data-open-services]').click();
      await page.waitForSelector('#ibn-detail-heading');
      assert.match(await page.locator('.ibn-sheet').textContent(), /Wi-Fi Business Pro/);
      assert.equal(await page.locator('.ibn-sheet a[href*="/admin"], .ibn-wifi-private-access').count(), 0);
      assert.doesNotMatch(await page.locator('.ibn-sheet').textContent(), /Gestion privée|mes recettes|connexion Admin/);
      await page.keyboard.press('Escape');
      await page.goto(f.base + '/admin');
      await page.waitForURL('**/admin/login');
      assert.equal(await page.locator('form').getAttribute('action'), null);
      assert.deepEqual(privateReads, []);
      await page.fill('input[name="username"]', f.username);
      await page.fill('input[name="password"]', f.password);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL('**/admin');
      await page.getByRole('link', { name: 'Gérer mes Wi-Fi Zones — Recettes', exact: true }).click();
      await page.waitForURL('**/admin/wifi-business#recettes');
      await page.waitForFunction(() => document.querySelector('#metric-global-revenue').textContent.replace(/\s/g, '') === '61937FCFA');
      assert.equal(await page.locator('.brand h1').textContent(), 'Gestion des Wi-Fi Zones');
      assert.equal(await page.locator('#tab-reports').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#reports-add-button').isVisible(), true);
      assert.match(await page.locator('#panel-reports').textContent(), /MikroTik Ticket/);
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser?.close(); await f.close(); }
});
