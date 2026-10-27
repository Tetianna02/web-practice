const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const db = require('../db');

async function migrate() {
  const folder = path.resolve(__dirname, '../migrations');
  const files = fs.readdirSync(folder).filter((file) => /^\d+[-\w]*\.sql$/.test(file)).sort();
  await db.transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('web-practice-migrations'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS shop');
    await client.query(`CREATE TABLE IF NOT EXISTS shop.migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query('REVOKE ALL ON SCHEMA shop FROM PUBLIC, anon, authenticated');
    await client.query('REVOKE ALL ON shop.migrations FROM PUBLIC, anon, authenticated');
    for (const file of files) {
      const sql = fs.readFileSync(path.join(folder, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const { rows } = await client.query('SELECT checksum FROM shop.migrations WHERE name = $1', [file]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error('Migration changed');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO shop.migrations(name, checksum) VALUES($1, $2)', [file, checksum]);
      console.log(`Застосовано: ${file}`);
    }
  });
  console.log('Структура бази актуальна.');
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(`Міграцію не виконано (${error.code || 'CONFIG_OR_CONNECTION'}). Перевірте параметри PostgreSQL.`);
    process.exitCode = 1;
  }).finally(db.close);
}

module.exports = migrate;
