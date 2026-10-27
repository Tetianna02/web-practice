const { randomUUID } = require('node:crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { required } = require('./config');
const v = require('./validation');

const router = express.Router();
const sessionSeconds = 8 * 60 * 60;
const dummyHash = bcrypt.hashSync('unused-login-timing-value', 12);

function jwtSecret() {
  const secret = required('JWT_SECRET', false);
  if (Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET must be at least 32 bytes');
  return secret;
}

function publicUser(row) {
  return { id: row.id, name: row.name, lastName: row.last_name, email: row.email, role: row.role, address: row.address };
}

async function createSession(client, user) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + sessionSeconds * 1000);
  const token = jwt.sign({}, jwtSecret(), {
    algorithm: 'HS256', subject: user.id, jwtid: sessionId,
    issuer: 'web-practice-api', audience: 'web-practice', expiresIn: sessionSeconds,
  });
  await client.query('DELETE FROM shop.sessions WHERE user_id = $1 AND expires_at <= now()', [user.id]);
  await client.query('INSERT INTO shop.sessions(id, user_id, expires_at) VALUES($1,$2,$3)', [sessionId, user.id, expiresAt]);
  return { token, expiresAt: expiresAt.toISOString(), user: publicUser(user) };
}

async function requireAuth(req, res, next) {
  const authorization = req.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new v.HttpError(401, 'Увійдіть у свій акаунт.');
  let claims;
  const secret = jwtSecret();
  try {
    claims = jwt.verify(authorization.slice(7), secret, {
      algorithms: ['HS256'], issuer: 'web-practice-api', audience: 'web-practice',
    });
    v.uuid(claims.sub);
    v.uuid(claims.jti);
  } catch {
    throw new v.HttpError(401, 'Сеанс завершено. Увійдіть знову.');
  }
  const { rows } = await db.query(`SELECT u.* FROM shop.users u
    JOIN shop.sessions s ON s.user_id = u.id
    WHERE s.id = $1 AND u.id = $2 AND s.expires_at > now()`, [claims.jti, claims.sub]);
  if (!rows.length) throw new v.HttpError(401, 'Сеанс завершено. Увійдіть знову.');
  req.user = rows[0];
  req.sessionId = claims.jti;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') throw new v.HttpError(403, 'Ця дія доступна лише адміністратору.');
  next();
}

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Забагато спроб. Спробуйте через 15 хвилин.' },
});

router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/register', authLimit, async (req, res) => {
  const input = v.body(req.body, ['name', 'email', 'password']);
  const name = v.text(input.name, 'name', 2, 80);
  const email = v.email(input.email);
  const password = v.password(input.password);
  jwtSecret();
  const hash = await bcrypt.hash(password, 12);
  const data = await db.transaction(async (client) => {
    const { rows } = await client.query(`INSERT INTO shop.users(name, email, password_hash)
      VALUES($1,$2,$3) RETURNING *`, [name, email, hash]);
    return createSession(client, rows[0]);
  });
  res.status(201).json(data);
});

router.post('/login', authLimit, async (req, res) => {
  const input = v.body(req.body, ['email', 'password']);
  const email = v.email(input.email);
  const password = v.password(input.password);
  const { rows } = await db.query('SELECT * FROM shop.users WHERE email = $1', [email]);
  const matches = await bcrypt.compare(password, rows[0]?.password_hash || dummyHash);
  if (!rows.length || !matches) throw new v.HttpError(401, 'Неправильна пошта або пароль.');
  const data = await db.transaction((client) => createSession(client, rows[0]));
  res.json(data);
});

router.get('/me', requireAuth, (req, res) => res.json({ data: publicUser(req.user) }));

router.post('/logout', requireAuth, async (req, res) => {
  await db.query('DELETE FROM shop.sessions WHERE id = $1', [req.sessionId]);
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
  const updated = await db.transaction(async (client) => {
    const { rows: current } = await client.query('SELECT * FROM shop.users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (input.newPassword !== undefined || (changes.email && changes.email !== current[0].email)) {
      if (typeof input.currentPassword !== 'string' || !await bcrypt.compare(input.currentPassword, current[0].password_hash)) {
        v.fail('currentPassword', 'Введіть правильний поточний пароль.');
      }
    }
    if (input.newPassword !== undefined) changes.password_hash = await bcrypt.hash(input.newPassword, 12);
    const entries = Object.entries(changes);
    const set = entries.map(([key], index) => `${key} = $${index + 1}`).join(', ');
    const { rows } = await client.query(`UPDATE shop.users SET ${set}, updated_at = now()
      WHERE id = $${entries.length + 1} RETURNING *`, [...entries.map(([, value]) => value), req.user.id]);
    if (changes.password_hash || changes.email !== undefined) {
      await client.query('DELETE FROM shop.sessions WHERE user_id = $1 AND id <> $2', [req.user.id, req.sessionId]);
    }
    return rows[0];
  });
  res.json({ data: publicUser(updated) });
});

module.exports = { router, requireAuth, requireAdmin, publicUser };
