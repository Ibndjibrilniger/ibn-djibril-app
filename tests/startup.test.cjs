'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {publicFixture} = require('./support/public-fixture.cjs');

test('launch has a genuinely visible moving indicator, without forced delay or reduced-motion override',
  {timeout:45000}, async () => {
    await publicFixture(async ({browser,base}) => {
      for (const reducedMotion of ['no-preference','reduce']) {
        const context=await browser.newContext({viewport:{width:360,height:640},reducedMotion});
        await context.addInitScript(()=>localStorage.setItem('ibn_pwa_installed','1'));
        let release;
        const gate=new Promise(resolve=>{release=resolve});
        await context.route('**/catalogue-ultra.js*',async route=>{
          await gate;
          await route.continue();
        });
        const page=await context.newPage();
        try {
          await page.goto(base,{waitUntil:'commit'});
          const splash=page.locator('#ibn-launch-splash');
          await splash.waitFor({state:'visible'});
          const loader=splash.locator('.ibn-splash-loader');
          assert.equal(await loader.isVisible(),true,'a hidden animation is not a loading indicator');
          assert.equal(await loader.evaluate(el=>getComputedStyle(el,'::after').animationName),'splash-progress');
          const before=await loader.evaluate(el=>getComputedStyle(el,'::after').transform);
          await page.waitForTimeout(180);
          const after=await loader.evaluate(el=>getComputedStyle(el,'::after').transform);
          if(reducedMotion==='no-preference') {
            assert.notEqual(before,after,'the visible bar must actually move');
            assert.ok(await splash.evaluate(el=>el.getAnimations({subtree:true}).some(a=>a.playState==='running')));
          } else {
            assert.equal(before,after,'reduced motion must stop continuous movement');
          }
          assert.equal(await splash.locator('progress').count(),1,'keep indeterminate progress semantics');
          release();
          await page.waitForFunction(()=>window.IbnLaunch?.status==='ready');
          await splash.waitFor({state:'detached'});
        } finally {
          release();
          await context.close();
        }
      }
    });
  });

test('mobile startup: immediate readiness, honest slow timeout/retry, reduced motion and installed PWA',
  {timeout:90000}, async () => {
    await publicFixture(async ({browser, base}) => {
      const measurements = [];
      for (const profile of ['normal', 'slow', 'standalone']) {
        const context = await browser.newContext({
          viewport:{width:390,height:844}, isMobile:true, hasTouch:true,
          reducedMotion:profile === 'standalone' ? 'reduce' : 'no-preference'
        });
        await context.addInitScript(standalone => {
          localStorage.setItem('ibn_pwa_installed','1');
          if (standalone) {
            const original = window.matchMedia.bind(window);
            window.matchMedia = query => query === '(display-mode: standalone)'
              ? {matches:true} : original(query);
          }
        }, profile === 'standalone');
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        if (profile === 'slow') await cdp.send('Network.emulateNetworkConditions', {
          offline:false,latency:150,downloadThroughput:200*1024,uploadThroughput:75*1024
        });
        await page.goto(base,{waitUntil:'load'});
        await page.waitForFunction(() => window.IbnLaunch?.status === 'ready');
        const stats = await page.evaluate(profile => ({
          profile,
          domReadyMs:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
          loadMs:performance.getEntriesByType('navigation')[0].loadEventEnd,
          homeReadyMs:performance.getEntriesByName('ibn:home-ready')[0].startTime,
          resourceBytes:performance.getEntriesByType('resource').reduce((n,r)=>n+r.transferSize,0),
          logoBytes:performance.getEntriesByType('resource').filter(r=>r.name.includes('/icons/logo')).reduce((n,r)=>n+r.transferSize,0),
          sources:[...document.images].map(i=>i.currentSrc)
        }),profile);
        assert.ok(stats.homeReadyMs < (profile === 'slow' ? 5000 : 3000),JSON.stringify(stats));
        assert.ok(stats.sources.some(src => src.endsWith('/optimized/transfert-money-logo.webp')));
        assert.ok(stats.logoBytes < 100000,'small unmodified official-logo derivative');
        delete stats.sources;
        measurements.push(stats);
        await page.locator('#ibn-launch-splash').waitFor({state:'detached'});
        await context.close();
      }
      fs.mkdirSync('generated-artifacts/startup',{recursive:true});
      fs.writeFileSync('generated-artifacts/startup/after.json',JSON.stringify(measurements,null,2));
      console.log('STARTUP_MEASUREMENTS',JSON.stringify(measurements));

      const fallbackContext = await browser.newContext();
      await fallbackContext.addInitScript(() => localStorage.setItem('ibn_pwa_installed','1'));
      await fallbackContext.route('**/optimized/*.webp', route => route.abort());
      const fallbackPage = await fallbackContext.newPage();
      await fallbackPage.goto(base,{waitUntil:'networkidle'});
      const transferImage = fallbackPage.locator('#ibn-transfer-catalogue-card img');
      assert.equal(await transferImage.evaluate(image => image.complete && image.naturalWidth > 0),true);
      assert.match(await transferImage.evaluate(image => image.currentSrc),/transfert-money-logo\.png/);
      await fallbackContext.close();

      const context = await browser.newContext({viewport:{width:320,height:640}});
      await context.addInitScript(() => localStorage.setItem('ibn_pwa_installed','1'));
      let requests = 0;
      await context.route('**/catalogue-ultra.js*', async route => {
        requests++;
        await route.abort();
      });
      const page = await context.newPage();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(3200);
      assert.match(await page.locator('.ibn-splash-message').textContent(),/Connexion lente/);
      await page.locator('#ibn-launch-splash.is-error').waitFor({timeout:10000});
      assert.match(await page.locator('.ibn-splash-message').textContent(),/réessayez/);
      await page.screenshot({path:'generated-artifacts/startup/retry-320.png'});
      await page.getByRole('button',{name:'Réessayer',exact:true}).click();
      await page.waitForFunction(() => window.IbnLaunch?.status === 'loading');
      assert.ok(requests >= 2, 'retry performs real navigation');
      await context.close();
    });
  });

test('installed worker caches only public derivatives and gives a clear offline recovery page',
  {timeout:45000}, async () => {
    await publicFixture(async ({browser,base}) => {
      const context = await browser.newContext();
      await context.addInitScript(() => localStorage.setItem('ibn_pwa_installed','1'));
      const page = await context.newPage();
      await page.goto(base,{waitUntil:'networkidle'});
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
      });
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      await page.evaluate(async () => {
        await fetch('/icons/logo-display-v1.webp');
        await fetch('/api/prices');
      });
      const urls = await page.evaluate(async () => {
        const keys = await caches.keys();
        return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(r=>r.url)))).flat();
      });
      assert.ok(urls.some(url=>url.endsWith('/icons/logo-display-v1.webp')));
      assert.ok(urls.every(url=>url.includes('/optimized/') || url.endsWith('/icons/logo-display-v1.webp')));
      await context.setOffline(true);
      const response = await page.goto(base,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),503);
      assert.match(await page.locator('body').textContent(),/Connexion indisponible/);
      assert.equal(await page.getByRole('link',{name:'Réessayer'}).count(),1);
      await context.setOffline(false);
      await page.getByRole('link',{name:'Réessayer'}).click();
      await page.waitForFunction(()=>window.IbnLaunch?.status === 'ready');
      await context.close();
    });
  });
