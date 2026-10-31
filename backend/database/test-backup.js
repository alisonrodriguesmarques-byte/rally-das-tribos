'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { provisionSyntheticDatabase, validateSyntheticDatabase } = require('./synthetic');
const { Database, getProtectedDatabasePaths } = require('./connection');
const { migrate, assertSchemaReady } = require('./init');
const { createBackup, inspectBackup, restoreBackup } = require('./backup');
const { bootstrapAdmin } = require('../services/bootstrapService');
const { AuthService } = require('../services/authService');

async function fixture(callback) {
  const names = ['NODE_ENV', 'RALLY_SYNTHETIC_DIR', 'RALLY_TEST_DB_PATH'];
  const previous = names.map(name => process.env[name]);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-backup-test-'));
  let db;
  try {
    const source = await provisionSyntheticDatabase({ directory: path.join(root, 'source'), mode: 'test' });
    Object.assign(process.env, { NODE_ENV: 'test', RALLY_SYNTHETIC_DIR: source.directory, RALLY_TEST_DB_PATH: source.dbPath });
    db = new Database();
    await db.connect();
    await migrate(db, { silent: true });
    await db.run('CREATE TABLE backup_fixture(id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    await db.run('INSERT INTO backup_fixture VALUES(1,?)', ['Primeiro resultado sintético']);
    await callback({ db, root, source, backup: path.join(root, 'backup'), restored: path.join(root, 'restored') });
  } finally {
    if (db) await db.close();
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

test('consistent private backups and isolated verified restoration', { concurrency: false }, async t => {
  await t.test('live snapshot preserves committed records while the source remains open', async () => {
    await fixture(async ({ db, source, backup, restored }) => {
      const secret = crypto.randomBytes(32).toString('hex'), password = crypto.randomBytes(24).toString('hex');
      await bootstrapAdmin(db, { secret, nome_completo: 'Administrador sintético', email: 'backup@example.invalid', password }, secret);
      const session = await new AuthService(db).login('backup@example.invalid', password);
      const originalIdentity = source.id;
      const snapshot = await createBackup(db, { directory: backup });
      assert(snapshot.bytes > 0);
      assert.equal(fs.statSync(backup).mode & 0o777, 0o700);
      for (const file of ['database.sqlite', 'backup.json']) assert.equal(fs.statSync(path.join(backup, file)).mode & 0o777, 0o600);
      const { manifest } = await inspectBackup(backup);
      assert.equal(manifest.source.id, originalIdentity);
      assert.equal(manifest.migrations.length, 13);
      const snapshotDigest = digest(path.join(backup, 'database.sqlite'));
      await db.run('UPDATE backup_fixture SET value=? WHERE id=1', ['Alterado depois do snapshot']);
      const restoredDb = await restoreBackup({ backupDirectory: backup, directory: restored });
      assert.notEqual(restoredDb.id, source.id);
      validateSyntheticDatabase(restoredDb);
      assert.equal(digest(path.join(backup, 'database.sqlite')), snapshotDigest, 'restore must not write to the snapshot');
      assert.equal((await db.get('SELECT value FROM backup_fixture WHERE id=1')).value, 'Alterado depois do snapshot');
      assert.equal((await db.get('SELECT id FROM _rally_synthetic')).id, originalIdentity);
      assert(await new AuthService(db).authenticate(session.token), 'source session stays valid');
      Object.assign(process.env, { RALLY_SYNTHETIC_DIR: restored, RALLY_TEST_DB_PATH: restoredDb.dbPath });
      const restoredConnection = new Database();
      try {
        await restoredConnection.connect();
        await assertSchemaReady(restoredConnection);
        assert.equal((await restoredConnection.get('SELECT value FROM backup_fixture WHERE id=1')).value, 'Primeiro resultado sintético');
        assert.equal(await new AuthService(restoredConnection).authenticate(session.token), null, 'restored sessions must never be reusable');
        assert(await new AuthService(restoredConnection).login('backup@example.invalid', password));
        assert.equal((await restoredConnection.get('SELECT COUNT(*) AS n FROM auth_bootstrap')).n, 1);
        const audit = await restoredConnection.get("SELECT detail FROM auth_audit WHERE event='database_restored'");
        assert.equal(JSON.parse(audit.detail).backup_id, manifest.id);
        assert.equal(JSON.parse(audit.detail).revoked_sessions, 1);
      } finally {
        await restoredConnection.close();
        Object.assign(process.env, { RALLY_SYNTHETIC_DIR: source.directory, RALLY_TEST_DB_PATH: source.dbPath });
      }
    });
  });

  await t.test('online writers commit complete transactions before or after the SQLite snapshot', async () => {
    await fixture(async ({ db, backup, restored }) => {
      const writer = new Database();
      await writer.connect();
      try {
        await Promise.all([
          createBackup(db, { directory: backup }),
          writer.transaction(async () => {
            await writer.run('INSERT INTO backup_fixture VALUES(2,?)', ['Par de resultados']);
            await writer.run('INSERT INTO backup_fixture VALUES(3,?)', ['Par de resultados']);
          })
        ]);
        const selected = await restoreBackup({ backupDirectory: backup, directory: restored });
        const savedDirectory = process.env.RALLY_SYNTHETIC_DIR, savedPath = process.env.RALLY_TEST_DB_PATH;
        Object.assign(process.env, { RALLY_SYNTHETIC_DIR: selected.directory, RALLY_TEST_DB_PATH: selected.dbPath });
        const clone = new Database();
        try {
          await clone.connect();
          const count = (await clone.get('SELECT COUNT(*) AS n FROM backup_fixture WHERE id IN (2,3)')).n;
          assert([0, 2].includes(count), 'partial writer transaction must not be included');
        } finally {
          await clone.close();
          Object.assign(process.env, { RALLY_SYNTHETIC_DIR: savedDirectory, RALLY_TEST_DB_PATH: savedPath });
        }
      } finally { await writer.close(); }
    });
  });

  await t.test('existing destinations and protected/check-out paths are refused without modification', async () => {
    await fixture(async ({ db, root, source, backup }) => {
      const before = digest(source.dbPath);
      const existing = path.join(root, 'existing'); fs.mkdirSync(existing, { mode: 0o700 });
      fs.writeFileSync(path.join(existing, 'sentinel'), 'Preservar', { mode: 0o600 });
      await assert.rejects(createBackup(db, { directory: existing }), error => error.code === 'EEXIST');
      await assert.rejects(createBackup(db, { directory: path.join(source.directory, 'nested') }));
      await assert.rejects(createBackup(db, { directory: path.join(__dirname, 'backup-denied') }));
      for (const protectedPath of getProtectedDatabasePaths()) {
        await assert.rejects(createBackup(db, { directory: path.join(path.dirname(protectedPath), 'denied-backup') }));
      }
      assert.equal(fs.readFileSync(path.join(existing, 'sentinel'), 'utf8'), 'Preservar');
      await createBackup(db, { directory: backup });
      await assert.rejects(restoreBackup({ backupDirectory: backup, directory: existing }), error => error.code === 'EEXIST');
      await assert.rejects(restoreBackup({ backupDirectory: backup, directory: backup }));
      assert.equal(digest(source.dbPath), before);
    });
  });

  await t.test('corruption and a modified checksum cannot adopt a database with another identity', async () => {
    await fixture(async ({ db, backup, restored, source }) => {
      await createBackup(db, { directory: backup });
      const file = path.join(backup, 'database.sqlite'), manifestFile = path.join(backup, 'backup.json');
      const before = digest(source.dbPath);
      const data = fs.readFileSync(file); data[100] ^= 1; fs.writeFileSync(file, data);
      await assert.rejects(restoreBackup({ backupDirectory: backup, directory: restored }), /Checksum/);
      assert.equal(fs.existsSync(restored), false);
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      manifest.source.id = crypto.randomUUID();
      // Recreate an intact SQLite snapshot but give it a forged identity.
      fs.unlinkSync(file); await db.run('VACUUM INTO ?', [file]); fs.chmodSync(file, 0o600);
      manifest.database.sha256 = digest(file); manifest.database.size = fs.statSync(file).size;
      fs.writeFileSync(manifestFile, JSON.stringify(manifest));
      await assert.rejects(restoreBackup({ backupDirectory: backup, directory: restored }), /Proveniencia/);
      assert.equal(fs.existsSync(restored), false);
      assert.equal(digest(source.dbPath), before);
    });
  });

  await t.test('symlinks, hardlinks, public permissions and snapshot sidecars are refused', async () => {
    await fixture(async ({ db, root, backup, restored }) => {
      await createBackup(db, { directory: backup });
      const link = path.join(root, 'link'); fs.symlinkSync(backup, link);
      await assert.rejects(restoreBackup({ backupDirectory: link, directory: restored }));
      const file = path.join(backup, 'database.sqlite'), hardlink = path.join(root, 'hardlink');
      fs.linkSync(file, hardlink);
      await assert.rejects(inspectBackup(backup), /sem links/); fs.unlinkSync(hardlink);
      fs.chmodSync(file, 0o644); await assert.rejects(inspectBackup(backup), /privados/); fs.chmodSync(file, 0o600);
      fs.writeFileSync(file + '-wal', '', { mode: 0o600 });
      await assert.rejects(inspectBackup(backup), /autocontido/);
      assert.equal(fs.existsSync(restored), false);
    });
  });

  await t.test('backup failure removes only exclusively owned output and keeps the source intact', async () => {
    await fixture(async ({ db, source, backup }) => {
      const before = digest(source.dbPath), original = db.run.bind(db);
      db.run = async (sql, params) => { if (sql.startsWith('VACUUM INTO')) throw new Error('Synthetic snapshot failure'); return original(sql, params); };
      try { await assert.rejects(createBackup(db, { directory: backup }), /snapshot failure/); }
      finally { db.run = original; }
      assert.equal(fs.existsSync(backup), false);
      assert.equal(digest(source.dbPath), before);
    });
  });

  await t.test('audit failure aborts restoration before a marker is made available', async () => {
    await fixture(async ({ db, source, backup, restored }) => {
      await db.run("CREATE TRIGGER reject_restore_audit BEFORE INSERT ON auth_audit WHEN NEW.event='database_restored' BEGIN SELECT RAISE(ABORT,'Synthetic restore audit failure'); END");
      await createBackup(db, { directory: backup });
      const before = digest(source.dbPath);
      await assert.rejects(restoreBackup({ backupDirectory: backup, directory: restored }), /restore audit failure/);
      assert.equal(fs.existsSync(restored), false);
      assert.equal(digest(source.dbPath), before);
    });
  });

  await t.test('production and cross-mode restoration are refused; CLI rejects unknown options', async () => {
    await fixture(async ({ db, backup, restored }) => {
      await createBackup(db, { directory: backup });
      await assert.rejects(restoreBackup({ backupDirectory: backup, directory: restored, mode: 'production' }));
      process.env.NODE_ENV = 'development';
      try { await assert.rejects(restoreBackup({ backupDirectory: backup, directory: restored }), /Modo de destino/); }
      finally { process.env.NODE_ENV = 'test'; }
      for (const script of ['backup-db.js', 'restore-db.js']) {
        const help = spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts', script), '--help'], { encoding: 'utf8' });
        assert.equal(help.status, 0);
        const invalid = spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts', script), '--force'], { encoding: 'utf8' });
        assert.equal(invalid.status, 1);
      }
      assert.equal(fs.existsSync(restored), false);
    });
  });
});
