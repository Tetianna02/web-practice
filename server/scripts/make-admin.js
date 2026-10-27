const db = require('../db');
const v = require('../validation');

(async () => {
  const email = v.email(process.argv[2]);
  const { rowCount } = await db.query("UPDATE shop.users SET role = 'ADMIN', updated_at = now() WHERE email = $1", [email]);
  if (!rowCount) throw new Error('USER_NOT_FOUND');
  console.log('Роль ADMIN призначено наявному користувачу.');
})().catch(() => {
  console.error('Не вдалося призначити роль. Вкажіть пошту вже зареєстрованого користувача: npm run user:admin -- email');
  process.exitCode = 1;
}).finally(db.close);
