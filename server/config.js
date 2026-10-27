const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

function required(name, trim = true) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Заповніть ${name} у кореневому .env.`);
  return trim ? value.trim() : value;
}

function integer(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name}: очікується ціле число від ${min} до ${max}.`);
  }
  return value;
}

const supabaseUrl = required('SUPABASE_URL');
try {
  if (new URL(supabaseUrl).protocol !== 'https:') throw new Error();
} catch {
  throw new Error('SUPABASE_URL має бути коректною HTTPS адресою.');
}

module.exports = {
  required,
  integer,
  supabaseUrl,
  supabaseKey: required('SUPABASE_ANON_KEY'),
  port: integer('PORT', 3000, 1, 65535),
  allowedOrigins: new Set((process.env.CORS_ORIGINS || [
    'http://127.0.0.1:8000', 'http://localhost:8000', 'https://tetianna02.github.io',
  ].join(',')).split(',').map((value) => value.trim()).filter(Boolean)),
};
