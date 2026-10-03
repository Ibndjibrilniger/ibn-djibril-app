const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on('error', (err) => {
  console.error('❌ Erreur PostgreSQL :', err.message);
});

async function testDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ DATABASE_URL absente en local : test PostgreSQL ignoré.');
    return false;
  }

  const result = await pool.query('SELECT NOW() AS now');
  console.log('✅ PostgreSQL connecté :', result.rows[0].now);
  return true;
}

module.exports = { pool, testDatabase };
