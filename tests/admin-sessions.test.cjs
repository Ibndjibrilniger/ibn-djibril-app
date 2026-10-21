const {test}=require('node:test');
const assert=require('node:assert/strict');
const {promisify}=require('node:util');
const express=require('express');
const session=require('express-session');
const {PostgresSessionStore}=require('../admin-session-store');
const {pool}=require('../db');
const {fixture}=require('./support/admin-fixture.cjs');

test('production Admin sessions persist in PostgreSQL across instances; secure cookies, expiry and logout revoke access', {timeout:45000}, async()=>{
  process.env.NODE_ENV='production';
  const f=await fixture();
  const runtime=require('../server');
  const secondStore=new PostgresSessionStore(pool);
  let second;
  try {
    const login=async()=>{
      const response=await fetch(f.base+'/admin/login',{method:'POST',redirect:'manual',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Forwarded-Proto':'https'},
        body:new URLSearchParams({username:f.username,password:f.password})});
      assert.equal(response.status,302);
      const cookie=response.headers.get('set-cookie');
      assert.match(cookie,/; Secure/);
      assert.match(cookie,/; HttpOnly/);
      assert.match(cookie,/; SameSite=Lax/);
      return cookie.split(';')[0];
    };
    const cookie=await login();
    const sid=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1)).slice(2).split('.')[0];
    const stored=await f.client.query('SELECT sid_hash,data,expires_at FROM admin_sessions');
    assert.equal(stored.rows.length,1);
    assert.notEqual(stored.rows[0].sid_hash,sid);
    assert.equal(stored.rows[0].data.isAdmin,true);
    assert.ok(stored.rows[0].expires_at>Date.now());
    assert.ok(stored.rows[0].expires_at.getTime()<=Date.now()+2*60*60*1000);
    assert.equal((await promisify(secondStore.get.bind(secondStore))(sid)).isAdmin,true);
    const replica=express();
    replica.set('trust proxy',1);
    replica.use(session({secret:process.env.SESSION_SECRET,store:secondStore,resave:false,
      saveUninitialized:false,name:'ibn_admin_session',cookie:runtime.SESSION_COOKIE_OPTIONS}));
    replica.get('/private',(req,res)=>res.sendStatus(req.session.isAdmin?200:401));
    second=replica.listen(0,'127.0.0.1');
    await new Promise(resolve=>second.once('listening',resolve));
    const secondURL='http://127.0.0.1:'+second.address().port+'/private';
    const headers={Cookie:cookie,'X-Forwarded-Proto':'https'};
    assert.equal((await fetch(secondURL,{headers})).status,200);
    assert.equal((await fetch(f.base+'/api/admin/activities',{headers:{Cookie:cookie+'tampered'}})).status,401);
    const logout=await fetch(f.base+'/admin/logout',{method:'POST',headers,redirect:'manual'});
    assert.equal(logout.status,302);
    assert.equal((await fetch(secondURL,{headers})).status,401);
    assert.equal((await f.client.query('SELECT count(*)::int AS n FROM admin_sessions')).rows[0].n,0);
    const nextCookie=await login();
    assert.notEqual(nextCookie,cookie);
    await f.client.query('UPDATE admin_sessions SET expires_at=NOW()-INTERVAL \'1 second\'');
    assert.equal((await fetch(secondURL,{headers:{Cookie:nextCookie,'X-Forwarded-Proto':'https'}})).status,401);
    assert.equal((await fetch(f.base+'/admin/activities',{redirect:'manual'})).status,302);
  } finally {
    secondStore.stop();
    if(second)await new Promise(resolve=>second.close(resolve));
    await f.close();
  }
});
