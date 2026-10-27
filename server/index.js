const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const db = require('./db');
const { HttpError } = require('./validation');
const auth = require('./auth');
const catalog = require('./catalog');
const orders = require('./orders');
const { getAdmin } = require('./supabase');

const supabase = createClient(
  config.supabaseUrl,
  config.supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: { timeout: 5000, retry: false },
  },
);

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || config.allowedOrigins.has(origin));
  },
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

app.get('/api/health', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  try {
    // Checks API availability, not SQL access or application-table permissions.
    const response = await fetch(new URL('/auth/v1/health', config.supabaseUrl), {
      headers: { apikey: config.supabaseKey },
      signal: AbortSignal.timeout(5000),
    });
    await response.arrayBuffer();
    if (!response.ok) throw new Error('Supabase unavailable');

    res.json({ status: 'ok', supabase: 'reachable' });
  } catch {
    res.status(503).json({
      status: 'degraded',
      supabase: 'unavailable',
      message: 'Сервер працює, але Supabase недоступний. Перевірте підключення та налаштування проєкту.',
    });
  }
});

app.get('/api/health/database', async (req, res) => {
  const { rows } = await db.query("SELECT 1 AS connected, to_regclass('shop.products') IS NOT NULL AS ready");
  res.status(rows[0].ready ? 200 : 503).json({
    status: rows[0].ready ? 'ok' : 'setup_required', database: 'connected', tablesReady: rows[0].ready,
  });
});

app.get('/api/health/auth', async (req, res) => {
  getAdmin();
  const result = await db.query('SELECT count(*)::int AS remaining FROM shop.users WHERE auth_user_id IS NULL AND password_hash IS NOT NULL');
  res.status(result.rows[0].remaining ? 503 : 200).json({
    provider: 'supabase', status: result.rows[0].remaining ? 'migration_required' : 'ok',
  });
});

app.use('/api/auth', auth.router);
app.use('/api', catalog.router);
app.use('/api', orders.router);

app.use((req, res) => {
  res.status(404).json({ message: 'API-маршрут не знайдено.' });
});

app.use((error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message, ...(error.fields ? { fields: error.fields } : {}) });
  }
  if (error.code === '23505') return res.status(409).json({ message: 'Запис із такими унікальними даними вже існує.' });
  if (['23503', '23001'].includes(error.code)) return res.status(409).json({ message: 'Перевірте пов’язані записи. Категорію з товарами видалити не можна.' });
  if (['23514', '22001', '22P02', '23502'].includes(error.code)) {
    return res.status(400).json({ message: 'Дані не відповідають обмеженням бази. Перевірте поля та ціни.' });
  }
  const unavailable = ['ECONNREFUSED', 'ENETUNREACH', 'ETIMEDOUT', 'ENOTFOUND', 'ENETDOWN', 'EHOSTUNREACH',
    'ECONNRESET', '28P01', '28000', '42P01', '42703', '3F000', '53300', '57014', '08006', '57P01',
    'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED'].includes(error.code)
    || /DATABASE_|JWT_SECRET|timeout|Connection terminated/i.test(error.message || '');
  if (unavailable) return res.status(503).json({ message: 'База даних недоступна або ще не налаштована. Перевірте .env та виконайте db:migrate.' });
  const status = error.type === 'entity.too.large' ? 413
    : error.type === 'entity.parse.failed' ? 400 : 500;

  res.status(status).json({
    message: status === 413 ? 'Завеликий запит.'
      : status === 400 ? 'Некоректний JSON у запиті.' : 'Внутрішня помилка сервера.',
  });
});

if (require.main === module) {
  const port = config.port;
  const server = app.listen(port);
  server.on('listening', () => {
    console.log(`Сервер запущено: http://localhost:${port}/api/health`);
  });

  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE'
      ? `Порт ${port} уже зайнятий. Зупиніть попередній сервер або змініть PORT.`
      : 'Не вдалося запустити сервер.');
    process.exitCode = 1;
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => db.close().catch(() => { process.exitCode = 1; })));
  }
}

module.exports = { app, supabase };
