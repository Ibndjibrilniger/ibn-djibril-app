const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const {chromium}=require('playwright');

async function fixture(t,initial='old') {
  const app=express();
  let release=initial;
  const currentWorker=fs.readFileSync(path.join(__dirname,'../public/sw.js'),'utf8');
  const legacyWorker=`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
    self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));`;
  app.get('/sw.js',(req,res)=>res.set('Cache-Control','no-store')
    .type('application/javascript').send(release==='old'?legacyWorker:currentWorker));
  app.get('/api/app-version',(req,res)=>res.set('Cache-Control','no-store').json({version:release}));
  app.use(express.static(path.join(__dirname,'../public'),{
    setHeaders:(res)=>res.setHeader('Cache-Control','no-store')
  }));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const browser=await chromium.launch({executablePath:'/repl/tools/bin/chromium',args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
  return {browser,url:`http://127.0.0.1:${server.address().port}`,upgrade:()=>{release='new';}};
}

test('resuming a warm mobile PWA installs the new worker, reloads once and keeps cart/preferences',async t=>{
  const f=await fixture(t);
  const context=await f.browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>localStorage.setItem('ibn_pwa_installed','1'));
  const page=await context.newPage();
  await page.goto(f.url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&localStorage.getItem('ibn_pwa_app_version')==='old');
  await page.evaluate(async()=>{
    localStorage.setItem('ibn-cart-preservation-probe','existing-cart');
    localStorage.setItem('ibn-preference-preservation-probe','existing-preference');
    await caches.open('ibn-djibril-v4');
    await caches.open('unrelated-cache');
  });
  let navigations=0;
  page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
  f.upgrade();
  await page.evaluate(()=>{
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
  });
  await page.waitForFunction(()=>localStorage.getItem('ibn_pwa_app_version')==='new'&&
    !sessionStorage.getItem('ibn_pwa_controller_refreshed')&&
    !!document.querySelector('#ibn-catalogue-ultra .ibn-cat-grid'),{},{timeout:20000});
  await page.waitForLoadState('networkidle');
  assert.equal(navigations,1,'one automatic replacement, not a reload loop');
  assert.equal(await page.locator('#ibn-pwa-update-modal').count(),0,'fresh content is not covered by a redundant update modal');
  const retained=await page.evaluate(async()=>({
    cart:localStorage.getItem('ibn-cart-preservation-probe'),
    preference:localStorage.getItem('ibn-preference-preservation-probe'),
    caches:await caches.keys()
  }));
  assert.equal(retained.cart,'existing-cart');
  assert.equal(retained.preference,'existing-preference');
  assert.ok(retained.caches.includes('unrelated-cache'));
  assert.ok(!retained.caches.includes('ibn-djibril-v4'));
  await context.close();
});

test('mobile install dismissal lasts 24 hours, uses the lightweight official photo and respects installed state',async t=>{
  const f=await fixture(t,'new');
  const context=await f.browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const prompt=()=>page.evaluate(()=>{
    const event=new Event('beforeinstallprompt',{cancelable:true});
    event.prompt=async()=>{window.installCalls=(window.installCalls||0)+1;};
    event.userChoice=Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(event);
  });
  await page.goto(f.url,{waitUntil:'networkidle'});
  await prompt();
  await page.locator('#ibn-pwa-install-overlay.is-open').waitFor();
  assert.equal(await page.locator('.ibn-pwa-logo').getAttribute('src'),'/icons/logo-display-v2.webp');
  await page.locator('#ibn-pwa-continue-btn').click();
  await prompt();
  assert.equal(await page.locator('#ibn-pwa-install-overlay.is-open').count(),0);
  assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('ibn-pwa-lock')),false);
  await page.reload({waitUntil:'networkidle'});
  await prompt();
  assert.equal(await page.locator('#ibn-pwa-install-overlay').count(),0,'a reload must not discard the refusal');
  await page.evaluate(()=>localStorage.setItem('ibn_pwa_last_install_prompt',String(Date.now()-25*60*60*1000)));
  await prompt();
  await page.locator('#ibn-pwa-install-overlay.is-open').waitFor();
  if(process.env.MOBILE_CAPTURE_DIR){
    fs.mkdirSync(process.env.MOBILE_CAPTURE_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.MOBILE_CAPTURE_DIR,'installation-mobile.png')});
  }
  await page.locator('#ibn-pwa-install-btn').click();
  await page.waitForFunction(()=>localStorage.getItem('ibn_pwa_installed')==='1');
  assert.equal(await page.evaluate(()=>window.installCalls),1);
  await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
  await prompt();
  assert.equal(await page.locator('#ibn-pwa-install-overlay').count(),0);
  await context.close();
});
