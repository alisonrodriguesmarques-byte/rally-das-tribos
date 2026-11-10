const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

function iniciarSem(chave) {
  const pasta = mkdtempSync(path.join(tmpdir(), 'rally-config-'));
  const env = { ...process.env, DB_FILE: path.join(pasta, 'teste.sqlite'), JWT_SECRET: randomBytes(32).toString('hex'), ADMIN_PASSWORD: randomBytes(24).toString('hex') };
  delete env[chave];
  try {
    return spawnSync(process.execPath, [path.resolve(__dirname, '../src/server.js')], { env, encoding: 'utf8', timeout: 10000 });
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

test('servidor exige um segredo de sessão definido localmente', () => {
  const r = iniciarSem('JWT_SECRET');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Defina JWT_SECRET/);
});

test('primeira execução exige senha local para criar o administrador', () => {
  const r = iniciarSem('ADMIN_PASSWORD');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Defina ADMIN_PASSWORD/);
});
