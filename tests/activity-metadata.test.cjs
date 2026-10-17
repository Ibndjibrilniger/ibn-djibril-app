'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {metadata,countryCode}=require('../activity-metadata');
const meta=(ua,headers={})=>metadata({get:name=>({'user-agent':ua,...headers})[name]});

test('technical detection is conservative with absent, reduced and ambiguous user agents',()=>{
  const unknown=meta('');
  assert.equal(unknown.device,'unknown');
  for(const key of ['brand','model','os_version','browser_version','language','country','region','city'])
    assert.equal(unknown[key],null,key);
  const reduced=meta('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36');
  assert.equal(reduced.os,'Android');assert.equal(reduced.os_version,null);assert.equal(reduced.model,null);
  assert.equal(reduced.browser_version,'130');assert.equal(reduced.brand,null);
  const samsung=meta('Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007) AppleWebKit/537.36 Chrome/122.0 Mobile Safari/537.36',{'accept-language':'fr-NE,fr;q=0.9'});
  assert.equal(samsung.brand,'Samsung');assert.equal(samsung.model,'SM-A546B');
  assert.equal(samsung.os_version,'14');assert.equal(samsung.language,'fr-NE');
  const pixel=meta('Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro Build/AP3A) Chrome/130.0 Mobile Safari/537.36');
  assert.equal(pixel.brand,'Google');assert.equal(pixel.model,'Pixel 9 Pro');
  const iphone=meta('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1');
  assert.equal(iphone.brand,'Apple');assert.equal(iphone.model,null);assert.equal(iphone.os_version,'18.0');
  assert.equal(iphone.browser,'Safari');
  assert.equal(meta('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36 Edg/130.0').browser,'Edge');
  assert.equal(meta('Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36 SamsungBrowser/26.0').browser,'Samsung Internet');
  assert.equal(meta('Mozilla/5.0 (Linux; Android 12; UnverifiedVendor X100) Mobile Firefox/130.0').model,null);
  assert.equal(meta(`Mozilla/5.0 (Linux; Android ${'1'.repeat(100)}; SM-${'A'.repeat(100)}) Mobile Chrome/${'2'.repeat(100)}`).model,null);
});

test('geography is absent unless explicitly provided by configured trusted edge headers',()=>{
  const old={country:process.env.ANALYTICS_COUNTRY_HEADER,region:process.env.ANALYTICS_REGION_HEADER,city:process.env.ANALYTICS_CITY_HEADER};
  try {
    delete process.env.ANALYTICS_COUNTRY_HEADER;
    assert.equal(meta('',{'cf-ipcountry':'NE','x-country':'BJ'}).country,null);
    process.env.ANALYTICS_COUNTRY_HEADER='x-country';
    process.env.ANALYTICS_REGION_HEADER='x-region';
    process.env.ANALYTICS_CITY_HEADER='x-city';
    const actual=meta('',{'x-country':'NE','x-region':'Niamey','x-city':'Niamey'});
    assert.equal(actual.country,'NE');assert.equal(actual.city,'Niamey');
    assert.equal(meta('',{'x-country':'ZZ','x-city':'invented'}).city,null);
    assert.equal(meta('',{'x-country':'NE','x-city':'<script>alert(1)</script>'}).city,null);
    assert.equal(countryCode('XX'),null);assert.equal(countryCode('NG'),'NG');
  } finally {
    for(const [key,value] of [['ANALYTICS_COUNTRY_HEADER',old.country],['ANALYTICS_REGION_HEADER',old.region],['ANALYTICS_CITY_HEADER',old.city]])
      if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});
