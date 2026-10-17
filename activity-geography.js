'use strict';

const { isIP, BlockList } = require('node:net');
const geoip = require('geoip-country');
const databaseVersion = require('geoip-country/package.json').version;
const reserved = new BlockList();
for (const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
  ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],
  ['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],
  ['224.0.0.0',4],['240.0.0.0',4]]) reserved.addSubnet(ip,bits,'ipv4');
const global6 = new BlockList();
global6.addSubnet('2000::',3,'ipv6');
reserved.addSubnet('2001::',23,'ipv6');
reserved.addSubnet('2001:db8::',32,'ipv6');
reserved.addSubnet('2002::',16,'ipv6');
reserved.addSubnet('3fff::',20,'ipv6');

function publicIP(value) {
  let ip = String(value || '').trim();
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  const family = isIP(ip);
  if (!family || (family === 6 && !global6.check(ip,'ipv6')) ||
      reserved.check(ip, family === 4 ? 'ipv4' : 'ipv6')) return null;
  return ip;
}

function clientIP(req) {
  // Railway documents X-Real-IP as overwritten by its HTTPS public edge.
  // Do not trust arbitrary forwarding headers in local/other deployments.
  // Private-network callers within the Railway environment must remain trusted.
  if (process.env.RAILWAY_ENVIRONMENT_ID) {
    const host = String(req.get('host') || '').toLowerCase();
    const knownHost = ['ibndjibrilnigertech.com','www.ibndjibrilnigertech.com',
      process.env.RAILWAY_PUBLIC_DOMAIN].filter(Boolean).includes(host);
    if (!knownHost || req.get('x-forwarded-proto') !== 'https' ||
        !req.get('x-railway-request-id')) return null;
    return publicIP(req.get('x-real-ip'));
  }
  return publicIP(req.socket?.remoteAddress);
}

function countryFor(req) {
  const ip = clientIP(req);
  // No IP logging, SQL field, cache, HTTP geolocation request or browser GPS.
  return ip ? geoip.lookup(ip)?.country || null : null;
}

module.exports = {countryFor, publicIP, clientIP, databaseVersion};
