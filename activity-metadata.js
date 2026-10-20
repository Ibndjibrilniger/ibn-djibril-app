'use strict';
const geography = require('./activity-geography');

const SOURCES = new Set(['direct', 'internal', 'google', 'bing', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'other']);
const clean = (value, max = 80) => {
  const text = String(value || '').trim();
  return text && text.length <= max && !/[\x00-\x1f\x7f<>]/.test(text) ? text : null;
};
const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' });
function countryCode(value) {
  const code = String(value || '').toUpperCase();
  return /^[A-Z]{2}$/.test(code) && !['XX','ZZ','EU','UN','EZ','QO'].includes(code) &&
    countryNames.of(code) !== code ? code : null;
}

function metadata(req) {
  const ua = String(req.get('user-agent') || '').slice(0, 500);
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) ? 'tablet' :
    /Mobile|iPhone|Android/i.test(ua) ? 'mobile' :
    /Windows|Macintosh|X11|Linux/i.test(ua) ? 'desktop' : 'unknown';
  const browsers = [
    ['Edge', /(?:Edg|EdgA|EdgiOS)\/([\d.]+)/],
    ['Opera', /(?:OPR|OPiOS)\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
    ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/]
  ];
  const browserMatch = browsers.map(([name, re]) => [name, ua.match(re)]).find(([, match]) => match);
  const browser = browserMatch?.[0] || 'Autre';
  // Only major browser version: avoids presenting reduced UA patch versions as real.
  const browser_version = browserMatch?.[1]?.[1]?.split('.')[0] || null;
  let os = 'Autre', os_version = null, brand = null, model = null;
  if (/Android/i.test(ua)) {
    os = 'Android';
    const reduced = /Android 10; K[;)]/.test(ua);
    if (!reduced) {
      os_version = ua.match(/Android\s+([\d.]+)/i)?.[1] || null;
      const rawModel = ua.match(/Android[\s\d.]+;\s*(?:[a-z]{2}[-_][A-Z]{2};\s*)?([^;)]+?)(?:\s+Build\/[^;)]+)?[;)]/i)?.[1]?.trim();
      if (rawModel && rawModel.length <= 80 && /^(?:SM-[A-Z0-9-]+|GT-[A-Z0-9-]+)$/i.test(rawModel)) {
        brand = 'Samsung'; model = rawModel;
      } else if (rawModel && /^Pixel(?:\s+\d+[a-z]?(?:\s+(?:Pro|XL|Fold))*)?$/i.test(rawModel)) {
        brand = 'Google'; model = rawModel === 'Pixel' ? null : rawModel;
      }
      // Other manufacturer/model strings intentionally remain unavailable:
      // no guessed mapping, high-entropy hints, probing or device fingerprint.
    }
  } else if (/iPhone|iPad/i.test(ua)) {
    os = 'iOS'; brand = 'Apple';
    os_version = ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS)\s+([\d_]+)/i)?.[1]?.replaceAll('_', '.') || null;
    // iPhone/iPad is a family, not a detected hardware model.
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
    const nt = ua.match(/Windows NT ([\d.]+)/)?.[1];
    os_version = nt ? `NT ${nt}` : null; // NT 10.0 cannot distinguish Windows 10/11.
  } else if (/Mac/i.test(ua)) {
    os = 'macOS';
    os_version = ua.match(/Mac OS X ([\d_]+)/)?.[1]?.replaceAll('_', '.') || null;
  } else if (/Linux/i.test(ua)) os = 'Linux';
  const language = String(req.get('accept-language') || '').split(',')[0].split(';')[0].trim();
  // These opt-in deployment headers MUST be stripped/overwritten by the trusted
  // edge. Never enable a client-provided header as a geolocation source.
  const countryHeader = process.env.ANALYTICS_COUNTRY_HEADER;
  const headerCountry = countryHeader ? countryCode(req.get(countryHeader)) : null;
  const country = headerCountry || countryCode(geography.countryFor(req));
  const country_source = headerCountry ? 'trusted_header' : country ? 'geolite2' : null;
  const region = headerCountry && process.env.ANALYTICS_REGION_HEADER ? clean(req.get(process.env.ANALYTICS_REGION_HEADER)) : null;
  const city = headerCountry && process.env.ANALYTICS_CITY_HEADER ? clean(req.get(process.env.ANALYTICS_CITY_HEADER)) : null;
  return { country, region, city, device, browser, browser_version:clean(browser_version,24), os,
    os_version:clean(os_version,40), brand, model,
    country_source, language: /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/i.test(language) ? language.slice(0, 35) : null };
}

module.exports = { metadata, SOURCES, countryCode };
