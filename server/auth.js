const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const v = require('./validation');
const { createAuthClient, getAdmin, authError } = require('./supabase');

const router = express.Router();
const verifier = createAuthClient();
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { message: 'Забагато спроб. Спробуйте через 15 хвилин.' },
});

function publicUser(row) {
  return { id: row.id, name: row.name, lastName: row.last_name, email: row.email, role: row.role, address: row.address };
}

// Decode only after Supabase verified the JWT, or from its sign-in/refresh response.
function sessionId(token, userId) {
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (claims.sub !== userId) throw new Error();
    return v.uuid(claims.session_id, 'session');
  } catch (_) { throw new v.HttpError(401, 'Некоректний сеанс. Увійдіть знову.'); }
}

async function profileFor(authUser) {
  const email = v.email(authUser.email);
  const found = await db.query('SELECT * FROM shop.users WHERE auth_user_id = $1', [authUser.id]);
  if (found.rows.length) {
    if (found.rows[0].email !== email) {
      const synced = await db.query('UPDATE shop.users SET email = $1, updated_at = now() WHERE id = $2 RETURNING *', [email, found.rows[0].id]);
      return synced.rows[0];
    }
    return found.rows[0];
  }
  const legacy = await db.query('SELECT id FROM shop.users WHERE email = $1', [email]);
  if (legacy.rows.length) throw new v.HttpError(409, 'Цей акаунт ще не перенесено в Supabase Auth. Виконайте auth:migrate на сервері.');
  const suppliedName = String(authUser.user_metadata?.name || '').trim().slice(0, 80);
  const name = suppliedName.length >= 2 ? suppliedName : 'Користувач';
  const created = await db.query('INSERT INTO shop.users(id, auth_user_id, name, email) VALUES($1,$1,$2,$3) ON CONFLICT(auth_user_id) DO UPDATE SET email = EXCLUDED.email RETURNING *', [authUser.id, name, email]);
  return created.rows[0];
}

async function sessionResponse(data, refreshOnly = false) {
  if (!data.user || !data.session?.access_token || !data.session.refresh_token || !data.session.expires_at) {
    throw new v.HttpError(503, 'Supabase не повернув повний сеанс. Спробуйте увійти ще раз.');
  }
  const profile = await profileFor(data.user);
  const id = sessionId(data.session.access_token, data.user.id);
  const expiresAt = new Date(data.session.expires_at * 1000);
  let result;
  if (refreshOnly) {
    result = await db.query('UPDATE shop.sessions SET expires_at = $1 WHERE id = $2 AND user_id = $3 RETURNING id', [expiresAt, id, profile.id]);
    if (!result.rowCount) {
      await getAdmin().auth.admin.signOut(data.session.access_token, 'local');
      throw new v.HttpError(401, 'Цей сеанс завершено. Увійдіть знову.');
    }
  } else {
    await db.query('INSERT INTO shop.sessions(id, user_id, expires_at) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET expires_at = EXCLUDED.expires_at WHERE shop.sessions.user_id = EXCLUDED.user_id', [id, profile.id, expiresAt]);
  }
  return { token: data.session.access_token, refreshToken: data.session.refresh_token, expiresAt: expiresAt.toISOString(), user: publicUser(profile) };
}

async function signIn(email, password) {
  const client = createAuthClient();
  const result = await client.auth.signInWithPassword({ email, password });
  authError(result.error, true);
  return result.data;
}

async function requireAuth(req, res, next) {
  const authorization = req.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new v.HttpError(401, 'Увійдіть у свій акаунт.');
  const token = authorization.slice(7);
  const result = await verifier.auth.getUser(token);
  if (result.error) {
    if (result.error.status >= 500 || !result.error.status) authError(result.error);
    throw new v.HttpError(401, 'Сеанс завершено. Увійдіть знову.');
  }
  const authUser = result.data.user;
  if (!authUser?.email_confirmed_at) throw new v.HttpError(403, 'Потрібно підтвердити електронну пошту.');
  const id = sessionId(token, authUser.id);
  const found = await db.query('SELECT u.* FROM shop.users u JOIN shop.sessions s ON s.user_id = u.id JOIN auth.sessions a ON a.id = s.id AND a.user_id = u.auth_user_id WHERE u.auth_user_id = $1 AND s.id = $2 AND s.expires_at > now()', [authUser.id, id]);
  if (!found.rows.length) throw new v.HttpError(401, 'Сеанс завершено. Увійдіть знову.');
  req.user = found.rows[0]; req.authUser = authUser; req.sessionId = id; req.accessToken = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') throw new v.HttpError(403, 'Ця дія доступна лише адміністратору.');
  next();
}

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/register', authLimit, async (req, res) => {
  const input = v.body(req.body, ['name', 'email', 'password']);
  const name = v.text(input.name, 'name', 2, 80), email = v.email(input.email), password = v.password(input.password);
  const admin = getAdmin();
  const existing = await db.query('SELECT id FROM shop.users WHERE email = $1', [email]);
  if (existing.rows.length) throw new v.HttpError(409, 'Акаунт із такою поштою вже існує. Спробуйте увійти.');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  authError(created.error);
  try {
    await profileFor(created.data.user);
  } catch (error) {
    const cleanup = await admin.auth.admin.deleteUser(created.data.user.id);
    if (cleanup.error) console.error('Не вдалося прибрати незавершений акаунт Supabase Auth.');
    throw error;
  }
  try {
    res.status(201).json(await sessionResponse(await signIn(email, password)));
  } catch (error) {
    if (error.status === 503) throw new v.HttpError(503, 'Акаунт створено, але вхід тимчасово недоступний. Спробуйте увійти через сторінку входу.');
    throw error;
  }
});

router.post('/login', authLimit, async (req, res) => {
  const input = v.body(req.body, ['email', 'password']);
  const email = v.email(input.email), password = v.password(input.password);
  const legacy = await db.query('SELECT auth_user_id, password_hash IS NOT NULL AS legacy FROM shop.users WHERE email = $1', [email]);
  if (legacy.rows[0]?.legacy && !legacy.rows[0].auth_user_id) {
    throw new v.HttpError(503, 'Акаунт ще не перенесено в Supabase Auth. На сервері потрібно виконати npm run auth:migrate.');
  }
  res.json(await sessionResponse(await signIn(email, password)));
});

router.post('/refresh', authLimit, async (req, res) => {
  v.body(req.body, ['refreshToken']);
  const refreshToken = v.text(req.body.refreshToken, 'refreshToken', 8, 4096);
  const client = createAuthClient();
  const result = await client.auth.refreshSession({ refresh_token: refreshToken });
  if (result.error) {
    if (result.error.status >= 500 || !result.error.status) authError(result.error);
    throw new v.HttpError(401, 'Сеанс завершено. Увійдіть знову.');
  }
  res.json(await sessionResponse(result.data, true));
});

router.get('/me', requireAuth, (req, res) => res.json({ data: publicUser(req.user) }));

router.post('/logout', requireAuth, async (req, res) => {
  const result = await getAdmin().auth.admin.signOut(req.accessToken, 'local');
  if (result.error && ![401, 403, 404].includes(result.error.status)) authError(result.error);
  await db.query('DELETE FROM shop.sessions WHERE id = $1 AND user_id = $2', [req.sessionId, req.user.id]);
  res.status(204).end();
});

router.patch('/me', requireAuth, async (req, res) => {
  const input = v.body(req.body, ['name', 'lastName', 'email', 'address', 'currentPassword', 'newPassword']);
  const changes = {};
  if (input.name !== undefined) changes.name = v.text(input.name, 'name', 2, 80);
  if (input.lastName !== undefined) changes.last_name = v.text(input.lastName, 'lastName', 0, 80);
  if (input.email !== undefined) changes.email = v.email(input.email);
  if (input.address !== undefined) changes.address = v.text(input.address, 'address', 0, 300);
  if (input.newPassword !== undefined) v.password(input.newPassword, 'newPassword');
  if (!Object.keys(changes).length && input.newPassword === undefined) throw new v.HttpError(400, 'Немає змін для збереження.');
  const credentialsChanged = input.newPassword !== undefined || (changes.email !== undefined && changes.email !== req.authUser.email);
  const admin = credentialsChanged ? getAdmin() : null;
  if (credentialsChanged) {
    if (typeof input.currentPassword !== 'string' || input.currentPassword.length < 8) v.fail('currentPassword', 'Введіть правильний поточний пароль.');
    const verification = createAuthClient();
    const checked = await verification.auth.signInWithPassword({ email: req.authUser.email, password: input.currentPassword });
    if (checked.error) {
      if (checked.error.status >= 500 || !checked.error.status || checked.error.status === 429) authError(checked.error);
      v.fail('currentPassword', 'Введіть правильний поточний пароль.');
    }
    const signedOut = await admin.auth.admin.signOut(checked.data.session.access_token, 'local');
    authError(signedOut.error);
    if (changes.email !== undefined) {
      const conflict = await db.query('SELECT id FROM shop.users WHERE email = $1 AND id <> $2', [changes.email, req.user.id]);
      if (conflict.rows.length) throw new v.HttpError(409, 'Цю електронну пошту вже використовує інший акаунт.');
    }
    const attributes = {};
    if (input.newPassword !== undefined) attributes.password = input.newPassword;
    if (changes.email !== undefined && changes.email !== req.authUser.email) { attributes.email = changes.email; attributes.email_confirm = true; }
    const updated = await admin.auth.admin.updateUserById(req.authUser.id, attributes);
    authError(updated.error);
  }
  let row;
  try {
    const entries = Object.entries(changes);
    if (entries.length) {
      const set = entries.map(([key], index) => key + ' = $' + (index + 1)).join(', ');
      const result = await db.query('UPDATE shop.users SET ' + set + ', updated_at = now() WHERE id = $' + (entries.length + 1) + ' RETURNING *', [...entries.map(([, value]) => value), req.user.id]);
      row = result.rows[0];
    } else row = req.user;
    if (credentialsChanged) {
      const signOut = await admin.auth.admin.signOut(req.accessToken, 'global');
      if (signOut.error && ![401, 403, 404].includes(signOut.error.status)) authError(signOut.error);
      await db.query('DELETE FROM shop.sessions WHERE user_id = $1', [req.user.id]);
      const session = await sessionResponse(await signIn(changes.email || req.authUser.email, input.newPassword || input.currentPassword));
      return res.json({ data: publicUser(row), session });
    }
  } catch (error) {
    if (credentialsChanged) throw new v.HttpError(503, 'Дані входу змінено у Supabase Auth. Увійдіть знову з новою поштою або паролем, щоб синхронізувати профіль.');
    throw error;
  }
  res.json({ data: publicUser(row) });
});

module.exports = { router, requireAuth, requireAdmin, publicUser };
