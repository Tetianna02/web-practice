const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const { HttpError } = require('./validation');

function createAuthClient(key = config.supabaseKey) {
  return createClient(config.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch(url, options = {}) {
        return fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(10000) });
      },
    },
  });
}

let adminClient;
function getAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key?.trim() || key.startsWith('sb_publishable_')) {
    throw new HttpError(503, 'Для Supabase Auth заповніть серверний SUPABASE_SECRET_KEY у локальному .env та перезапустіть сервер.');
  }
  if (!adminClient) adminClient = createAuthClient(key.trim());
  return adminClient;
}

function authError(error, login = false) {
  if (!error) return;
  const code = error.code;
  if (['email_exists', 'user_already_exists', 'email_address_conflict'].includes(code)) {
    throw new HttpError(409, 'Акаунт із такою поштою вже існує. Спробуйте увійти.');
  }
  if (code === 'email_not_confirmed') throw new HttpError(403, 'Електронну пошту ще не підтверджено. Потрібно завершити перенесення акаунта.');
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error.status === 429) {
    throw new HttpError(429, 'Забагато спроб. Зачекайте й повторіть вхід.');
  }
  if (error.status >= 500 || !error.status) throw new HttpError(503, 'Supabase Auth тимчасово недоступний. Спробуйте пізніше.');
  if (login || ['invalid_credentials', 'user_not_found'].includes(code)) {
    throw new HttpError(401, 'Неправильна пошта або пароль.');
  }
  if (['bad_jwt', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(code)) {
    throw new HttpError(401, 'Сеанс завершено. Увійдіть знову.');
  }
  if (['weak_password', 'same_password', 'email_address_invalid', 'validation_failed'].includes(code)) {
    throw new HttpError(400, code === 'same_password' ? 'Новий пароль має відрізнятися від поточного.' : 'Перевірте адресу пошти та вимоги до пароля.');
  }
  throw new HttpError(503, 'Не вдалося виконати операцію Supabase Auth. Перевірте серверний ключ і налаштування проєкту.');
}

module.exports = { createAuthClient, getAdmin, authError };
