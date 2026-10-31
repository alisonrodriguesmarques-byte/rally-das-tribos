'use strict';

// Operational guards for disposable data. The security boundary is the OS account
// and private directory, not this marker or a claim of physical SQLite identity.
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');

const CHECKOUT = path.resolve(__dirname, '../..');
const PROTECTED_PATHS = Object.freeze([
  path.join(CHECKOUT, 'data', 'rally-das-tribos.db'),
  path.join(os.tmpdir(), 'rally-das-tribos-audit', 'rally-das-tribos-test.db')
]);
const SIDECARS = ['-journal', '-wal', '-shm'];
const FILENAMES = { test: 'rally-test.db', development: 'rally-dev.db' };

function within(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function assertMode(mode) {
  if (!Object.hasOwn(FILENAMES, mode)) {
    throw new Error('Defina NODE_ENV=test ou NODE_ENV=development; production nao esta habilitado');
  }
  if (process.platform === 'win32') {
    throw new Error('Persistencia sintetica no Windows aguarda validacao da identidade dedicada e ACLs; use o ambiente Linux isolado');
  }
}

function assertAllowedLocation(candidate) {
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate)) {
    throw new Error('O caminho sintetico precisa ser absoluto');
  }
  const resolved = path.resolve(candidate);
  for (const protectedPath of PROTECTED_PATHS) {
    if ([protectedPath, ...SIDECARS.map(suffix => protectedPath + suffix)].includes(resolved) || within(path.dirname(protectedPath), resolved)) {
      throw new Error('O caminho nao pode apontar para um banco protegido ou sua pasta');
    }
  }
  if (within(CHECKOUT, resolved)) {
    throw new Error('Banco sintetico deve ficar fora do checkout e da pasta de dados da aplicacao');
  }
  return resolved;
}

function assertNoSymlinkComponents(candidate) {
  const resolved = path.resolve(candidate);
  let current = path.parse(resolved).root;
  // Managed filesystems may map the system root owner to a namespace UID.
  const systemUid = fs.lstatSync(current).uid;
  for (const component of resolved.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('Links simbolicos nao sao permitidos em caminhos sinteticos');
    if (stat.isDirectory() &&
        ((stat.uid !== process.getuid() && stat.uid !== systemUid) ||
         ((stat.mode & 0o022) !== 0 && (stat.mode & 0o1000) === 0))) {
      throw new Error('Diretorio ancestral permite substituicao por terceiros; use pasta privada ou temporaria com sticky bit');
    }
  }
}

function assertPrivate(stat, directory = false) {
  if (directory ? !stat.isDirectory() : !stat.isFile()) {
    throw new Error('Esperado diretorio privado ou arquivo regular sintetico');
  }
  if (typeof process.getuid !== 'function' || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) {
    throw new Error('O diretorio e os arquivos sinteticos devem ser privados e pertencer ao usuario atual (0700/0600)');
  }
  if (!directory && stat.nlink !== 1) throw new Error('Hardlinks nao sao permitidos em arquivos sinteticos');
}

function assertDirectory(directory) {
  const resolved = assertAllowedLocation(directory);
  assertNoSymlinkComponents(resolved);
  assertPrivate(fs.lstatSync(resolved), true);
  return resolved;
}

function assertFile(filePath) {
  assertNoSymlinkComponents(filePath);
  const stat = fs.lstatSync(filePath);
  assertPrivate(stat);
  return stat;
}

function inspectSyntheticDatabase({ directory, mode, dbPath }, allowRestoredIdentity = false) {
  assertMode(mode);
  // Reject forbidden paths lexically, before consulting any target or marker.
  assertAllowedLocation(dbPath);
  const root = assertDirectory(directory);
  const approvedPath = path.join(root, FILENAMES[mode]);
  if (dbPath !== approvedPath) throw new Error('O caminho deve corresponder ao banco sintetico aprovado para o modo');
  const stat = assertFile(dbPath);
  const markerPath = dbPath + '.synthetic.json';
  const markerStat = assertFile(markerPath);
  if (markerStat.size > 4096) throw new Error('Marker sintetico invalido');
  const markerText = fs.readFileSync(markerPath, 'utf8');
  const marker = JSON.parse(markerText);
  if (marker.version !== 1 || marker.mode !== mode || marker.dbPath !== dbPath || marker.directory !== root ||
      typeof marker.dev !== 'string' || !/^\d+$/.test(marker.dev) ||
      typeof marker.ino !== 'string' || !/^\d+$/.test(marker.ino) ||
      typeof marker.id !== 'string' || !/^[a-f0-9-]{36}$/.test(marker.id)) {
    throw new Error('Marker sintetico nao corresponde ao arquivo, modo e diretorio aprovados');
  }
  if (!allowRestoredIdentity && (marker.dev !== String(stat.dev) || marker.ino !== String(stat.ino))) {
    throw new Error('Identidade do arquivo sintetico mudou. Para snapshot restaurado, execute npm run db:synthetic:restore explicitamente.');
  }
  for (const suffix of SIDECARS) {
    try {
      assertFile(dbPath + suffix);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const descriptor = fs.openSync(dbPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const header = Buffer.alloc(16);
    if (fs.readSync(descriptor, header, 0, 16, 0) !== 16 || !header.equals(Buffer.from('SQLite format 3\0'))) {
      throw new Error('Arquivo SQLite sintetico invalido');
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return { selected: { dbPath, directory: root, mode, id: marker.id, dev: stat.dev, ino: stat.ino }, marker, markerText, stat, markerStat };
}

function validateSyntheticDatabase(options) {
  return inspectSyntheticDatabase(options).selected;
}

/** Explicit snapshot recovery, never invoked automatically by normal startup.
 * No database creation, data writes, permission repair, or marker fabrication.
 * The OS/private directory remains the boundary against other processes.
 */
async function restoreSyntheticDatabase(options) {
  if (process.env.NODE_ENV !== options.mode) throw new Error('NODE_ENV deve corresponder ao modo sintetico solicitado');
  const before = inspectSyntheticDatabase(options, true);
  const { selected, marker, markerText, stat, markerStat } = before;
  const markerPath = selected.dbPath + '.synthetic.json';
  function assertUnchanged() {
    const current = inspectSyntheticDatabase(options, true);
    if (current.markerText !== markerText || current.markerStat.ino !== markerStat.ino || current.markerStat.dev !== markerStat.dev ||
        current.stat.dev !== stat.dev || current.stat.ino !== stat.ino || current.stat.size !== stat.size || current.stat.mtimeMs !== stat.mtimeMs) {
      throw new Error('Arquivos mudaram durante a recuperacao; nenhuma identidade foi atualizada');
    }
    for (const suffix of SIDECARS) {
      if (fs.lstatSync(selected.dbPath + suffix, { throwIfNoEntry: false })) {
        throw new Error('Recuperacao exige banco fechado e sem auxiliares SQLite; nenhum auxiliar foi removido');
      }
    }
  }
  assertUnchanged();
  let handle;
  try {
    handle = await new Promise((resolve, reject) => {
      const opened = new sqlite3.Database(selected.dbPath, sqlite3.OPEN_READONLY | sqlite3.OPEN_FULLMUTEX,
        error => error ? reject(error) : resolve(opened));
    });
    const all = sql => new Promise((resolve, reject) => handle.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
    const identity = await all('SELECT id, mode, version FROM _rally_synthetic');
    if (identity.length !== 1 || identity[0].id !== marker.id || identity[0].mode !== marker.mode || identity[0].version !== 1) {
      throw new Error('Identificador interno nao corresponde ao marker; recuperacao recusada');
    }
    const integrity = await all('PRAGMA integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok' || (await all('PRAGMA foreign_key_check')).length) {
      throw new Error('Integridade do banco sintetico nao foi confirmada; recuperacao recusada');
    }
  } finally {
    if (handle) await new Promise((resolve, reject) => handle.close(error => error ? reject(error) : resolve()));
  }
  assertUnchanged();
  if (marker.dev === String(stat.dev) && marker.ino === String(stat.ino)) {
    return { ...selected, updated: false };
  }
  const suffix = crypto.randomUUID();
  const backupPath = markerPath + '.restore-backup-' + suffix;
  const temporaryPath = markerPath + '.restore-' + suffix + '.tmp';
  let descriptor;
  let temporaryStat;
  try {
    fs.writeFileSync(backupPath, markerText, { flag: 'wx', mode: 0o600 });
    descriptor = fs.openSync(temporaryPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
    temporaryStat = fs.fstatSync(descriptor);
    fs.writeFileSync(descriptor, JSON.stringify({ ...marker, dev: String(stat.dev), ino: String(stat.ino) }, null, 2) + '\n');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    assertUnchanged();
    fs.renameSync(temporaryPath, markerPath);
    const directoryFd = fs.openSync(selected.directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
    try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    // Only the exclusively created temporary marker is cleaned up. Backup stays.
    const remaining = fs.lstatSync(temporaryPath, { throwIfNoEntry: false });
    if (temporaryStat && remaining && remaining.ino === temporaryStat.ino && remaining.dev === temporaryStat.dev) fs.unlinkSync(temporaryPath);
  }
  return { ...validateSyntheticDatabase(options), updated: true };
}

function configuredSyntheticDatabase(mode = process.env.NODE_ENV) {
  assertMode(mode);
  if (process.env.NODE_ENV !== mode) throw new Error('NODE_ENV deve corresponder ao modo sintetico solicitado');
  const directory = process.env.RALLY_SYNTHETIC_DIR;
  const dbPath = mode === 'test' ? process.env.RALLY_TEST_DB_PATH : process.env.RALLY_DEV_DB_PATH;
  if (!directory || !dbPath) {
    throw new Error('Defina RALLY_SYNTHETIC_DIR e o RALLY_TEST_DB_PATH ou RALLY_DEV_DB_PATH explicito; o banco precisa existir antes da conexao');
  }
  return validateSyntheticDatabase({ directory, mode, dbPath });
}

async function provisionSyntheticDatabase({ directory, mode }) {
  assertMode(mode);
  const root = assertAllowedLocation(directory);
  assertNoSymlinkComponents(path.dirname(root));
  // No recursive creation or permission changes of existing user directories.
  try { fs.mkdirSync(root, { mode: 0o700 }); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  assertDirectory(root);
  const dbPath = path.join(root, FILENAMES[mode]);
  const markerPath = dbPath + '.synthetic.json';
  // Never touch preexisting database, marker, or sidecar (including dangling links).
  for (const candidate of [dbPath, markerPath, ...SIDECARS.map(suffix => dbPath + suffix)]) {
    try {
      fs.lstatSync(candidate);
      throw new Error('Criacao recusada: arquivo sintetico ja existe; nenhuma sobrescrita e permitida');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const id = crypto.randomUUID();
  const fd = fs.openSync(dbPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  const original = fs.fstatSync(fd);
  fs.closeSync(fd);
  let native;
  let markerCreated = false;
  try {
    native = await new Promise((resolve, reject) => {
      const handle = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, error => error ? reject(error) : resolve(handle));
    });
    await new Promise((resolve, reject) => native.run(
      'CREATE TABLE _rally_synthetic (id TEXT PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL)',
      error => error ? reject(error) : resolve()
    ));
    await new Promise((resolve, reject) => native.run(
      'INSERT INTO _rally_synthetic (id, mode, version) VALUES (?, ?, 1)', [id, mode],
      error => error ? reject(error) : resolve()
    ));
    await new Promise((resolve, reject) => native.close(error => error ? reject(error) : resolve()));
    native = null;
    const finalStat = assertFile(dbPath);
    if (original.dev !== finalStat.dev || original.ino !== finalStat.ino) throw new Error('Arquivo sintetico mudou durante criacao');
    fs.writeFileSync(markerPath, JSON.stringify({
      version: 1, id, mode, directory: root, dbPath,
      dev: String(finalStat.dev), ino: String(finalStat.ino)
    }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    markerCreated = true;
    return validateSyntheticDatabase({ directory: root, mode, dbPath });
  } catch (error) {
    if (native) await new Promise(resolve => native.close(() => resolve()));
    // Remove only this invocation's file, never a replacement or preexisting DB.
    const current = fs.lstatSync(dbPath, { throwIfNoEntry: false });
    if (current && current.dev === original.dev && current.ino === original.ino) fs.unlinkSync(dbPath);
    if (markerCreated) fs.unlinkSync(markerPath);
    throw error;
  }
}

module.exports = {
  provisionSyntheticDatabase, validateSyntheticDatabase, configuredSyntheticDatabase, restoreSyntheticDatabase,
  getProtectedDatabasePaths: () => [...PROTECTED_PATHS]
};
