'use strict';

const crypto = require('crypto');
const { assertSyntheticDatabase } = require('../database/connection');
const { hashPassword } = require('../utils/password');
const { normalizeEmail } = require('./authService');

async function bootstrapAdmin(db, input, expectedSecret) {
  assertSyntheticDatabase(db);
  if (typeof expectedSecret !== 'string' || expectedSecret.length < 32 || expectedSecret.length > 1024) {
    throw new Error('Configure um segredo de inicializacao local com pelo menos 32 caracteres.');
  }
  if (!input || typeof input.secret !== 'string' || input.secret.length > 1024 ||
      !crypto.timingSafeEqual(crypto.createHash('sha256').update(input.secret).digest(),
        crypto.createHash('sha256').update(expectedSecret).digest())) {
    throw new Error('Segredo de inicializacao invalido.');
  }
  const name = typeof input.nome_completo === 'string' ? input.nome_completo.trim() : '';
  if (!name || name.length > 120 || /[\u0000-\u001f]/u.test(name)) throw new Error('Informe um nome de ate 120 caracteres.');
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async () => {
    const consumed = await db.get('SELECT id FROM auth_bootstrap WHERE id = 1');
    const existing = await db.get("SELECT id FROM usuarios WHERE tipo_usuario = 'admin' LIMIT 1");
    if (consumed || existing) throw new Error('Inicializacao administrativa ja utilizada ou administrador ja existente.');
    if (await db.get('SELECT id FROM usuarios WHERE lower(email) = ?', [email])) {
      throw new Error('A inicializacao nao substitui contas existentes.');
    }
    const now = Date.now();
    const inserted = await db.run(`INSERT INTO usuarios
      (nome_completo, email, senha_hash, tipo_usuario, status, aprovacao, data_aprovacao)
      VALUES (?, ?, ?, 'admin', 'ativo', 'aprovado', ?)`, [name, email, passwordHash, now]);
    await db.run('UPDATE usuarios SET aprovado_por = ? WHERE id = ?', [inserted.id, inserted.id]);
    await db.run('INSERT INTO auth_bootstrap (id, used_at, admin_id) VALUES (1, ?, ?)', [now, inserted.id]);
    await db.run(`INSERT INTO auth_audit (actor_id, target_user_id, event, detail, created_at)
      VALUES (?, ?, 'bootstrap_admin', '{}', ?)`, [inserted.id, inserted.id, now]);
    return { id: inserted.id };
  });
}

module.exports = { bootstrapAdmin };
