'use strict';

// Isolated visual preview: no production credentials, DB connection or auth bypass.
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

async function preview() {
  delete process.env.DATABASE_URL;
  process.env.ADMIN_USER = 'preview-' + crypto.randomUUID();
  process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 4);
  process.env.SESSION_SECRET = crypto.randomBytes(48).toString('hex');
  process.env.HOST = '0.0.0.0';
  process.env.PORT = '5000';
  const runtime = require('../../server');
  await runtime.start();
  console.log('Isolated catalogue preview: PostgreSQL disabled; Admin remains protected.');
}

preview().catch(() => {
  console.error('CATALOGUE_PREVIEW_FAILED');
  process.exitCode = 1;
});
