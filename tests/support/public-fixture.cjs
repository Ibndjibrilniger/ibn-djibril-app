'use strict';

const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');

async function publicFixture(run) {
  const app = express();
  app.get('/api/app-version', (_req, res) => res.json({ version: 'commerce-test' }));
  app.get('/api/prices', (_req, res) => res.json({ ok: true, prices: require('../../data/prices.json') }));
  app.post('/api/activities', (_req, res) => res.sendStatus(204));
  app.use(express.static(path.join(__dirname, '../../public'), { etag: false, maxAge: 0 }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium',
    headless: true, args: ['--no-sandbox']
  });
  try {
    await run({ browser, base: 'http://127.0.0.1:' + server.address().port });
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

module.exports = { publicFixture };
