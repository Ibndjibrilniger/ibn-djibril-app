'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const store=require('../activities-store');
const {fixture}=require('./support/admin-fixture.cjs');
const {chromium}=require('playwright');
const uuid=()=>crypto.randomUUID();

test('analytics validation, privacy, device metadata and parameterized filters',()=>{
  const meta=store.metadata({get:name=>name==='user-agent'?'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Mobile Safari/604.1':''});
  assert.equal(meta.device,'mobile');assert.equal(meta.os,'iOS');assert.equal(meta.country,null);
  assert.equal(store.metadata({get:name=>name==='user-agent'?'Mozilla/5.0 (iPad) Safari/604.1':''}).device,'tablet');
  assert.equal(store.metadata({get:()=>''}).device,'unknown');
  const batch={visitor:uuid(),session:uuid(),password:'must-not-persist',events:[
    {id:uuid(),type:'page_view',page:'/',service:'',token:'must-not-persist'}]};
  const validated=store.validateBatch(batch,new Set(['/']),new Set());
  assert.equal(JSON.stringify(validated).includes('must-not-persist'),false);
  assert.throws(()=>store.validateBatch({...batch,events:[{...batch.events[0],page:'/?token=secret'}]},new Set(['/']),new Set()));
  assert.throws(()=>store.validateBatch({...batch,events:[{...batch.events[0],service:'password-content'}]},new Set(['/']),new Set()));
  assert.throws(()=>store.filters({from:'2026-02-30'}));
  assert.throws(()=>store.filters({from:'2026-02-10',to:'2026-02-01'}));
  assert.throws(()=>store.filters({type:'DROP TABLE'}));
  const injection="x' OR 1=1 --",f=store.filters({q:injection});
  assert.equal(f.where.includes(injection),false);
  assert.equal(f.values.includes('%'+injection+'%'),true);
  assert.equal(store.csvCell('=1+2'),'"\'=1+2"');
});

test('real PostgreSQL rollback-isolated admin login, price synchronization, tracking and private UI', {timeout:180000},async()=>{
  const app=await fixture();
  let browser;
  try {
    for (const route of ['/api/admin/prices','/api/admin/activities','/api/admin/activities/diagnostic','/api/admin/activities/export.csv','/api/admin/activities/sessions/'+uuid(),'/api/admin/activities/visitors/'+uuid()]) {
      const response=await fetch(app.base+route,{redirect:'manual'});
      assert.equal(response.status,401,route);
    }
    assert.equal((await fetch(app.base+'/admin/activities',{redirect:'manual'})).status,302);
    assert.equal((await fetch(app.base+'/admin/activities.js',{redirect:'manual'})).status,302);
    const cookie=await app.login();
    const compressed = await fetch(app.base+'/commerce-home.css', {headers:{'Accept-Encoding':'gzip'}});
    assert.equal(compressed.headers.get('content-encoding'),'gzip');
    assert.match(await compressed.text(),/ibn-launch-splash/);
    const protectedAsset = await fetch(app.base+'/admin/activities.js', {headers:{Cookie:cookie,'Accept-Encoding':'gzip'}});
    assert.equal(protectedAsset.headers.get('content-encoding'),null);
    const id=Object.keys(app.prices)[0], value=123456;
    const response=await fetch(app.base+'/api/admin/prices/'+id,{method:'POST',headers:{
      cookie,'Content-Type':'application/json'},body:JSON.stringify({value,label:'123 456 FCFA'})});
    assert.equal(response.status,200);
    assert.equal((await app.client.query('SELECT value FROM prices WHERE id=$1',[id])).rows[0].value,String(value));
    const publicPrices=await fetch(app.base+'/api/prices');
    assert.match(publicPrices.headers.get('cache-control'),/no-store/);
    const publicData=await publicPrices.json();
    assert.equal(publicData.prices[id].value,value);
    assert.deepEqual(publicData.prices[app.unmanagedId],app.legacy[app.unmanagedId]);
    const managedData=await (await fetch(app.base+'/api/admin/prices',{headers:{cookie}})).json();
    assert.equal(app.unmanagedId in managedData.prices,false);
    assert.match(await (await fetch(app.base+'/prix-produits.js?v=old')).text(),/123 456 FCFA/);
    assert.equal((await fetch(app.base+'/api/admin/prices/not-an-existing-product',{method:'POST',
      headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({value:1})})).status,404);
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM prices')).rows[0].count),Object.keys(app.prices).length);
    const batch={consent:'granted',visitor:uuid(),session:uuid(),events:[
      {id:uuid(),type:'page_view',page:'/',service:''},
      {id:uuid(),type:'service_view',page:'/',service:id},
      {id:uuid(),type:'external_click',page:'/',service:'mynita'}]};
    const post=(body,origin=app.base,headers={})=>fetch(app.base+'/api/activities',{method:'POST',
      headers:{'Content-Type':'application/json',Origin:origin,'x-test-country':'NE','accept-language':'fr-NE,fr;q=0.9',
        'user-agent':'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A) Chrome/120.0 Mobile',...headers},body:JSON.stringify(body)});
    const receipt=await post(batch);
    assert.equal(receipt.status,204);
    assert.equal(receipt.headers.get('x-activity-status'),'recorded');
    assert.equal(receipt.headers.get('x-activity-count'),'3');
    const beforeRetry=(await app.client.query('SELECT last_at FROM activity_sessions WHERE session_id=$1',[batch.session])).rows[0].last_at;
    const duplicate=await post(batch);
    assert.equal(duplicate.status,204); // idempotent retries
    assert.equal(duplicate.headers.get('x-activity-status'),'duplicate');
    assert.equal(duplicate.headers.get('x-activity-count'),'0');
    assert.equal((await app.client.query('SELECT last_at FROM activity_sessions WHERE session_id=$1',[batch.session])).rows[0].last_at.getTime(),beforeRetry.getTime());
    assert.equal((await post({...batch,consent:undefined,session:uuid()})).status,204);
    assert.equal((await post(batch,'https://attacker.example')).status,403);
    assert.equal((await post({...batch,session:'secret-token'})).status,400);
    const optedOut={...batch,session:uuid(),events:[{...batch.events[0],id:uuid()}]};
    assert.equal((await post(optedOut,app.base,{DNT:'1'})).status,204);
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM activity_events')).rows[0].count),3);
    const report=await (await fetch(app.base+'/api/admin/activities',{headers:{cookie}})).json();
    assert.equal(report.ok,true);assert.equal(report.summary.total,3);assert.equal(report.summary.visitors,1);
    assert.equal(report.summary.sessions,1);assert.equal(report.summary.pages,1);assert.equal(report.summary.external,1);
    assert.equal(report.events[0].country,'NE');assert.equal(report.events[0].device,'mobile');
    assert.equal(report.events[0].brand,'Samsung');assert.equal(report.events[0].model,'SM-A546B');
    assert.equal(report.events[0].os_version,'14');assert.equal(report.events[0].language,'fr-NE');
    assert.equal(report.events[0].region,null);
    for(const key of ['todayVisits','weekVisits','monthVisits','activeVisitors'])assert.equal(report.summary[key],1,key);
    assert.deepEqual(report.breakdowns.countries,[{name:'NE',count:1}]);
    assert.deepEqual(report.breakdowns.devices,[{name:'mobile',count:1}]);
    assert.equal(report.breakdowns.services.some(row=>row.name===id && row.count===1),true);
    const filtered=await (await fetch(app.base+'/api/admin/activities?country=NE&device=mobile&type=external_click&service=mynita&q=mynita',{headers:{cookie}})).json();
    assert.equal(filtered.total,1);
    const missing=await (await fetch(app.base+'/api/admin/activities?q=no-such-match',{headers:{cookie}})).json();
    assert.equal(missing.total,0);
    assert.equal((await fetch(app.base+'/api/admin/activities?from=bad',{headers:{cookie}})).status,400);
    const timeline=await (await fetch(app.base+'/api/admin/activities/sessions/'+batch.session,{headers:{cookie}})).json();
    assert.equal(timeline.events.length,3);assert.equal(timeline.events[0].type,'page_view');
    const csv=await fetch(app.base+'/api/admin/activities/export.csv',{headers:{cookie}});
    assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(csv.headers.get('cache-control'),/no-store/);
    assert.match(await csv.text(),/mynita/);
    // Retention affects only this feature's old records, never business tables.
    await app.client.query("UPDATE activity_events SET occurred_at=NOW()-INTERVAL '91 days' WHERE type='page_view'");
    await store.cleanup({query:(...args)=>app.client.query(...args)});
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM activity_events')).rows[0].count),2);
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM prices')).rows[0].count),Object.keys(app.prices).length);
    const visitor=uuid(),session=uuid();
    for (const size of [20,20,15]) {
      assert.equal((await post({consent:'granted',visitor,session,events:Array.from({length:size},()=>({
        id:uuid(),type:'click',page:'/',service:'catalogue'
      }))})).status,204);
    }
    const pageTwo=await (await fetch(app.base+'/api/admin/activities?page=2',{headers:{cookie}})).json();
    assert.equal(pageTwo.total,57);assert.equal(pageTwo.events.length,7);
    const today=new Date(Date.now()+3600000).toISOString().slice(0,10);
    const yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
    assert.equal((await (await fetch(app.base+`/api/admin/activities?from=${yesterday}&to=${yesterday}`,{headers:{cookie}})).json()).total,0);
    for (const [key,val] of Object.entries({country:'NE',device:'mobile',visitor:batch.visitor,session:batch.session,service:'mynita',type:'external_click'})) {
      const filtered=await (await fetch(app.base+'/api/admin/activities?'+new URLSearchParams({[key]:val}),{headers:{cookie}})).json();
      assert.ok(filtered.total>0,key+' filter');
      assert.ok(filtered.events.every(row=>row[{visitor:'visitor_id',session:'session_id'}[key]||key]===val));
    }
    // New additive initialization must retain all current events and prices.
    const beforeUpgrade=Number((await app.client.query('SELECT COUNT(*) FROM activity_events')).rows[0].count);
    await store.initialize({query:(...args)=>app.client.query(...args)});
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM activity_events')).rows[0].count),beforeUpgrade);
    const secondSession=uuid();
    assert.equal((await post({consent:'granted',visitor:batch.visitor,session:secondSession,
      source:'https://private.example/?password=must-not-persist',
      events:[{id:uuid(),type:'page_view',page:'/',service:''}]},app.base,
      {'user-agent':'','accept-language':''})).status,204);
    const detail=await (await fetch(app.base+'/api/admin/activities/visitors/'+batch.visitor,{headers:{cookie}})).json();
    assert.equal(detail.ok,true);assert.equal(detail.visitor.visits,2);
    assert.equal(detail.sessions.length,2);assert.equal(detail.events.length,3);
    assert.equal(detail.sessions[0].model,null);assert.equal(detail.sessions[0].language,null);
    assert.equal(detail.sessions[0].source,null);
    assert.equal(detail.sessions.find(s=>s.session_id===batch.session).model,'SM-A546B');
    assert.equal(detail.truncated,false);
    assert.equal(JSON.stringify(detail).includes('must-not-persist'),false);
    assert.equal((await fetch(app.base+'/api/admin/activities/visitors/bad',{headers:{cookie}})).status,400);
    const unique=await (await fetch(app.base+'/api/admin/activities?visitor='+batch.visitor,{headers:{cookie}})).json();
    assert.equal(unique.summary.visitors,1);assert.equal(unique.summary.sessions,2);

    browser=await chromium.launch({executablePath:'/repl/tools/bin/chromium',headless:true,args:['--no-sandbox']});
    for (const width of [1280,390]) {
      const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',extraHTTPHeaders:{'x-test-country':'NE'},
        ...(width===390?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'}:{})});
      await context.addInitScript(()=>{
        localStorage.setItem('ibn-analytics-consent-v1','granted');
        localStorage.setItem('ibn_pwa_installed','1');
      });
      const page=await context.newPage(), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',message=>{if(message.type()==='error')errors.push(message.text()+' '+message.location().url);});
      await page.goto(app.base+'/admin/login');
      await page.locator('input[name=username]').fill(app.username);
      await page.locator('input[name=password]').fill(app.password);
      await Promise.all([page.waitForURL(app.base+'/admin'),page.locator('button[type=submit]').click()]);
      const pricePanel=page.locator('.product[data-id="'+id+'"]');
      await pricePanel.locator('.price-value').fill(String(value));
      await pricePanel.locator('.price-label').fill('123 456 FCFA');
      const saved=page.waitForResponse(r=>r.url().endsWith('/api/admin/prices/'+id)&&r.request().method()==='POST');
      await pricePanel.locator('button.save').click();
      assert.equal((await saved).status(),200);
      await page.locator('a[href="/admin/activities"]').click();
      await page.locator('#table-wrap:not([hidden])').waitFor();
      await page.waitForFunction(()=>document.querySelector('#collection-diagnostic').textContent.includes('PostgreSQL accessible'));
      assert.equal(await page.locator('#events-body .identifier').first().innerText().then(text=>text.includes('Non disponible')),false);
      assert.equal(await page.locator('.stats-grid .stat').count(),12);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      for (const period of ['yesterday','30','today','7']) {
        const loaded=page.waitForResponse(r=>r.url().includes('/api/admin/activities?')&&r.status()===200);
        await page.locator(`[data-period="${period}"]`).click();await loaded;
      }
      await page.locator('[data-period="7"]').click();
      await page.waitForTimeout(400);
      await page.locator('#q').fill('mynita');
      await page.waitForTimeout(500);
      await page.locator('.session-link').first().click();
      await page.locator('#session-dialog[open]').waitFor();
      assert.ok(await page.locator('.timeline li').count()>=2);
      await page.locator('#close-dialog').click();
      await page.locator('#events-body tr').first().focus();
      await page.keyboard.press('Enter');
      await page.locator('#session-dialog[open] .detail-intro').waitFor();
      assert.match(await page.locator('#dialog-content').innerText(),/pseudonymisé, pas une personne/);
      assert.match(await page.locator('#dialog-content').innerText(),/Non disponible/);
      if(process.env.ADMIN_CAPTURE_DIR) {
        fs.mkdirSync(process.env.ADMIN_CAPTURE_DIR,{recursive:true});
        await page.screenshot({path:process.env.ADMIN_CAPTURE_DIR+'/visitor-'+width+'.png',fullPage:true});
      }
      await page.locator('#close-dialog').click();
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#export-link').click();
      const download=await downloadPromise;
      assert.equal(download.suggestedFilename(),'activites.csv');
      if(process.env.ADMIN_CAPTURE_DIR) {
        fs.mkdirSync(process.env.ADMIN_CAPTURE_DIR,{recursive:true});
        await page.screenshot({path:process.env.ADMIN_CAPTURE_DIR+'/admin-'+width+'.png',fullPage:true});
      }
      // Real public page receives the nonvisual collector from the server.
      await page.goto(app.base,{waitUntil:'networkidle'});
      assert.equal(await page.locator('script[src*="activity-tracker.js"]').count(),1);
      const card=page.locator('.ibn-cat-card[data-id="'+id+'"]');
      assert.equal(await card.count(),1);
      assert.match(await card.innerText(),/123 456 FCFA/);
      // Changing PostgreSQL updates an already-open public catalogue, without reload.
      await app.client.query('UPDATE prices SET value=234567,label=$2 WHERE id=$1',[id,'234 567 FCFA']);
      await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
      await page.waitForFunction(id=>document.querySelector('.ibn-cat-card[data-id="'+id+'"]').textContent.includes('234 567 FCFA'),id);
      await page.locator('#ibn-transfer-catalogue-card').click();
      await page.locator('[data-country="Benin"]').click();
      await context.route('https://www.nitatransfert.com/**',r=>r.fulfill({body:'Outbound test'}));
      await page.locator('[data-country="Niger"]').click();
      const popupPromise=context.waitForEvent('page');
      await page.locator('.ibn-finance-service-card').first().click();
      await (await popupPromise).close();
      await page.waitForTimeout(350);
      await page.keyboard.press('Escape');
      const recorded=await app.client.query("SELECT DISTINCT type FROM activity_events");
      for(const type of ['page_view','finance_open','finance_category','external_click'])assert.ok(recorded.rows.some(r=>r.type===type),type);
      assert.deepEqual(errors,[]);
      await context.close();
    }
    const optedOutContext=await browser.newContext({serviceWorkers:'block',extraHTTPHeaders:{DNT:'1'}});
    // A transport header alone does not change Chromium's navigator preference.
    await optedOutContext.addInitScript(()=>Object.defineProperty(navigator,'doNotTrack',{value:'1'}));
    const page=await optedOutContext.newPage();
    let requests=0;
    page.on('request',r=>{if(new URL(r.url()).pathname==='/api/activities')requests++;});
    await page.goto(app.base,{waitUntil:'networkidle'});
    assert.equal(requests,0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('ibn-activity-visitor')),null);
    await optedOutContext.close();
    const consentContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',isMobile:true,hasTouch:true});
    await consentContext.addInitScript(()=>localStorage.setItem('ibn_pwa_installed','1'));
    const consentPage=await consentContext.newPage();
    let sent=0;
    consentPage.on('request',r=>{if(new URL(r.url()).pathname==='/api/activities')sent++;});
    await consentPage.goto(app.base,{waitUntil:'networkidle'});
    await consentPage.locator('.activity-consent').waitFor();
    assert.equal(sent,0);
    assert.equal(await consentPage.evaluate(()=>localStorage.getItem('ibn-activity-visitor')),null);
    await consentPage.getByRole('button',{name:'Refuser les statistiques'}).tap();
    await consentPage.reload({waitUntil:'networkidle'});
    assert.equal(sent,0);
    await consentPage.goto(app.base+'/parametres.html',{waitUntil:'networkidle'});
    await consentPage.locator('#analytics-choice').tap();
    await consentPage.getByRole('button',{name:'Accepter les statistiques'}).tap();
    await consentPage.waitForTimeout(400);
    assert.ok(sent>0);
    const firstID=await consentPage.evaluate(()=>JSON.parse(localStorage.getItem('ibn-activity-visitor')).id);
    await consentPage.locator('#analytics-choice').tap();
    await consentPage.getByRole('button',{name:'Refuser les statistiques'}).tap();
    const atRefusal=sent;
    assert.equal(await consentPage.evaluate(()=>localStorage.getItem('ibn-activity-visitor')),null);
    await consentPage.locator('#analytics-choice').tap();
    await consentPage.getByRole('button',{name:'Accepter les statistiques'}).tap();
    await consentPage.goto(app.base,{waitUntil:'networkidle'});
    assert.ok(sent>atRefusal);
    assert.notEqual(await consentPage.evaluate(()=>JSON.parse(localStorage.getItem('ibn-activity-visitor')).id),firstID);
    assert.equal(await consentPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    let attempts=0;const retried=[];
    await consentPage.route('**/api/activities',async route=>{
      attempts++;retried.push(route.request().postDataJSON());
      if(attempts===1)await route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
      else await route.continue();
    });
    await consentPage.goto(app.base+'/parametres.html',{waitUntil:'networkidle'});
    await consentPage.waitForFunction(()=>document.querySelector('#analytics-status').textContent.includes('confirmé par PostgreSQL'));
    assert.equal(attempts,2);
    assert.deepEqual(retried[0],retried[1]);
    const retryIds=retried[0].events.map(event=>event.id);
    assert.equal(Number((await app.client.query('SELECT COUNT(*) FROM activity_events WHERE event_id=ANY($1::uuid[])',[retryIds])).rows[0].count),retryIds.length);
    await consentContext.close();
    // Exercise the actual local IP country lookup through the complete SQL/API/UI chain.
    // Only this isolated fixture process emulates Railway's documented edge headers.
    const previousRailway=process.env.RAILWAY_ENVIRONMENT_ID;
    const previousCountry=process.env.ANALYTICS_COUNTRY_HEADER;
    const probe={consent:'granted',visitor:uuid(),session:uuid(),events:[
      {id:uuid(),type:'page_view',page:'/',service:''},
      {id:uuid(),type:'service_view',page:'/',service:'starlink'}]};
    try {
      process.env.RAILWAY_ENVIRONMENT_ID='isolated-fixture-only';
      delete process.env.ANALYTICS_COUNTRY_HEADER;
      // Node's fetch controls Host; use HTTP here to emulate the proxy honestly.
      const response=await new Promise((resolve,reject)=>{
        const request=require('node:http').request(app.base+'/api/activities',{method:'POST',headers:{
          host:'ibndjibrilnigertech.com',origin:'https://ibndjibrilnigertech.com',
          'content-type':'application/json','x-forwarded-proto':'https',
          'x-railway-request-id':'isolated-fixture-only','x-real-ip':'41.138.32.1',
          'user-agent':'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A) Chrome/120.0 Mobile'
        }},response=>{response.resume();response.on('end',()=>resolve(response));});
        request.on('error',reject);request.end(JSON.stringify(probe));
      });
      assert.equal(response.statusCode,204);
      assert.equal(response.headers['x-activity-count'],'2');
    } finally {
      if(previousRailway===undefined)delete process.env.RAILWAY_ENVIRONMENT_ID;else process.env.RAILWAY_ENVIRONMENT_ID=previousRailway;
      if(previousCountry===undefined)delete process.env.ANALYTICS_COUNTRY_HEADER;else process.env.ANALYTICS_COUNTRY_HEADER=previousCountry;
    }
    const stored=(await app.client.query('SELECT * FROM activity_sessions WHERE session_id=$1',[probe.session])).rows[0];
    assert.equal(stored.country,'NE');assert.equal(stored.country_source,'geolite2');
    assert.equal(stored.os,'Android');assert.equal(stored.model,'SM-A546B');assert.ok(stored.technical_observed_at);
    assert.equal(stored.city,null);
    assert.equal(Object.keys(stored).some(key=>/^(ip|raw_ip|client_ip)$/.test(key)),false);
    const diagnostic=await (await fetch(app.base+'/api/admin/activities/diagnostic',{headers:{cookie}})).json();
    assert.equal(diagnostic.ok,true);assert.ok(diagnostic.events>0);assert.ok(diagnostic.last_recorded_at);
    const androidAdmin=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const androidPage=await androidAdmin.newPage();
    await androidPage.goto(app.base+'/admin/login');
    await androidPage.locator('input[name="username"]').fill(app.username);
    await androidPage.locator('input[name="password"]').fill(app.password);
    await androidPage.locator('button[type="submit"]').click();
    await androidPage.goto(app.base+'/admin/activities?session='+probe.session);
    await androidPage.locator('#table-wrap:not([hidden])').waitFor();
    assert.match(await androidPage.locator('#events-body').innerText(),/Niger/);
    await androidPage.locator('.visitor-link').first().click();
    await androidPage.locator('#session-dialog[open] .detail-intro').waitFor();
    assert.match(await androidPage.locator('#dialog-content').innerText(),/SM-A546B/);
    assert.match(await androidPage.locator('#dialog-content').innerText(),/GeoLite2 \/ MaxMind/);
    assert.match(await androidPage.locator('#dialog-content').innerText(),/Android 14/);
    assert.match(await androidPage.locator('#dialog-content').innerText(),/starlink/);
    assert.match(await androidPage.locator('#dialog-content').innerText(),/Non disponible/);
    if(process.env.ADMIN_CAPTURE_DIR)await androidPage.screenshot({path:process.env.ADMIN_CAPTURE_DIR+'/android-real-geolocation-detail.png',fullPage:true});
    await androidAdmin.close();
    // An additive migration never invents metadata for earlier observations.
    const legacyVisitor=uuid(),legacySession=uuid();
    await app.client.query(`INSERT INTO activity_sessions(session_id,visitor_id,device,browser,os)
      VALUES($1,$2,'mobile','Chrome','Android')`,[legacySession,legacyVisitor]);
    await app.client.query(`INSERT INTO activity_events(event_id,session_id,type,page) VALUES($1,$2,'page_view','/')`,[uuid(),legacySession]);
    await store.initialize({query:(...args)=>app.client.query(...args)});
    const legacy=(await app.client.query('SELECT brand,model,country,technical_observed_at FROM activity_sessions WHERE session_id=$1',[legacySession])).rows[0];
    assert.deepEqual(legacy,{brand:null,model:null,country:null,technical_observed_at:null});
    const newObservation=await post({consent:'granted',visitor:legacyVisitor,session:legacySession,
      events:[{id:uuid(),type:'heartbeat',page:'/',service:''}]});
    assert.equal(newObservation.status,204);
    const observed=(await app.client.query('SELECT brand,model,country,technical_observed_at FROM activity_sessions WHERE session_id=$1',[legacySession])).rows[0];
    assert.equal(observed.brand,'Samsung');assert.equal(observed.model,'SM-A546B');
    assert.equal(observed.country,'NE');assert.ok(observed.technical_observed_at);
  } finally {await browser?.close();await app.close();}
});
