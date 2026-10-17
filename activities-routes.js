'use strict';
const fs = require('fs');
const path = require('path');
const { once } = require('events');
const store = require('./activities-store');

module.exports = function registerActivities(app, requireAdmin, pool) {
  const htmlPages = fs.readdirSync(path.join(__dirname,'public')).filter(name => name.endsWith('.html'));
  const pages = new Set(['/',...htmlPages.map(name => '/' + name)]);
  const products = JSON.parse(fs.readFileSync(path.join(__dirname,'data/products.json'),'utf8'));
  const services = new Set(products.map(product => store.slug(product.id)));
  ['catalogue','transferts','starlink','wifi','mikrotik','antennes','accessoires','maintenance','formation',
    'Niger','Benin','Nigeria','Ghana','International','Crypto','boutique','calcul','test','mobile'].forEach(s => services.add(store.slug(s)));
  const financeSource = fs.readFileSync(path.join(__dirname,'public/accueil-catalogue-prioritaire.js'),'utf8');
  const logos = financeSource.match(/const FINANCE_LOGOS = \{([\s\S]*?)\n  \};/);
  if (logos) for (const match of logos[1].matchAll(/"([^"]+)"\s*:/g)) services.add(store.slug(match[1]));
  let ready, cleanupTimer;
  const ensure = () => {
    if (!process.env.DATABASE_URL) return Promise.reject(new Error('PostgreSQL requis.'));
    if (!ready) ready = store.initialize(pool).catch(error => {ready=null;throw error;});
    return ready;
  };
  const privateHeaders = (req,res,next) => {
    res.set('Cache-Control','no-store, private');
    res.set('X-Content-Type-Options','nosniff');
    res.set('Referrer-Policy','no-referrer');
    next();
  };
  app.use('/api/admin/activities',privateHeaders,requireAdmin);
  app.get('/admin/activities',requireAdmin,privateHeaders,(req,res) => res.sendFile(path.join(__dirname,'admin/activities.html')));
  for (const ext of ['js','css']) app.get('/admin/activities.'+ext,requireAdmin,privateHeaders,
    (req,res) => res.sendFile(path.join(__dirname,'admin/activities.'+ext)));

  app.get('/api/admin/activities',async(req,res) => {
    try { store.filters(req.query); } catch(error) {return res.status(400).json({ok:false,error:error.message});}
    try {await ensure();res.json(await store.report(pool,req.query));}
    catch (error) {
      console.error('ACTIVITY_REPORT_ERROR',/^[A-Z0-9]{5}$/.test(error.code||'')?error.code:'UNAVAILABLE');
      res.status(503).json({ok:false,error:'Les statistiques PostgreSQL sont temporairement indisponibles.'});
    }
  });
  app.get('/api/admin/activities/diagnostic',async(req,res) => {
    try {
      await ensure();
      const result=await pool.query(`SELECT COUNT(*)::int events,
        COUNT(DISTINCT e.session_id)::int sessions,MAX(e.occurred_at) last_recorded_at,
        COUNT(*) FILTER (WHERE s.country IS NULL)::int events_without_country,
        COUNT(*) FILTER (WHERE s.technical_observed_at IS NULL)::int legacy_events
        ${store.JOIN}`);
      res.json({ok:true,database:'connected',...result.rows[0],
        countryMode:process.env.ANALYTICS_COUNTRY_HEADER?'trusted_header_and_local_geoip':'local_geoip',
        countryDatabase:require('./activity-geography').databaseVersion});
    } catch (_) {res.status(503).json({ok:false,error:'Le diagnostic PostgreSQL est indisponible.'});}
  });
  app.get('/api/admin/activities/sessions/:id',async(req,res) => {
    if (!store.UUID.test(req.params.id)) return res.status(400).json({ok:false,error:'Session invalide.'});
    try {
      await ensure();
      const result=await pool.query(`SELECT ${store.COLUMNS} ${store.JOIN} WHERE e.session_id=$1
        ORDER BY e.occurred_at,e.id LIMIT 2001`,[req.params.id]);
      res.json({ok:true,events:result.rows.slice(0,2000),truncated:result.rows.length>2000});
    } catch (_) {res.status(503).json({ok:false,error:'Chronologie indisponible.'});}
  });
  app.get('/api/admin/activities/visitors/:id',async(req,res) => {
    if (!store.UUID.test(req.params.id)) return res.status(400).json({ok:false,error:'Visiteur invalide.'});
    try {
      await ensure();
      res.json(await store.visitorDetail(pool,req.params.id));
    } catch (_) {res.status(503).json({ok:false,error:'Fiche visiteur indisponible.'});}
  });
  app.get('/api/admin/activities/export.csv',async(req,res) => {
    let f;
    try {f=store.filters(req.query);} catch(error) {return res.status(400).json({ok:false,error:error.message});}
    try {
      await ensure();
      // A stable ID upper bound prevents a live stream from growing forever.
      const bound=await pool.query(`SELECT COALESCE(MAX(e.id),0) id ${store.JOIN} WHERE ${f.where}`,f.values);
      const columns=['occurred_at','visitor_id','session_id','country','country_source','technical_observed_at','region','city','device','brand','model',
        'browser','browser_version','os','os_version','language','source','type','page','service'];
      res.set('Content-Type','text/csv; charset=utf-8');
      res.set('Content-Disposition','attachment; filename="activites.csv"');
      res.write('\uFEFF'+columns.map(store.csvCell).join(',')+'\r\n');
      let last='0';
      while (!res.destroyed) {
        const result=await pool.query(`SELECT ${store.COLUMNS} ${store.JOIN} WHERE ${f.where}
          AND e.id>$${f.values.length+1} AND e.id<=$${f.values.length+2} ORDER BY e.id LIMIT 1000`,
        [...f.values,last,bound.rows[0].id]);
        if (!result.rows.length) break;
        for (const row of result.rows) {
          const line=columns.map(key=>store.csvCell(row[key] instanceof Date?row[key].toISOString():row[key])).join(',')+'\r\n';
          if (!res.write(line)) await Promise.race([once(res,'drain'),once(res,'close')]);
          if (res.destroyed) break;
        }
        last=result.rows[result.rows.length-1].id;
      }
      res.end();
    } catch (_) {
      if (!res.headersSent) res.status(503).json({ok:false,error:'Export indisponible.'});
      else res.destroy();
    }
  });

  const budgets=new Map();
  let minute=0,total=0;
  app.post('/api/activities',async(req,res) => {
    res.set('Cache-Control','no-store');
    const origin=req.get('origin');
    try {
      if (!origin || new URL(origin).host!==req.get('host') ||
          req.get('sec-fetch-site')==='cross-site') return res.status(403).json({ok:false});
    } catch (_) {return res.status(403).json({ok:false});}
    if (req.get('DNT')==='1' || req.get('Sec-GPC')==='1' || req.body?.consent!=='granted')
      return res.set('X-Activity-Status','disabled').status(204).end();
    let events;
    try {events=store.validateBatch(req.body,pages,services);}
    catch (_) {return res.status(400).json({ok:false,error:'Activités invalides.'});}
    const nowMinute=Math.floor(Date.now()/60000);
    if (minute!==nowMinute) {minute=nowMinute;total=0;budgets.clear();}
    const used=budgets.get(req.body.visitor)||0;
    if (total+events.length>10000 || used+events.length>120) return res.status(429).json({ok:false});
    budgets.set(req.body.visitor,used+events.length);total+=events.length;
    try {
      await ensure();
      const recorded=await store.record(pool,req.body,events,store.metadata(req));
      res.set('X-Activity-Status',recorded?'recorded':'duplicate');
      res.set('X-Activity-Count',String(recorded));
      res.status(204).end();
    }
    catch (error) {
      console.error('ACTIVITY_WRITE_ERROR',/^[A-Z0-9]{5}$/.test(error.code||'')?error.code:'UNAVAILABLE');
      res.status(503).json({ok:false,error:'Suivi temporairement indisponible.'});
    }
  });

  // Inject first-party consent and collection without altering finance behavior.
  app.get([...pages],(req,res,next) => {
    const filename=req.path==='/'?'index.html':req.path.slice(1);
    fs.readFile(path.join(__dirname,'public',filename),'utf8',(error,html)=>{
      if (error) return next(error);
      res.set('Cache-Control','no-store');
      res.type('html').send(html.replace(/<\/body>/i,'<script src="/activity-consent.js?v=20261018-collection3" defer></script><script src="/activity-tracker.js?v=20261018-collection3" defer></script></body>'));
    });
  });
  return {
    async start() {
      await ensure();
      await store.cleanup(pool);
      cleanupTimer=setInterval(()=>store.cleanup(pool).catch(()=>console.error('ACTIVITY_RETENTION_ERROR')),86400000);
      cleanupTimer.unref();
    },
    stop() {if(cleanupTimer)clearInterval(cleanupTimer);}
  };
};
