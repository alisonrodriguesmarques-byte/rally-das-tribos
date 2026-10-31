'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { provisionSyntheticDatabase } = require('./synthetic');
const { Database } = require('./connection');
const { migrate } = require('./init');
const { bootstrapAdmin } = require('../services/bootstrapService');
const { AuthService } = require('../services/authService');
const { verifyPassword, hashPassword } = require('../utils/password');

async function fixture(callback) {
  const names = ['NODE_ENV', 'RALLY_TEST_DB_PATH', 'RALLY_SYNTHETIC_DIR'];
  const previous = names.map(name => process.env[name]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-bootstrap-'));
  const secret = crypto.randomBytes(32).toString('hex');
  const password = crypto.randomBytes(24).toString('hex');
  let db;
  try {
    const provisioned = await provisionSyntheticDatabase({ directory, mode: 'test' });
    process.env.NODE_ENV = 'test';
    process.env.RALLY_SYNTHETIC_DIR = directory;
    process.env.RALLY_TEST_DB_PATH = provisioned.dbPath;
    db = new Database();
    await db.connect();
    await migrate(db, { silent: true });
    await callback({ db, secret, input: {
      secret, password, nome_completo: 'Administrador sintetico', email: 'admin@example.invalid'
    } });
  } finally {
    if (db) await db.close();
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('administrator bootstrap and persistent sessions', { concurrency: false }, async t => {
  await t.test('wrong or missing initialization secret cannot create any account', async () => {
    await fixture(async ({ db, input, secret }) => {
      await assert.rejects(bootstrapAdmin(db, input, undefined));
      await assert.rejects(bootstrapAdmin(db, { ...input, secret: 'wrong' }, secret));
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM usuarios')).count, 0);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_bootstrap')).count, 0);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_audit')).count, 0);
    });
  });

  await t.test('concurrent bootstrap creates exactly one administrator and consumes the operation', async () => {
    await fixture(async ({ db, input, secret }) => {
      const results = await Promise.allSettled([
        bootstrapAdmin(db, input, secret),
        bootstrapAdmin(db, { ...input, email: 'another@example.invalid' }, secret)
      ]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter(result => result.status === 'rejected').length, 1);
      const admin = await db.get("SELECT * FROM usuarios WHERE tipo_usuario = 'admin'");
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM usuarios')).count, 1);
      assert.equal(admin.aprovacao, 'aprovado');
      assert.equal(admin.status, 'ativo');
      assert.equal(admin.aprovado_por, admin.id);
      assert(await verifyPassword(input.password, admin.senha_hash));
      assert.notEqual(input.password, admin.senha_hash);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_bootstrap')).count, 1);
      assert.equal((await db.get("SELECT COUNT(*) AS count FROM auth_audit WHERE event = 'bootstrap_admin'")).count, 1);
      await db.run("UPDATE usuarios SET status = 'inativo' WHERE id = ?", [admin.id]);
      await assert.rejects(bootstrapAdmin(db, input, secret));
      await assert.rejects(db.run('DELETE FROM auth_bootstrap'));
      await assert.rejects(db.run('UPDATE auth_bootstrap SET used_at = 0'));
      await assert.rejects(db.run('DELETE FROM usuarios WHERE id = ?', [admin.id]));
    });
  });

  await t.test('audit failure rolls back account, approval and bootstrap sentinel atomically', async () => {
    await fixture(async ({ db, input, secret }) => {
      const original = db.run.bind(db);
      db.run = async (sql, params) => {
        if (/INSERT INTO auth_audit/.test(sql)) throw new Error('Synthetic audit failure');
        return original(sql, params);
      };
      try { await assert.rejects(bootstrapAdmin(db, input, secret), /Synthetic audit failure/); }
      finally { db.run = original; }
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM usuarios')).count, 0);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_bootstrap')).count, 0);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_audit')).count, 0);
      await bootstrapAdmin(db, input, secret);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM usuarios')).count, 1);
    });
  });

  await t.test('existing pending administrator is never adopted, overwritten or approved', async () => {
    await fixture(async ({ db, input, secret }) => {
      await db.run(`INSERT INTO usuarios (nome_completo, email, senha_hash, tipo_usuario, status)
        VALUES ('Existing synthetic admin', ?, 'not-a-password-hash', 'admin', 'inativo')`, [input.email]);
      const before = await db.all('SELECT * FROM usuarios');
      await assert.rejects(bootstrapAdmin(db, input, secret));
      assert.deepEqual(await db.all('SELECT * FROM usuarios'), before);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_bootstrap')).count, 0);
    });
  });

  await t.test('existing email is never converted into an administrator', async () => {
    await fixture(async ({ db, input, secret }) => {
      await db.run(`INSERT INTO usuarios (nome_completo, email, senha_hash, tipo_usuario)
        VALUES ('Synthetic participant', ?, 'not-a-password-hash', 'participante')`, [input.email.toUpperCase()]);
      const before = await db.all('SELECT * FROM usuarios');
      await assert.rejects(bootstrapAdmin(db, input, secret));
      assert.deepEqual(await db.all('SELECT * FROM usuarios'), before);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM auth_audit')).count, 0);
    });
  });

  await t.test('session survives service replacement and logout remains persistent', async () => {
    await fixture(async ({ db, input, secret }) => {
      await bootstrapAdmin(db, input, secret);
      let clock = Date.now();
      const first = new AuthService(db, { now: () => clock });
      const session = await first.login(input.email, input.password);
      const replacement = new AuthService(db, { now: () => clock });
      assert.equal((await replacement.authenticate(session.token)).user.tipo_usuario, 'admin');
      const row = await db.get('SELECT * FROM auth_sessions WHERE session_hash = ?', [session.sessionHash]);
      assert.equal(row.session_hash, crypto.createHash('sha256').update(session.token).digest('hex'));
      assert(!JSON.stringify(row).includes(session.token));
      await replacement.logout(session.token);
      assert.equal(await first.authenticate(session.token), null);
      const fresh = await first.login(input.email, input.password);
      clock += 30 * 60 * 1000;
      assert.equal(await replacement.authenticate(fresh.token), null, 'idle expiry is inclusive at 30 minutes');
    });
  });

  await t.test('scrypt uses unique salts and preserves whitespace and Unicode in passwords', async () => {
    const password = '  senha sintética com espaços  ';
    const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);
    assert.notEqual(first, second);
    assert(await verifyPassword(password, first));
    assert.equal(await verifyPassword(password.trim(), first), false);
    assert.equal(await verifyPassword(password, 'not-a-valid-hash'), false);
    await assert.rejects(hashPassword('too short'));
  });
});
