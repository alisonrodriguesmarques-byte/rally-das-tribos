'use strict';

// Backups are private, self-contained SQLite snapshots. Checksums and markers are
// operational controls, not authenticity against the OS account's administrator.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sqlite3 = require('sqlite3');
const { assertSyntheticDatabase, getProtectedDatabasePaths } = require('./connection');
const { validateSyntheticDatabase } = require('./synthetic');
const { validateMigrations, assertSchemaReady } = require('./init');
const schemaManifest = require('./migration-manifest.json');

const CHECKOUT = path.resolve(__dirname, '../..');
const FILE = 'database.sqlite';
const MANIFEST = 'backup.json';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const FILENAMES = { test: 'rally-test.db', development: 'rally-dev.db' };

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function allowedPath(candidate) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate) || candidate !== path.resolve(candidate)) {
    throw new Error('Informe um caminho absoluto normalizado para o diretorio.');
  }
  if (inside(CHECKOUT, candidate) || getProtectedDatabasePaths().some(p => inside(path.dirname(p), candidate))) {
    throw new Error('Backup e restauracao devem ficar fora do checkout e dos caminhos protegidos.');
  }
  return candidate;
}

function privateStat(candidate, directory = false) {
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()) ||
      typeof process.getuid !== 'function' || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0 ||
      (!directory && stat.nlink !== 1)) {
    throw new Error('Use diretorios/arquivos privados do usuario atual (0700/0600), sem links.');
  }
  return stat;
}

function safeAncestors(candidate) {
  let current = path.parse(candidate).root;
  const systemUid = fs.lstatSync(current).uid;
  for (const component of candidate.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() ||
        (stat.uid !== process.getuid() && stat.uid !== systemUid) ||
        ((stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0)) {
      throw new Error('Ancestral inseguro; links ou diretorios substituiveis por terceiros sao recusados.');
    }
  }
}

function privateDirectory(candidate) {
  allowedPath(candidate);
  safeAncestors(candidate);
  privateStat(candidate, true);
  return candidate;
}

function newDirectory(candidate, forbidden) {
  allowedPath(candidate);
  for (const other of forbidden) {
    if (inside(candidate, other) || inside(other, candidate)) {
      throw new Error('O destino precisa ser independente do banco e do pacote de backup.');
    }
  }
  safeAncestors(path.dirname(candidate));
  // The directory itself must be new: no reuse, overwrite or recursive creation.
  fs.mkdirSync(candidate, { mode: 0o700 });
  return { directory: candidate, stat: privateStat(candidate, true), files: new Map() };
}

function sameFile(a, b) { return a && b && a.dev === b.dev && a.ino === b.ino; }

function ownFile(owned, name) {
  const file = path.join(owned.directory, name);
  const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  owned.files.set(file, fs.fstatSync(fd));
  return fd;
}

function removeOwned(owned) {
  if (!owned || !sameFile(owned.stat, fs.lstatSync(owned.directory, { throwIfNoEntry: false }))) return;
  for (const [file, stat] of owned.files) {
    if (sameFile(stat, fs.lstatSync(file, { throwIfNoEntry: false }))) fs.unlinkSync(file);
  }
  // Unexpected files are preserved. Never recursively clean an input or output.
  try { fs.rmdirSync(owned.directory); } catch (error) { if (error.code !== 'ENOTEMPTY') throw error; }
}

function syncFile(file, directory = false) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | (directory ? fs.constants.O_DIRECTORY : 0));
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function fileDigest(file) {
  const before = privateStat(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  const hash = crypto.createHash('sha256');
  let size = 0;
  try {
    if (!sameFile(before, fs.fstatSync(fd))) throw new Error('Arquivo de backup mudou durante a leitura.');
    const buffer = Buffer.alloc(64 * 1024);
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, count));
      size += count;
    }
    const after = fs.fstatSync(fd);
    if (before.size !== size || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        !sameFile(before, privateStat(file))) throw new Error('Arquivo de backup mudou durante a leitura.');
  } finally { fs.closeSync(fd); }
  return { sha256: hash.digest('hex'), size };
}

async function openSqlite(file, write, callback) {
  let handle;
  try {
    handle = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(file, (write ? sqlite3.OPEN_READWRITE : sqlite3.OPEN_READONLY) | sqlite3.OPEN_FULLMUTEX,
        error => error ? reject(error) : resolve(db));
    });
    const run = (sql, params = []) => new Promise((resolve, reject) => handle.run(sql, params, function (error) {
      if (error) reject(error); else resolve({ changes: this.changes });
    }));
    const all = (sql, params = []) => new Promise((resolve, reject) => handle.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
    await run('PRAGMA foreign_keys=ON');
    await run('PRAGMA busy_timeout=5000');
    return await callback({ run, all });
  } finally {
    if (handle) await new Promise((resolve, reject) => handle.close(error => error ? reject(error) : resolve()));
  }
}

async function verifySnapshot(file, identity) {
  privateStat(file);
  for (const suffix of ['-journal', '-wal', '-shm']) {
    if (fs.lstatSync(file + suffix, { throwIfNoEntry: false })) throw new Error('Pacote de backup deve ser autocontido, sem auxiliares SQLite.');
  }
  const migrations = validateMigrations().map(({ name, checksum }) => ({ name, checksum }));
  await openSqlite(file, false, async ({ all }) => {
    const rows = await all('SELECT id,mode,version FROM _rally_synthetic');
    if (rows.length !== 1 || rows[0].id !== identity.id || rows[0].mode !== identity.mode || rows[0].version !== 1) {
      throw new Error('Proveniencia sintetica do backup nao corresponde ao manifesto.');
    }
    const history = await all('SELECT migration_name,checksum FROM schema_migrations ORDER BY id');
    if (history.length !== migrations.length || history.some((row, i) => row.migration_name !== migrations[i].name || row.checksum !== migrations[i].checksum)) {
      throw new Error('Backup exige o mesmo conjunto completo de migracoes verificadas desta versao.');
    }
    const objects = new Set((await all("SELECT type,name FROM sqlite_master WHERE type IN ('table','index','trigger','view')")).map(row => row.type + ':' + row.name));
    for (const [kind, names] of Object.entries(schemaManifest.required_schema)) {
      for (const name of names) if (!objects.has(kind + ':' + name)) throw new Error('Schema incompleto no backup: ' + kind + ' ' + name);
    }
    for (const name of schemaManifest.required_schema.view) await all('SELECT * FROM "' + name + '" LIMIT 0');
    const integrity = await all('PRAGMA integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || (await all('PRAGMA foreign_key_check')).length) {
      throw new Error('Integridade ou chaves estrangeiras invalidas no backup.');
    }
  });
  return migrations;
}

async function createBackup(db, { directory }) {
  assertSyntheticDatabase(db);
  if (db._hasActiveTransactionContext()) throw new Error('Backup deve ser iniciado fora de uma transacao.');
  await assertSchemaReady(db);
  let owned;
  try {
    owned = newDirectory(directory, [db.synthetic.directory]);
    const file = path.join(directory, FILE);
    const fd = ownFile(owned, FILE);
    fs.closeSync(fd);
    // SQLite takes a consistent snapshot even while another connection is open;
    // copying a live .db file with fs.copyFile would not provide this guarantee.
    await db.run('VACUUM INTO ?', [file]);
    assertSyntheticDatabase(db);
    const migrations = await verifySnapshot(file, db.synthetic);
    syncFile(file);
    const digest = fileDigest(file);
    const manifest = {
      version: 1, kind: 'rally-synthetic-backup', id: crypto.randomUUID(), created_at: new Date().toISOString(),
      source: { id: db.synthetic.id, mode: db.synthetic.mode },
      database: { file: FILE, ...digest }, migrations
    };
    const manifestFd = ownFile(owned, MANIFEST);
    try { fs.writeFileSync(manifestFd, JSON.stringify(manifest, null, 2) + '\n'); fs.fsyncSync(manifestFd); }
    finally { fs.closeSync(manifestFd); }
    syncFile(directory, true);
    syncFile(path.dirname(directory), true);
    return { directory, manifestPath: path.join(directory, MANIFEST), backupId: manifest.id, bytes: digest.size };
  } catch (error) { removeOwned(owned); throw error; }
}

async function inspectBackup(directory) {
  privateDirectory(directory);
  const file = path.join(directory, FILE), manifestPath = path.join(directory, MANIFEST);
  const stat = privateStat(manifestPath);
  if (stat.size > 64 * 1024) throw new Error('Manifesto de backup acima do limite.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || manifest.kind !== 'rally-synthetic-backup' || !UUID.test(manifest.id) ||
      !Number.isFinite(Date.parse(manifest.created_at)) || !manifest.source || !UUID.test(manifest.source.id) ||
      !Object.hasOwn(FILENAMES, manifest.source.mode) || !manifest.database || manifest.database.file !== FILE ||
      !Number.isSafeInteger(manifest.database.size) || manifest.database.size < 512 ||
      !/^[a-f0-9]{64}$/.test(manifest.database.sha256)) throw new Error('Manifesto de backup invalido.');
  const digest = fileDigest(file);
  if (digest.size !== manifest.database.size || digest.sha256 !== manifest.database.sha256) throw new Error('Checksum do backup nao corresponde ao manifesto.');
  const migrations = await verifySnapshot(file, manifest.source);
  if (JSON.stringify(manifest.migrations) !== JSON.stringify(migrations)) throw new Error('Lista de migracoes do manifesto nao corresponde ao backup.');
  return { file, manifest };
}

function copyVerified(file, targetFd, expected) {
  const input = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  const hash = crypto.createHash('sha256');
  let size = 0;
  try {
    const before = privateStat(file);
    if (!sameFile(before, fs.fstatSync(input))) throw new Error('Arquivo de origem mudou.');
    const buffer = Buffer.alloc(64 * 1024);
    let count;
    while ((count = fs.readSync(input, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, count));
      let written = 0;
      while (written < count) written += fs.writeSync(targetFd, buffer, written, count - written);
      size += count;
    }
    const after = fs.fstatSync(input);
    if (!sameFile(before, privateStat(file)) || before.mtimeMs !== after.mtimeMs || size !== after.size ||
        size !== expected.size || hash.digest('hex') !== expected.sha256) throw new Error('Backup mudou durante a copia; restauracao recusada.');
    fs.fsyncSync(targetFd);
  } finally { fs.closeSync(input); }
}

async function restoreBackup({ backupDirectory, directory, mode = process.env.NODE_ENV }) {
  if (process.platform === 'win32' || !Object.hasOwn(FILENAMES, mode) || process.env.NODE_ENV !== mode) {
    throw new Error('Restauracao exige Linux e NODE_ENV=test ou development correspondente ao modo.');
  }
  const { file, manifest } = await inspectBackup(backupDirectory);
  if (mode !== manifest.source.mode) throw new Error('Modo de destino deve corresponder ao backup; conversao de dados nao e permitida.');
  let owned;
  try {
    owned = newDirectory(directory, [backupDirectory]);
    const dbPath = path.join(directory, FILENAMES[mode]);
    const fd = ownFile(owned, FILENAMES[mode]);
    try { copyVerified(file, fd, manifest.database); } finally { fs.closeSync(fd); }
    await verifySnapshot(dbPath, manifest.source);
    const id = crypto.randomUUID();
    let revokedSessions;
    await openSqlite(dbPath, true, async ({ run, all }) => {
      await run('BEGIN IMMEDIATE');
      try {
        revokedSessions = (await run('UPDATE auth_sessions SET revoked_at=? WHERE revoked_at IS NULL', [Date.now()])).changes;
        await run('UPDATE _rally_synthetic SET id=? WHERE id=? AND mode=? AND version=1', [id, manifest.source.id, mode]);
        await run('INSERT INTO auth_audit(actor_id,target_user_id,event,detail,created_at) VALUES(NULL,NULL,?,?,?)',
          ['database_restored', JSON.stringify({ backup_id: manifest.id, source_id: manifest.source.id, restored_id: id, revoked_sessions: revokedSessions }), Date.now()]);
        if ((await all('SELECT id FROM _rally_synthetic')).length !== 1) throw new Error('Identidade restaurada invalida.');
        await run('COMMIT');
      } catch (error) { await run('ROLLBACK'); throw error; }
    });
    await verifySnapshot(dbPath, { id, mode });
    syncFile(dbPath);
    const stat = privateStat(dbPath);
    const markerFd = ownFile(owned, FILENAMES[mode] + '.synthetic.json');
    try {
      fs.writeFileSync(markerFd, JSON.stringify({ version: 1, id, mode, directory, dbPath, dev: String(stat.dev), ino: String(stat.ino) }, null, 2) + '\n');
      fs.fsyncSync(markerFd);
    } finally { fs.closeSync(markerFd); }
    syncFile(directory, true);
    syncFile(path.dirname(directory), true);
    const selected = validateSyntheticDatabase({ directory, dbPath, mode });
    return { ...selected, backupId: manifest.id, revokedSessions };
  } catch (error) { removeOwned(owned); throw error; }
}

module.exports = { createBackup, inspectBackup, restoreBackup };
