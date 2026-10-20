// Requires Playwright and Chromium. Example:
// NODE_PATH=/tmp/ibn-transfer-tests/node_modules node --test tests/transfer-browser.test.cjs
// Serves existing public files temporarily; does not start or replace the backend.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const captureDir = process.env.TRANSFER_CAPTURE_DIR;

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
          await page.waitForFunction(() =>
            [...document.querySelectorAll('#ibn-finance-services img')]
              .every(img => img.complete && img.naturalWidth > 0));
          assert.equal(await page.locator('#ibn-finance-services img').count(), data.services.length);
          assert.equal(await page.locator('#ibn-finance-services .is-fallback').count(), 0);
          for (const img of await page.locator('#ibn-finance-services img').all()) {
            assert.ok(await img.getAttribute('alt'));
            assert.equal(await img.evaluate(el => getComputedStyle(el).objectFit), 'contain');
          }
          assert.equal(await page.locator('.ibn-transfer-sheet').evaluate(el => el.scrollWidth <= el.clientWidth), true);
          if (captureDir && route === '/' && country === 'Niger') {
            fs.mkdirSync(captureDir, { recursive: true });
            await page.screenshot({ path: path.join(captureDir, `finance-${viewport.width}.png`) });
          }
          assert.deepEqual(await page.locator('#ibn-finance-services strong').allTextContents()
            .then(names => names.map(name => name.trim())), Array.from(data.services, service => service[0]));
          const links = await page.locator('#ibn-finance-services .ibn-finance-service-card').evaluateAll(elements => elements.map(a => ({
            href: a.href, target: a.target, rel: a.rel
          })));
          assert.deepEqual(links.map(link => link.href), Array.from(data.services, service => service[1]));
          for (const link of links) {
            assert.equal(link.target, '_blank');
            assert.equal(link.rel, 'noopener noreferrer');
          }
          assert.equal(await page.locator('[data-finance-contact="whatsapp"]').count(), data.services.length);
          assert.equal(await page.locator('[data-finance-contact="phone"]').count(), data.services.length);
        }
        assert.doesNotMatch(await page.locator('#ibn-transfer-sheet-overlay').textContent(), /al[\s-]*izza/i);
        const bounds = await page.locator('.ibn-transfer-sheet').boundingBox();
        assert.ok(bounds.width <= viewport.width);
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.body.classList.contains('ibn-no-scroll')), false);
        if (route === '/') {
          await page.locator('#ibn-transfer-catalogue-card').click();
          await assertSheet(page);
          assert.equal(await page.locator('#service-detail').count(), 0);
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
          // The retired text dashboards are replaced by actual catalogue details.
          await page.locator('.ibn-cat-card[data-id="starlink-standard-x"] .ibn-cat-cta').click();
          await visible(page, '.ibn-modal.open');
          assert.match(await page.locator('#ibn-detail-heading').innerText(), /Starlink/);
          await page.keyboard.press('Escape');
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

test('clicking a card or its action opens one correct new tab; missing logos have a visible fallback', { timeout: 45000 }, async () => {
  await fixture(async ({ browser, base }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await context.route('https://www.nitatransfert.com/**', route =>
      route.fulfill({ contentType: 'text/html', body: '<p>Outbound link test fixture</p>' }));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('#ibn-transfer-catalogue-card').click();
    for (const selector of ['.ibn-finance-service-logo', '.ibn-finance-service-action']) {
      const opened = [];
      const track = popup => opened.push(popup);
      context.on('page', track);
      const popupPromise = context.waitForEvent('page');
      await page.locator('.ibn-finance-service-card').first().locator(selector).click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(popup.url(), finance.Niger.services[0][1]);
      assert.equal(opened.length, 1);
      assert.equal(await popup.evaluate(() => window.opener === null), true);
      context.off('page', track);
      await popup.close();
    }
    await page.keyboard.press('Escape');
    await page.route('**/media/services/nita.webp*', route => route.abort());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#ibn-transfer-catalogue-card').click();
    const fallback = page.locator('.ibn-finance-service-card').first();
    await fallback.locator('.is-fallback').waitFor();
    assert.equal(await fallback.locator('img').isVisible(), false);
    assert.equal(await fallback.locator('.ibn-finance-logo-fallback').isVisible(), true);
    assert.equal(await fallback.getAttribute('href'), finance.Niger.services[0][1]);
    await page.locator('.ibn-transfer-sheet-close').click();
    await context.close();
  });
});

test('country and service selection leads to contextual WhatsApp and telephone contacts on Android', { timeout: 45000 }, async () => {
  await fixture(async ({ browser, base }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      serviceWorkers: 'block'
    });
    // Verify navigation without sending a real WhatsApp message or transaction.
    await context.route('https://wa.me/**', route =>
      route.fulfill({ contentType: 'text/html', body: '<p>Contact navigation test only</p>' }));
    try {
      const page = await context.newPage();
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('#ibn-transfer-catalogue-card').click();
      await page.locator('[data-country="Benin"]').click();
      const service = page.locator('.ibn-finance-service-item').first();
      assert.equal((await service.locator('strong').textContent()).trim(), 'MTN MoMo');
      assert.match(await page.locator('#ibn-transfer-sheet-overlay').textContent(), /aucune transaction financière/);
      const opened = context.waitForEvent('page');
      await service.locator('[data-finance-contact="whatsapp"]').click();
      const popup = await opened;
      await popup.waitForLoadState();
      const destination = new URL(popup.url());
      assert.equal(destination.hostname, 'wa.me');
      assert.equal(destination.pathname, '/22796784870');
      assert.match(destination.searchParams.get('text'), /MTN MoMo/);
      assert.match(destination.searchParams.get('text'), /Benin/);
      assert.equal(await popup.evaluate(() => window.opener === null), true);
      await popup.close();
      const call = service.locator('[data-finance-contact="phone"]');
      assert.equal(await call.getAttribute('href'), 'tel:+22791445187');
      // Exercise the button without placing a telephone call.
      await call.evaluate(link => link.addEventListener('click', event => {
        event.preventDefault();
        link.dataset.testActivated = 'true';
      }, { once: true }));
      await call.click();
      assert.equal(await call.getAttribute('data-test-activated'), 'true');
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, 'finance-contact-android.png') });
      }
    } finally {
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
    // Finish the app's first-install update job before changing the fixture
    // response. Browsers may coalesce concurrent update() calls into that job.
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    useOldWorker(false);
    // Cache deletion precedes clients.claim(): wait for the actual replacement
    // navigation, not just disappearing caches and DOM from the previous page.
    const reloaded = page.waitForEvent('framenavigated', {
      predicate: frame => frame === page.mainFrame(), timeout: 20000
    });
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await reloaded;
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
