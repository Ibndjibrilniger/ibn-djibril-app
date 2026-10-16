'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { publicFixture } = require('./support/public-fixture.cjs');

const baseline = { window: {} };
for (const file of ['catalogue-data.js', 'prix-produits.js']) {
  vm.runInNewContext(fs.readFileSync('public/' + file, 'utf8'), baseline);
}
const original = JSON.parse(JSON.stringify(baseline.window.IBN_CATALOGUE));

async function prepare(browser, base, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('ibn_pwa_installed', '1'));
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.ibn-cat-card[data-id="starlink-standard-x"]').waitFor();
  return { context, page };
}

test('one modern catalogue preserves all original product fields, prices and photos on Android and desktop',
  { timeout: 120000 }, async () => {
    await publicFixture(async ({ browser, base }) => {
      for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
        const { context, page } = await prepare(browser, base, viewport);
        assert.equal(await page.locator('#ibn-catalogue-ultra').count(), 1);
        assert.equal(await page.locator('main > .services, #produits, #service-detail').count(), 0);
        const actual = await page.evaluate(() => window.IBN_CATALOGUE);
        assert.equal(new Set(actual.map(p => p.id)).size, actual.length, 'No duplicate products');
        for (const product of original) {
          assert.deepEqual(actual.find(p => p.id === product.id), product, product.id);
        }
        const search = page.locator('.ibn-cat-search');
        for (const product of original) {
          await search.fill(product.name);
          const card = page.locator(`.ibn-cat-card[data-id="${product.id}"]`);
          assert.equal(await card.count(), 1, product.id);
          assert.equal((await card.locator('.ibn-price').innerText()).trim(), product.price);
        }
        await search.fill('aucun-produit-correspondant-xyz');
        assert.equal(await page.locator('.ibn-cat-card[data-id="starlink-standard-x"]').count(), 0);
        assert.equal(await page.locator('#ibn-transfer-catalogue-card').count(), 1,
          'Transfers stay accessible after every catalogue rerender');
        await search.fill('');
        const first = page.locator('.ibn-cat-card[data-id="starlink-standard-x"]');
        await first.click({ position: { x: 40, y: 50 } });
        await page.locator('.ibn-modal.open').waitFor();
        assert.match(await page.locator('.ibn-modal.open').innerText(), /305 000 FCFA/);
        assert.ok(await page.locator('.ibn-modal.open img').count() > 0);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.ibn-modal.open'));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
          'No horizontal overflow on small Android screens');
        await context.close();
      }
    });
  });

test('cart quantities, persistence, negotiable totals and WhatsApp ordering remain functional',
  { timeout: 60000 }, async () => {
    await publicFixture(async ({ browser, base }) => {
      const { context, page } = await prepare(browser, base, { width: 390, height: 844 });
      const search = page.locator('.ibn-cat-search');
      const add = async id => {
        await search.fill(original.find(p => p.id === id).name);
        await page.locator(`.ibn-add-cart[data-id="${id}"]`).click();
        assert.equal(await page.locator('.ibn-modal.open').count(), 0, 'Adding must not also open details');
      };
      await add('mikrotik-hap-ax3');
      await add('cudy-wr3000');
      await page.locator('#ibn-cart-float').click();
      await page.locator('#ibn-cart-overlay.open').waitFor();
      assert.equal(await page.locator('.ibn-cart-item').count(), 2);
      assert.match(await page.locator('#ibn-cart-total-value').innerText(), /105\s*000 FCFA/);
      assert.match(await page.locator('#ibn-cart-negotiable').innerText(), /1 produit/);
      const priced = page.locator('[data-cart-id="mikrotik-hap-ax3"]');
      await priced.locator('.ibn-plus').click();
      assert.equal(await page.locator('#ibn-cart-count').innerText(), '3');
      await priced.locator('.ibn-minus').click();
      assert.equal(await page.locator('#ibn-cart-count').innerText(), '2');
      await page.locator('#ibn-client-name').fill('Client de test');
      await page.locator('#ibn-client-phone').fill('90000000');
      await page.evaluate(() => {
        window.__orders = [];
        window.open = url => { window.__orders.push(url); return null; };
      });
      await page.locator('#ibn-send-order').click();
      const orders = await page.evaluate(() => window.__orders);
      assert.equal(orders.length, 1);
      const order = new URL(orders[0]);
      assert.equal(order.hostname, 'wa.me');
      assert.equal(order.pathname, '/22796784870');
      assert.match(order.searchParams.get('text'), /MikroTik hAP ax³ × 1/);
      assert.match(order.searchParams.get('text'), /Cudy WR3000 × 1 — Prix à discuter/);
      assert.match(order.searchParams.get('text'), /105\s*000 FCFA/);
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('#ibn-cart-count').innerText(), '2');
      await page.locator('#ibn-cart-float').click();
      await page.locator('[data-cart-id="cudy-wr3000"] .ibn-remove').click();
      assert.equal(await page.locator('#ibn-cart-count').innerText(), '1');
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ibn_djibril_panier_v1')));
      assert.deepEqual(stored, { 'mikrotik-hap-ax3': 1 });
      await context.close();
    });
  });

test('phone collection, all legacy offer amounts, keyboard focus and browser Back are preserved',
  { timeout: 60000 }, async () => {
    await publicFixture(async ({ browser, base }) => {
      const { context, page } = await prepare(browser, base, { width: 390, height: 844 });
      const phone = page.locator('[data-open-phone]');
      await phone.click();
      await page.locator('.ibn-modal.open .ibn-phone-list').waitFor();
      const items = await page.locator('.ibn-phone-list li').allTextContents();
      assert.equal(items.length, 16);
      for (const phrase of ['Tecno, Samsung et Itel', 'Téléphones à boutons', 'itel IT5606',
        'chargeurs rapides', 'Oraimo', 'Écouteurs filaires et Bluetooth', 'Casques Bluetooth',
        'USB, Type-C', 'Power banks', 'Haut-parleurs Bluetooth', 'Radios', 'Anti-chocs',
        'Pochettes et étuis', 'Protections écran', 'Cartes mémoire', 'multiprises, fils et câbles électriques']) {
        assert.ok(items.some(item => item.includes(phrase)), phrase);
      }
      assert.equal(await page.locator('.ibn-phone-negotiable').innerText(), 'Tous les prix sont à discuter');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(() => document.activeElement.closest('.ibn-modal.open') !== null), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('.ibn-close').evaluate(el => el === document.activeElement), true);
      await page.goBack();
      await page.waitForFunction(() => !document.querySelector('.ibn-modal.open'));
      assert.equal(await phone.evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('main .ibn-supplement-card').count(), 0,
        'No replacement legacy text dashboard on the homepage');
      await page.locator('[data-open-offers]').click();
      await page.locator('.ibn-modal.open').waitFor();
      const references = await page.locator('.ibn-modal.open').textContent();
      for (const amount of ['305 000 FCFA', '75 000 FCFA', '47 000 FCFA/mois', '32 000 FCFA/mois',
        '42 000 FCFA', '105 000 FCFA', '95 000 FCFA', '70 000 FCFA', '590 000 FCFA',
        '520 000 FCFA', '85 000 FCFA / unité', '60 000 FCFA / unité', '105 000 FCFA / unité',
        '35 000 FCFA / unité', '300 FCFA / mètre', '12 000 FCFA']) assert.ok(references.includes(amount), amount);
      const legacy = page.locator('.ibn-modal.open details').filter({ hasText: 'Offre crédit' });
      await legacy.locator('summary').click();
      assert.match(await legacy.innerText(), /pendant 6 mois/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.ibn-modal.open'));
      await context.close();
    });
  });

test('launch splash cannot block a ready catalogue when logos or its script fail',
  { timeout: 45000 }, async () => {
    await publicFixture(async ({ browser, base }) => {
      for (const reducedMotion of ['reduce', 'no-preference']) {
        const context = await browser.newContext({ viewport: { width: 360, height: 780 }, reducedMotion });
        await context.addInitScript(() => localStorage.setItem('ibn_pwa_installed', '1'));
        await context.route('**/icons/logo.png', route => route.abort());
        await context.route('**/commerce-launch.js*', route => route.abort());
        const page = await context.newPage();
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.locator('.ibn-cat-card[data-id="starlink-standard-x"]').waitFor();
        await page.waitForFunction(() => {
          const splash = document.querySelector('#ibn-launch-splash');
          return !splash || getComputedStyle(splash).visibility === 'hidden';
        }, null, { timeout: 5000 });
        await page.locator('[data-open-phone]').click();
        await page.locator('.ibn-modal.open').waitFor();
        await page.keyboard.press('Escape');
        await context.close();
      }
    });
  });
