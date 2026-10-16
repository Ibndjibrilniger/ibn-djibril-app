// Requires Playwright and Chromium. Example:
// NODE_PATH=/tmp/ibn-transfer-tests/node_modules node --test tests/transfer-browser.test.cjs
// Serves existing public files temporarily; does not start or replace the backend.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const financeSource = fs.readFileSync(path.join(root, 'public/accueil-catalogue-prioritaire.js'), 'utf8');
const finance = require('node:vm').runInNewContext(
  '(' + financeSource.match(/const financeData = (\{[\s\S]*?\n  \});/)[1] + ')'
);
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };

async function fixture(run) {
  let oldWorker = false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/api/app-version') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ version: 'transfer-browser-fixture' }));
      return;
    }
    if (url.pathname === '/sw.js' && oldWorker) {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(`
        self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
        self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
        self.addEventListener('fetch', e => {
          if (new URL(e.request.url).pathname.includes('accueil-catalogue-prioritaire.js')) {
            e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
          }
        });
      `);
      return;
    }
    const file = path.join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
    if (!file.startsWith(path.join(root, 'public') + path.sep)) {
      res.writeHead(403).end(); return;
    }
    fs.readFile(file, (error, body) => {
      if (error) { res.writeHead(404).end(); return; }
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      res.end(body);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium',
    headless: true, args: ['--no-sandbox']
  });
  try {
    await run({ browser, base, useOldWorker: value => { oldWorker = value; } });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

async function visible(page, selector) {
  await page.locator(selector).waitFor({ state: 'visible' });
}

async function assertSheet(page) {
  await visible(page, '#ibn-transfer-sheet-overlay.is-open');
  assert.equal(await page.locator('#ibn-transfer-sheet-overlay').count(), 1);
  assert.equal(await page.locator('[data-country]').count(), 6);
  assert.match(await page.locator('#ibn-finance-title').textContent(), /Niger/);
  const backgrounds = await page.locator('#ibn-finance-title').evaluate(el => getComputedStyle(el.parentElement).backgroundImage);
  assert.match(backgrounds, /rgb\(5, 3, 211\)/);
}

test('homepage and dashboard use identical finance UI on desktop and mobile', { timeout: 90000 }, async () => {
  await fixture(async ({ browser, base }) => {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        // Existing missing favicon is unrelated to the transfer flow.
        if (message.location().url.endsWith('/favicon.ico') &&
            /404/.test(message.text())) return;
        if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url}`);
      });
      for (const route of ['/', '/dashboard.html']) {
        const transferRequests = [];
        const onRequest = request => {
          if (new URL(request.url()).pathname.endsWith('/accueil-catalogue-prioritaire.js')) transferRequests.push(request.url());
        };
        page.on('request', onRequest);
        await page.goto(base + route, { waitUntil: 'networkidle' });
        page.off('request', onRequest);
        assert.equal(transferRequests.length, 1, `${route}: transfer script fetched once`);
        if (route === '/') {
          await page.locator('#ibn-transfer-catalogue-card').click();
        } else {
          await page.locator('[data-service="transferts"]').click();
          assert.equal(await page.locator('#overlay').getAttribute('aria-hidden'), 'true');
        }
        await assertSheet(page);
        assert.equal(await page.evaluate(() => document.body.classList.contains('ibn-no-scroll')), true);
        for (const [country, data] of Object.entries(finance)) {
          await page.locator(`[data-country="${country}"]`).click();
          assert.deepEqual(await page.locator('#ibn-finance-services strong').allTextContents()
            .then(names => names.map(name => name.trim())), Array.from(data.services, service => service[0]));
          const links = await page.locator('#ibn-finance-services a').evaluateAll(elements => elements.map(a => ({
            href: a.href, target: a.target, rel: a.rel
          })));
          assert.deepEqual(links.map(link => link.href), Array.from(data.services, service => service[1]));
          for (const link of links) {
            assert.equal(link.target, '_blank');
            assert.equal(link.rel, 'noopener noreferrer');
          }
        }
        assert.doesNotMatch(await page.locator('#ibn-transfer-sheet-overlay').textContent(), /al[\s-]*izza/i);
        const bounds = await page.locator('.ibn-transfer-sheet').boundingBox();
        assert.ok(bounds.width <= viewport.width);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.body.classList.contains('ibn-no-scroll')), false);
        if (route === '/') {
          await page.locator('.service').filter({ hasText: 'Services de transfert' }).click();
          await assertSheet(page);
          assert.equal(await page.locator('#service-detail').isVisible(), false);
          await page.locator('.ibn-transfer-sheet-close').click();
          await page.locator('#ibn-transfer-catalogue-card').focus();
          await page.keyboard.press('Enter');
          await assertSheet(page);
          await page.keyboard.press('Shift+Tab');
          assert.equal(await page.evaluate(() => document.activeElement.closest('#ibn-finance-services') !== null), true);
          await page.keyboard.press('Tab');
          assert.equal(await page.locator('.ibn-transfer-sheet-close').evaluate(el => el === document.activeElement), true);
          await page.keyboard.press('Escape');
          await page.keyboard.press('Space');
          await assertSheet(page);
          await page.locator('.ibn-transfer-sheet-close').click();
          // Other service details must still work after the title/titre fix.
          await page.locator('.service').first().click();
          await visible(page, '#service-detail');
          assert.ok((await page.locator('#detail-title').innerText()).length > 0);
          assert.ok(await page.locator('.ibn-cat-card').count() > 1);
        } else {
          await page.locator('[data-service="starlink"]').click();
          await visible(page, '#overlay.show');
          assert.match(await page.locator('#sheetTitle').textContent(), /Starlink/);
          await page.locator('#closeBtn').click();
          await page.locator('[data-service="transferts"]').click();
          await assertSheet(page);
          await page.locator('.ibn-transfer-sheet-close').click();
          assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        }
      }
      assert.deepEqual(errors, [], 'no JavaScript or console errors');
      await context.close();
    }
  });
});

test('installed PWA upgrades an old worker, clears stale transfer files, and reloads', { timeout: 60000 }, async () => {
  await fixture(async ({ browser, base, useOldWorker }) => {
    useOldWorker(true);
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
      const cache = await caches.open('ibn-djibril-legacy-test');
      const script = document.querySelector('script[src*="accueil-catalogue-prioritaire.js"]').src;
      await cache.put(script, new Response('window.legacyTransferLoaded = true;', {
        headers: { 'Content-Type': 'application/javascript' }
      }));
      await caches.open('unrelated-cache');
    });
    // Establish that the old worker really serves the seeded stale JavaScript.
    assert.match(await page.evaluate(async () => {
      const script = document.querySelector('script[src*="accueil-catalogue-prioritaire.js"]').src;
      return (await fetch(script)).text();
    }), /legacyTransferLoaded/);
    useOldWorker(false);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      return !keys.includes('ibn-djibril-legacy-test') &&
        !!document.querySelector('#ibn-transfer-catalogue-card') &&
        typeof window.openTransferSheet === 'function';
    });
    await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => window.legacyTransferLoaded), undefined);
    assert.equal(await page.evaluate(async () => (await caches.keys()).includes('unrelated-cache')), true);
    await page.locator('#ibn-transfer-catalogue-card').click();
    await assertSheet(page);
    // Verify a cached old script cannot be returned even after the upgrade.
    await page.evaluate(async () => {
      const cache = await caches.open('ibn-djibril-offline-test');
      await cache.put('/accueil-catalogue-prioritaire.js?v=old', new Response('stale-transfer'));
    });
    await context.setOffline(true);
    const offline = await page.evaluate(async () => {
      try { return await (await fetch('/accueil-catalogue-prioritaire.js?v=old')).text(); }
      catch { return 'network-failed'; }
    });
    assert.equal(offline, 'network-failed');
    assert.deepEqual(errors, []);
    await context.close();
  });
});
