require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ DATABASE_URL absente : initialisation PostgreSQL ignorée.');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS prices (
      id TEXT PRIMARY KEY,
      value BIGINT,
      label TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const productsCountResult =
    await pool.query('SELECT COUNT(*) FROM products');

  const productsCount =
    Number(productsCountResult.rows[0].count);

  if (productsCount === 0) {
    const productsFile =
      path.join(__dirname, 'data', 'products.json');

    const products =
      JSON.parse(fs.readFileSync(productsFile, 'utf8'));

    for (const product of products) {
      if (!product || !product.id) continue;

      await pool.query(
        `
        INSERT INTO products (id, data)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (id)
        DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW()
        `,
        [
          String(product.id),
          JSON.stringify(product)
        ]
      );
    }

    console.log(
      `✅ ${products.length} produits importés dans PostgreSQL`
    );
  }

  const pricesCountResult =
    await pool.query('SELECT COUNT(*) FROM prices');

  const pricesCount =
    Number(pricesCountResult.rows[0].count);

  if (pricesCount === 0) {
    const pricesFile =
      path.join(__dirname, 'data', 'prices.json');

    const prices =
      JSON.parse(fs.readFileSync(pricesFile, 'utf8'));

    for (const [id, price] of Object.entries(prices)) {
      const value =
        price.value === null ||
        price.value === undefined
          ? null
          : Number(price.value);

      const label =
        String(
          price.label ||
          (value === null
            ? 'Prix à discuter'
            : value + ' FCFA')
        );

      await pool.query(
        `
        INSERT INTO prices (id, value, label)
        VALUES ($1, $2, $3)
        ON CONFLICT (id)
        DO UPDATE SET
          value = EXCLUDED.value,
          label = EXCLUDED.label,
          updated_at = NOW()
        `,
        [id, value, label]
      );
    }

    console.log(
      `✅ ${Object.keys(prices).length} prix importés dans PostgreSQL`
    );
  }

  console.log('✅ Base PostgreSQL prête.');
}

module.exports = { initDb };

if (require.main === module) {
  initDb()
    .then(() => pool.end())
    .catch(err => {
      console.error('❌ Erreur initialisation PostgreSQL :', err);
      process.exit(1);
    });
}
