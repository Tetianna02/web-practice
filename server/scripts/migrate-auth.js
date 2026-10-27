const db = require('../db');
const { getAdmin, authError } = require('../supabase');

async function migrateAuth() {
  const admin = getAdmin();
  const { rows } = await db.query('SELECT id, name, email, password_hash FROM shop.users WHERE auth_user_id IS NULL AND password_hash IS NOT NULL ORDER BY created_at');
  let migrated = 0;
  for (const row of rows) {
    if (!row.password_hash || !/^\$2[aby]\$\d{2}\$/.test(row.password_hash)) {
      throw new Error('LEGACY_PASSWORD_HASH_INVALID');
    }
    const existing = await db.query('SELECT id, encrypted_password FROM auth.users WHERE lower(email) = $1', [row.email]);
    let authId;
    if (existing.rows.length) {
      if (existing.rows[0].encrypted_password !== row.password_hash) throw new Error('AUTH_ACCOUNT_PASSWORD_CONFLICT');
      authId = existing.rows[0].id;
      const result = await admin.auth.admin.updateUserById(authId, { email_confirm: true });
      authError(result.error);
    } else {
      const result = await admin.auth.admin.createUser({
        id: row.id, email: row.email, password_hash: row.password_hash,
        email_confirm: true, user_metadata: { name: row.name },
      });
      authError(result.error);
      authId = result.data.user.id;
    }
    await db.transaction(async (client) => {
      const verified = await client.query('SELECT encrypted_password = $2 AS matches, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE id = $1', [authId, row.password_hash]);
      if (!verified.rows[0]?.matches || !verified.rows[0].confirmed) throw new Error('IMPORTED_PASSWORD_VERIFICATION_FAILED');
      await client.query(`UPDATE shop.users SET auth_user_id = $1, password_hash = NULL, updated_at = now()
        WHERE id = $2 AND auth_user_id IS NULL`, [authId, row.id]);
      await client.query('DELETE FROM shop.sessions WHERE user_id = $1', [row.id]);
    });
    migrated += 1;
    console.log(`Перенесено акаунтів: ${migrated}/${rows.length}`);
  }
  console.log('Перенесення у Supabase Auth завершено. Профілі та зв’язки замовлень збережено.');
}

if (require.main === module) {
  migrateAuth().catch((error) => {
    const reason = error.status ? 'SUPABASE_AUTH_ERROR' : error.code || 'MIGRATION_CHECK_FAILED';
    console.error(`Перенесення зупинено (${reason}). Неперенесені акаунти збережені; після виправлення налаштувань команду можна повторити.`);
    process.exitCode = 1;
  }).finally(db.close);
}

module.exports = migrateAuth;
