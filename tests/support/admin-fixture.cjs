'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const {pool} = require('../../db');

async function fixture({port=0}={}) {
  const client=await pool.connect();
  const schema='activity_test_'+crypto.randomUUID().replace(/-/g,'');
  const originalQuery=pool.query.bind(pool);
  let server,activities;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query(`CREATE TABLE prices (id TEXT PRIMARY KEY,value BIGINT,label TEXT NOT NULL,updated_at TIMESTAMPTZ DEFAULT NOW())`);
    const legacy=JSON.parse(fs.readFileSync('data/prices.json','utf8'));
    const entries=Object.entries(legacy);
    const unmanagedId=entries[entries.length-1][0];
    const prices=Object.fromEntries(entries.slice(0,-1));
    for (const [id,p] of Object.entries(prices))
      await client.query('INSERT INTO prices(id,value,label) VALUES($1,$2,$3)',[id,p.value,p.label]);
    // Auth configuration is ephemeral, random and confined to this test process.
    const username='test-'+crypto.randomUUID(), password=crypto.randomBytes(32).toString('hex');
    process.env.ADMIN_USER=username;
    process.env.ADMIN_PASSWORD_HASH=await bcrypt.hash(password,4);
    process.env.SESSION_SECRET ||= crypto.randomBytes(48).toString('hex');
    process.env.ANALYTICS_COUNTRY_HEADER='x-test-country';
    pool.query=(...args)=>client.query(...args);
    const runtime=require('../../server');
    activities=runtime.activities;
    await activities.start();
    server=runtime.app.listen(port,'0.0.0.0');
    await new Promise(resolve=>server.once('listening',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    return {base,username,password,client,prices,unmanagedId,legacy,
      async login() {
        const response=await fetch(base+'/admin/login',{method:'POST',redirect:'manual',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body:new URLSearchParams({username,password})});
        if(response.status!==302)throw new Error('Fixture login failed: '+response.status);
        return response.headers.get('set-cookie').split(';')[0];
      },
      async close() {
        activities.stop();
        await new Promise(resolve=>server.close(resolve));
        pool.query=originalQuery;
        await client.query('ROLLBACK');
        client.release();
        await pool.end();
      }};
  } catch (error) {
    activities?.stop();
    server?.close();
    pool.query=originalQuery;
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
    throw error;
  }
}
module.exports={fixture};
