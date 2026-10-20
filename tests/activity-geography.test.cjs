'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {metadata}=require('../activity-metadata');
const {publicIP,countryFor}=require('../activity-geography');
const req=(headers={},ip)=>({get:name=>headers[name],socket:{remoteAddress:ip}});

test('offline country lookup accepts only public addresses, never guesses from language or capital',()=>{
  for(const ip of ['', 'garbage','127.0.0.1','10.0.0.1','172.16.0.1','192.168.0.1',
    '100.64.1.2','169.254.1.1','192.0.2.1','203.0.113.1','::1','fc00::1',
    'fe80::1','2001:db8::1','::ffff:127.0.0.1']) assert.equal(publicIP(ip),null,ip);
  const saved=process.env.RAILWAY_ENVIRONMENT_ID;
  const old=process.env.ANALYTICS_COUNTRY_HEADER;
  try {
    delete process.env.RAILWAY_ENVIRONMENT_ID;delete process.env.ANALYTICS_COUNTRY_HEADER;
    assert.equal(countryFor(req({},'8.8.8.8')),'US');
    assert.equal(countryFor(req({},'2001:4860:4860::8888')),'US');
    const niger=metadata(req({'accept-language':'en-US'},'41.138.32.1'));
    assert.equal(niger.country,'NE');assert.equal(niger.country_source,'geolite2');
    assert.equal(niger.city,null);assert.equal(niger.region,null); // never use a capital as city
    assert.equal(metadata(req({'accept-language':'fr-NE'},'127.0.0.1')).country,null);
    assert.equal(countryFor(req({'x-real-ip':'41.138.32.1'},'127.0.0.1')),null);
  } finally {
    if(saved===undefined)delete process.env.RAILWAY_ENVIRONMENT_ID;else process.env.RAILWAY_ENVIRONMENT_ID=saved;
    if(old===undefined)delete process.env.ANALYTICS_COUNTRY_HEADER;else process.env.ANALYTICS_COUNTRY_HEADER=old;
  }
});

test('Railway lookup uses its documented X-Real-IP only in the public-edge context',()=>{
  const saved=process.env.RAILWAY_ENVIRONMENT_ID;
  try {
    process.env.RAILWAY_ENVIRONMENT_ID='isolated-test-only';
    const headers={host:'ibndjibrilnigertech.com','x-forwarded-proto':'https',
      'x-railway-request-id':'test-only','x-real-ip':'41.138.32.1','x-forwarded-for':'8.8.8.8'};
    assert.equal(countryFor(req(headers,'10.0.0.1')),'NE');
    assert.equal(countryFor(req({...headers,'x-real-ip':'192.168.0.1'},'10.0.0.1')),null);
    assert.equal(countryFor(req({...headers,host:'attacker.example'},'10.0.0.1')),null);
    assert.equal(countryFor(req({...headers,'x-railway-request-id':''},'10.0.0.1')),null);
    assert.equal(countryFor(req({...headers,'x-real-ip':'41.138.32.1, 8.8.8.8'},'10.0.0.1')),null);
  } finally {
    if(saved===undefined)delete process.env.RAILWAY_ENVIRONMENT_ID;else process.env.RAILWAY_ENVIRONMENT_ID=saved;
  }
});
