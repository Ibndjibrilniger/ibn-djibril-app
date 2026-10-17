'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { chromium } = require('playwright');
const { publicFixture } = require('./support/public-fixture.cjs');
const registerSettings = require('../admin-settings-routes');

const categories = [
  'Services de transfert d’argent', 'Starlink et Internet satellite',
  'MikroTik et routeurs', 'Antennes et équipements réseau',
  'Installations Wi-Fi Zone et prestations techniques', 'Téléphones & Accessoires'
];
async function contextPage(browser, base, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('ibn_pwa_installed', '1'));
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  return { context, page };
}

test('six principal categories have the exact order and real targets on mobile and desktop', { timeout: 90000 }, async () => {
  await publicFixture(async ({ browser, base }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
      const { context, page } = await contextPage(browser, base, viewport);
      const names = await page.locator('.ibn-featured-categories > *').evaluateAll(nodes =>
        nodes.map(node => node.querySelector('h3,strong').textContent.trim()));
      assert.deepEqual(names, categories);
      await page.locator('#ibn-transfer-catalogue-card').click();
      await page.locator('#ibn-transfer-sheet-overlay').waitFor({ state: 'visible' });
      assert.match(await page.locator('#ibn-transfer-sheet-overlay').innerText(), /Niger/);
      await page.keyboard.press('Escape');
      await page.locator('[data-feature-categories="Starlink"]').click();
      const displayed = await page.locator('.ibn-cat-grid .ibn-cat-kicker').allTextContents();
      assert.ok(displayed.length > 0 && displayed.every(name => name === 'Starlink'));
      await page.locator('[data-feature-categories*="MikroTik"]').click();
      const network = await page.locator('.ibn-cat-grid .ibn-cat-kicker').allTextContents();
      assert.ok(network.includes('MikroTik'));
      assert.ok(network.every(name => ['MikroTik', 'Routeurs & Wi-Fi'].includes(name)));
      await page.locator('[data-open-services]').click();
      await page.locator('.ibn-modal.open').waitFor();
      const services = await page.locator('.ibn-modal.open').innerText();
      assert.match(services, /Wi-Fi Zone/);
      assert.match(services, /WhatsApp/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.ibn-modal.open'));
      await page.locator('[data-open-phone]').click();
      await page.locator('.ibn-phone-list').waitFor();
      assert.equal(await page.locator('.ibn-phone-list li').count(), 16);
      assert.equal(await page.locator('.ibn-phone-negotiable').innerText(), 'Tous les prix sont à discuter');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.ibn-modal.open'));
      assert.deepEqual(await page.locator('.ibn-featured-categories > *').evaluateAll(nodes =>
        nodes.map(node => node.querySelector('h3,strong').textContent.trim())), categories);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await context.close();
    }
  });
});

test('public settings persist real display changes, respect system motion, and keep private controls absent', { timeout: 90000 }, async () => {
  await publicFixture(async ({ browser, base }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
      const { context, page } = await contextPage(browser, base, viewport);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.locator('a[href="/parametres.html"]').first().click();
      await page.locator('#pref-theme').waitFor();
      await page.locator('#pref-theme').selectOption('dark');
      await page.locator('#pref-density').selectOption('compact');
      await page.locator('#pref-text-size').selectOption('large');
      await page.locator('#pref-motion').check();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal(await page.locator('html').getAttribute('data-density'), 'compact');
      assert.equal(await page.locator('html').getAttribute('data-text-size'), 'large');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('#pref-theme').inputValue(), 'dark');
      assert.equal(await page.locator('#pref-density').inputValue(), 'compact');
      assert.equal(await page.locator('#pref-text-size').inputValue(), 'large');
      assert.equal(await page.locator('#pref-motion').isChecked(), true);
      assert.match(await page.locator('body').innerText(), /français/);
      assert.equal(await page.locator('input[type="password"]').count(), 0);
      assert.equal(await page.locator('a[href^="/admin"]').count(), 0);
      assert.match(await page.locator('body').innerText(), /commerce-test/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('[data-testid="settings-back"]').click();
      await page.locator('#ibn-catalogue-ultra').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      const enlargedFont = await page.locator('.ibn-cat-card p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize));
      const darkBody = await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor);
      await page.evaluate(() => window.IBNPreferences.set({ theme: 'light', density: 'comfortable', textSize: 'standard', reducedMotion: false }));
      await page.waitForFunction(color => getComputedStyle(document.body).backgroundColor !== color, darkBody);
      assert.notEqual(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), darkBody);
      assert.ok(enlargedFont > await page.locator('.ibn-cat-card p').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize)));
      // OS reduced-motion remains in force even when the custom switch is off.
      const duration = await page.locator('.ibn-feature-tile').first().evaluate(el => getComputedStyle(el).transitionDuration);
      assert.ok(duration.split(',').every(value => parseFloat(value) <= 0.01));
      assert.equal(await page.locator('.ibn-feature-image img').first().evaluate(el => getComputedStyle(el).filter), 'none');
      await page.evaluate(() => window.IBNPreferences.set({ theme: 'system' }));
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
      await page.emulateMedia({ colorScheme: 'light' });
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      assert.deepEqual(errors, []);
      await context.close();
    }
  });
});

test('blocked preference storage is explicit and never crashes the public settings', { timeout: 45000 }, async () => {
  await publicFixture(async ({ browser, base }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage blocked', 'SecurityError'); }
    }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/parametres.html', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#ibn-pref-storage-status').isVisible(), true);
    await page.locator('#pref-theme').selectOption('dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.evaluate(() => window.IBNPreferences.get().storageAvailable), false);
    assert.deepEqual(errors, []);
    await context.close();
  });
});

test('private settings enforce actual Admin sessions, render signed-in UI, and do not alter price files', { timeout: 90000 }, async () => {
  const originals = ['data/prices.json', 'public/prix-produits.js'].map(file => [file, fs.readFileSync(file)]);
  // Ephemeral test credentials, confined to this child process. No production DB.
  delete process.env.DATABASE_URL;
  const username = 'settings-test-' + crypto.randomUUID();
  const password = crypto.randomBytes(32).toString('hex');
  process.env.ADMIN_USER = username;
  process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash(password, 4);
  process.env.SESSION_SECRET = crypto.randomBytes(48).toString('hex');
  const { app, activities } = require('../server');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const route of ['/admin/settings', '/admin/settings.js', '/admin/settings.css']) {
      const response = await fetch(base + route, { redirect: 'manual' });
      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), '/admin/login');
    }
    assert.equal((await fetch(base + '/api/admin/settings')).status, 401);
    assert.equal((await fetch(base + '/settings.html')).status, 404);
    for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
      const context = await browser.newContext({ viewport });
      const login = await context.request.post(base + '/admin/login', { form: { username, password }, maxRedirects: 0 });
      assert.equal(login.status(), 302);
      const privateResponse = await context.request.get(base + '/api/admin/settings');
      assert.match(privateResponse.headers()['cache-control'], /private/);
      const settings = await privateResponse.json();
      assert.equal(settings.synchronization.status, 'local');
      assert.equal(settings.synchronization.managedCount, Object.keys(require('../data/prices.json')).length);
      assert.equal(settings.notifications.available, false);
      for (const sensitive of ['SESSION_SECRET', 'DATABASE_URL', 'ADMIN_PASSWORD_HASH', password, username])
        assert.equal(JSON.stringify(settings).includes(sensitive), false);
      const page = await context.newPage();
      await page.goto(base + '/admin/settings', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.getElementById('settings-status').textContent.includes('actualisées'));
      assert.equal(await page.locator('[data-sync-status="local"]').count(), 1);
      assert.equal(await page.locator('#secure-cookie-notice').isVisible(), true);
      assert.match(await page.locator('#notifications-status').innerText(), /Aucun service/);
      await page.locator('#refresh-settings').click();
      await page.waitForFunction(() => !document.getElementById('refresh-settings').disabled);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#admin-pref-theme').selectOption('dark');
      await page.goto(base + '/admin/settings', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      assert.equal((await context.request.post(base + '/api/admin/settings', { data: {} })).status(), 404);
      await context.request.post(base + '/admin/logout');
      assert.equal((await context.request.get(base + '/api/admin/settings')).status(), 401);
      await context.close();
    }
    for (const [file, before] of originals) assert.deepEqual(fs.readFileSync(file), before);
  } finally {
    await browser.close();
    activities.stop();
    await new Promise(resolve => server.close(resolve));
    await require('../db').pool.end();
  }
});

test('private sync diagnostics preserve unmanaged scope and explicitly report a source failure without leaking errors', async () => {
  let failed = false;
  const app = express();
  registerSettings(app, (_req, _res, next) => next(), {
    hasDatabase: () => true,
    getVersion: () => 'test-version',
    sessionCookie: { maxAge: 7200000, httpOnly: true, sameSite: 'lax', secure: false },
    readManagedPrices: async () => {
      if (failed) throw new Error('secret-connection-string-must-not-leak');
      return { managed: { value: 100, label: '100 FCFA' } };
    },
    readLocalPrices: () => ({ managed: {}, outside: {} })
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/admin/settings';
  try {
    const available = await (await fetch(url)).json();
    assert.equal(available.synchronization.status, 'available');
    assert.equal(available.synchronization.managedCount, 1);
    assert.equal(available.synchronization.publicCount, 2);
    assert.equal(available.synchronization.preservedOutsideAdmin, 1);
    failed = true;
    const response = await fetch(url);
    assert.equal(response.status, 503);
    const unavailable = await response.json();
    assert.equal(unavailable.ok, false);
    assert.equal(unavailable.synchronization.status, 'unavailable');
    assert.equal(Object.hasOwn(unavailable.synchronization, 'managedCount'), false);
    assert.equal(JSON.stringify(unavailable).includes('secret-connection-string'), false);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
