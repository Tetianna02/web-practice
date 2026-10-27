const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { required, integer } = require('./config');

let pool;

function getPool() {
  if (!pool) {
    const host = required('DATABASE_HOST');
    // Public Supabase CA, as linked by the official dashboard's SSL configuration.
    const caPath = process.env.DATABASE_CA_FILE || 'server/certs/supabase-prod-ca-2021.crt';
    pool = new Pool({
      host,
      port: integer('DATABASE_PORT', 5432, 1, 65535),
      database: process.env.DATABASE_NAME || 'postgres',
      user: required('DATABASE_USER'),
      password: required('DATABASE_PASSWORD', false),
      ssl: {
        rejectUnauthorized: true,
        servername: host,
        ca: fs.readFileSync(path.resolve(__dirname, '..', caPath), 'utf8'),
      },
      max: 5,
      connectionTimeoutMillis: 7000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
      application_name: 'web-practice-api',
    });
    pool.on('error', () => console.error('Втрачено неактивне з’єднання PostgreSQL.'));
  }
  return pool;
}

async function query(text, values) {
  return getPool().query(text, values);
}

async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { query, transaction, close };
