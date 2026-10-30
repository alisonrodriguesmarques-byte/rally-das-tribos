/**
 * Conexão com Banco de Dados SQLite
 * Gerencia a conexão e executa queries
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const { AsyncLocalStorage } = require('async_hooks');

const DB_PATH = path.resolve(__dirname, '../../data/rally-das-tribos.db');
const DATA_DIR = path.resolve(__dirname, '../../data');
const REFERENCE_DB_PATH = process.platform === 'win32'
  ? path.join(os.homedir(), 'AppData', 'Local', 'Temp', 'rally-das-tribos-audit', 'rally-das-tribos-test.db')
  : path.join(os.tmpdir(), 'rally-das-tribos-audit', 'rally-das-tribos-test.db');
const PROTECTED_DB_PATHS = Object.freeze([DB_PATH, REFERENCE_DB_PATH]);
const verifiedWritableConnections = new WeakSet();
const WRITE_IDENTITY_UNVERIFIED = 'SQLite handle identity cannot be proven with the current driver; database access is disabled until Etapa B';

function canonicalPath(filePath) {
  const resolved = path.resolve(filePath);
  return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
}

function normalizedPath(filePath) {
  const canonical = canonicalPath(filePath);
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical;
}

function sameFile(firstPath, secondPath) {
  if (normalizedPath(firstPath) === normalizedPath(secondPath)) return true;
  if (!fs.existsSync(firstPath) || !fs.existsSync(secondPath)) return false;

  const first = fs.statSync(firstPath, { bigint: true });
  const second = fs.statSync(secondPath, { bigint: true });
  return first.dev === second.dev &&
    first.ino !== 0n &&
    second.ino !== 0n &&
    first.ino === second.ino;
}

function isWithinDirectory(directory, filePath) {
  const relative = path.relative(directory, filePath);
  return relative === '' ||
    (relative !== '..' &&
      !relative.startsWith('..' + path.sep) &&
      !path.isAbsolute(relative));
}

function assertNotProtectedDatabase(testPath) {
  const suffixes = ['', '-wal', '-shm', '-journal'];
  for (const protectedPath of PROTECTED_DB_PATHS) {
    const candidates = [testPath, ...suffixes.slice(1).map(suffix => testPath + suffix)];
    const protectedFiles = suffixes.map(suffix => protectedPath + suffix);
    if (candidates.some(candidate =>
      protectedFiles.some(protectedFile => normalizedPath(candidate) === normalizedPath(protectedFile)))) {
      throw new Error('RALLY_TEST_DB_PATH nao pode apontar para um banco protegido');
    }
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      for (const protectedFile of protectedFiles) {
        if (!fs.existsSync(protectedFile)) continue;
        const first = fs.statSync(candidate, { bigint: true });
        const second = fs.statSync(protectedFile, { bigint: true });
        if (first.dev === 0n || second.dev === 0n || first.ino === 0n || second.ino === 0n) {
          throw new Error('Nao foi possivel confirmar que o banco e seus auxiliares sao distintos dos bancos protegidos');
        }
        if (sameFile(candidate, protectedFile)) {
          throw new Error('O banco nao pode apontar para um banco protegido ou alias dele (incluindo auxiliares SQLite)');
        }
      }
    }
  }
}

function getDevelopmentDatabasePath() {
  if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
    throw new Error('Only development mode can select the development database');
  }
  const localAppData = process.env.LOCALAPPDATA;
  const configuredPath = process.env.RALLY_DEV_DB_PATH;
  if (!localAppData || !path.isAbsolute(localAppData)) {
    throw new Error('LOCALAPPDATA must be an absolute path for development mode');
  }
  if (typeof configuredPath !== 'string' || !path.isAbsolute(configuredPath)) {
    throw new Error('RALLY_DEV_DB_PATH must be an explicit absolute path');
  }

  const approvedPath = path.resolve(localAppData, 'RallyDasTribos', 'dev', 'rally-dev.db');
  const configuredResolved = path.resolve(configuredPath);
  const pathKey = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (pathKey(configuredResolved) !== pathKey(approvedPath)) {
    throw new Error('RALLY_DEV_DB_PATH must match the approved development database path');
  }

  const parent = path.dirname(approvedPath);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
    throw new Error('The development database directory must already exist');
  }
  if (!fs.existsSync(approvedPath) || !fs.statSync(approvedPath).isFile()) {
    throw new Error('The approved development database must be created explicitly before startup');
  }
  if (fs.existsSync(approvedPath)) {
    assertNotProtectedDatabase(fs.realpathSync(approvedPath));
  }
  return approvedPath;
}

/**
 * Returns the explicit, existing, writable disposable database configured for tests.
 * It never creates the database or its parent directory.
 */
function getTestDatabasePath() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Defina NODE_ENV=test antes de usar o banco de testes');
  }

  const configuredPath = process.env.RALLY_TEST_DB_PATH;
  if (typeof configuredPath !== 'string' || configuredPath.trim() === '') {
    throw new Error('RALLY_TEST_DB_PATH deve informar explicitamente o banco descartavel');
  }
  if (!path.isAbsolute(configuredPath)) {
    throw new Error('RALLY_TEST_DB_PATH precisa ser um caminho absoluto');
  }

  const resolvedPath = path.resolve(configuredPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error('O banco de teste precisa existir antes da conexao; nenhum arquivo foi criado');
  }
  if (!fs.statSync(resolvedPath).isFile()) {
    throw new Error('RALLY_TEST_DB_PATH precisa apontar para um arquivo SQLite existente');
  }

  const testPath = fs.realpathSync(resolvedPath);
  assertNotProtectedDatabase(testPath);

  let sqliteHeaderValid = false;
  try {
    const descriptor = fs.openSync(resolvedPath, 'r');
    try {
      const header = Buffer.alloc(16);
      const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
      sqliteHeaderValid =
        bytesRead === 16 &&
        header.equals(Buffer.from('SQLite format 3\0', 'ascii'));
    } finally {
      fs.closeSync(descriptor);
    }
  } catch (error) {
    throw new Error('Nao foi possivel validar o arquivo SQLite de teste em modo somente leitura');
  }
  if (!sqliteHeaderValid) {
    throw new Error('RALLY_TEST_DB_PATH nao aponta para um arquivo SQLite valido');
  }

  const dataDirectory = canonicalPath(DATA_DIR);
  if (isWithinDirectory(dataDirectory, testPath)) {
    throw new Error('O banco de teste deve ficar fora da pasta de dados da aplicacao');
  }

  try {
    fs.accessSync(testPath, fs.constants.R_OK | fs.constants.W_OK);
    fs.accessSync(path.dirname(testPath), fs.constants.W_OK);
  } catch (error) {
    throw new Error('O banco e a pasta do banco de teste precisam permitir leitura e escrita');
  }

  return testPath;
}

function getDatabaseFingerprint(filePath) {
  const realPath = fs.realpathSync(filePath);
  const stablePath = process.platform === 'win32' ? realPath.toLowerCase() : realPath;
  return crypto.createHash('sha256').update(stablePath).digest('hex');
}

/**
 * Returns a path-derived identifier only; this is not proof of physical handle identity.
 */
async function getOpenDatabaseFingerprint(database) {
  const databases = await database.all('PRAGMA database_list');
  const mainDatabase = databases.find((entry) => entry.name === 'main');
  if (!mainDatabase || !mainDatabase.file) {
    throw new Error('Nao foi possivel identificar o arquivo SQLite aberto pelo servidor');
  }
  return getDatabaseFingerprint(mainDatabase.file);
}

/**
 * Classe para gerenciar a conexão com o banco de dados
 */
class Database {
  constructor(dbPath, options = {}) {
    if (process.env.NODE_ENV === 'test') {
      const testPath = getTestDatabasePath();
      if (dbPath !== undefined && !sameFile(dbPath, testPath)) {
        throw new Error('No modo de teste, Database so pode usar RALLY_TEST_DB_PATH');
      }
      this.dbPath = testPath;
      this.allowCreate = false;
    } else {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Production database selection is not implemented in this phase');
      }
      const developmentPath = getDevelopmentDatabasePath();
      if (dbPath !== undefined && (!path.isAbsolute(dbPath) || !sameFile(dbPath, developmentPath))) {
        throw new Error('Development mode only accepts the approved RALLY_DEV_DB_PATH');
      }
      this.dbPath = developmentPath;
      this.allowCreate = false;
    }
    this.db = null;
    this.closed = false;
    this.unusableError = null;
    this.operationQueue = Promise.resolve();
    this.transactionStorage = new AsyncLocalStorage();
  }

  _assertUsable() {
    if (this.unusableError) throw this.unusableError;
    if (!verifiedWritableConnections.has(this)) {
      const error = new Error(WRITE_IDENTITY_UNVERIFIED);
      error.code = 'SQLITE_IDENTITY_UNVERIFIED';
      throw error;
    }
  }

  /**
   * Abre a conexão com o banco de dados
   * @returns {Promise<never>} This phase deliberately refuses opening SQLite.
   */
  connect() {
    if (this.unusableError) throw this.unusableError;
    if (process.env.NODE_ENV === 'test') {
      const testPath = getTestDatabasePath();
      if (!sameFile(this.dbPath, testPath)) {
        throw new Error('A conexao de teste nao corresponde a RALLY_TEST_DB_PATH');
      }
    } else {
      const developmentPath = getDevelopmentDatabasePath();
      if (!sameFile(this.dbPath, developmentPath)) {
        throw new Error('A conexao nao corresponde ao banco de desenvolvimento aprovado');
      }
    }
    const error = new Error(WRITE_IDENTITY_UNVERIFIED);
    error.code = 'SQLITE_IDENTITY_UNVERIFIED';
    throw error;
  }

  /**
   * Executa uma query que não retorna dados (INSERT, UPDATE, DELETE, CREATE, etc)
   * @param {string} sql - Query SQL
   * @param {Array} params - Parâmetros da query
   * @returns {Promise<sqlite3.RunResult>}
   */
  _hasActiveTransactionContext() {
    const context = this.transactionStorage.getStore();
    return context?.database === this && context.active;
  }

  _enqueueOperation(operation) {
    const pending = this.operationQueue.then(() => {
      this._assertUsable();
      return operation();
    });
    this.operationQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  _runRaw(sql, params = []) {
    this._assertUsable();
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  _getRaw(sql, params = []) {
    this._assertUsable();
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  _allRaw(sql, params = []) {
    this._assertUsable();
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  _execRaw(sql) {
    this._assertUsable();
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  run(sql, params = []) {
    this._assertUsable();
    if (this._hasActiveTransactionContext()) return this._runRaw(sql, params);
    return this._enqueueOperation(() => this._runRaw(sql, params));
  }

  get(sql, params = []) {
    this._assertUsable();
    if (this._hasActiveTransactionContext()) return this._getRaw(sql, params);
    return this._enqueueOperation(() => this._getRaw(sql, params));
  }

  all(sql, params = []) {
    this._assertUsable();
    if (this._hasActiveTransactionContext()) return this._allRaw(sql, params);
    return this._enqueueOperation(() => this._allRaw(sql, params));
  }

  transaction(callback) {
    const context = this.transactionStorage.getStore();
    if (context?.database === this && context.active) {
      return Promise.reject(new Error('Nested transactions on the same connection are not allowed'));
    }
    this._assertUsable();
    return this._enqueueOperation(() => this._executeTransaction(callback));
  }

  async _executeTransaction(callback) {
    this._assertUsable();
    const context = { database: this, active: true };
    return this.transactionStorage.run(context, async () => {
      let transactionStarted = false;
      try {
        await this._runRaw('BEGIN IMMEDIATE');
        transactionStarted = true;
        const result = await callback(this);
        await this._runRaw('COMMIT');
        transactionStarted = false;
        return result;
      } catch (originalError) {
        if (!transactionStarted) throw originalError;
        try {
          await this._runRaw('ROLLBACK');
          transactionStarted = false;
        } catch (rollbackError) {
          const unusableError = new Error('SQLite rollback failed; connection is unusable');
          unusableError.code = 'SQLITE_ROLLBACK_FAILED';
          unusableError.originalError = originalError;
          unusableError.rollbackError = rollbackError;
          this.unusableError = unusableError;
          console.error('Transaction failed; connection invalidated', { originalError, rollbackError });
          try {
            await this._closeRaw();
          } catch (closeError) {
            unusableError.closeError = closeError;
            console.error('Failed to close invalidated connection', closeError);
          }
          throw unusableError;
        }
        throw originalError;
      } finally {
        context.active = false;
      }
    });
  }
  _closeRaw() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Database close error:', err.message);
            reject(err);
          } else {
            this.db = null;
            this.closed = true;
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        this.closed = true;
        resolve();
      }
    });
  }

  close() {
    if (this._hasActiveTransactionContext()) return this._closeRaw();
    const pending = this.operationQueue.then(() => this._closeRaw());
    this.operationQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  /**
   * Executa um script SQL de um arquivo
   * @param {string} filePath - Caminho do arquivo SQL
   * @returns {Promise}
   */
  async executeScript(filePath) {
    this._assertUsable();
    const fs = require('fs');
    const sql = fs.readFileSync(filePath, 'utf8');
    if (this._hasActiveTransactionContext()) return this._execRaw(sql);
    return this._enqueueOperation(() => this._execRaw(sql));
  }
}

// Instância singleton do banco de dados
let dbInstance = null;
let dbInstanceMode = null;

/**
 * Obtains the database instance. Test mode is validated before any SQLite connection.
 * @returns {Database}
 */
function getDatabase() {
  const mode = process.env.NODE_ENV === 'test' ? 'test' : 'development';
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Production database selection is not implemented in this phase');
  }
  const selectedPath = mode === 'test' ? getTestDatabasePath() : getDevelopmentDatabasePath();

  if (dbInstance && (dbInstanceMode !== mode || !sameFile(dbInstance.dbPath, selectedPath))) {
    throw new Error('A configuracao do banco mudou depois que a conexao foi criada');
  }

  if (!dbInstance) {
    dbInstance = new Database(selectedPath, { allowCreate: false });
    dbInstanceMode = mode;
  }
  return dbInstance;
}

module.exports = {
  Database,
  getDatabase,
  getTestDatabasePath,
  getDatabaseFingerprint,
  getOpenDatabaseFingerprint,
  getDevelopmentDatabasePath,
  getProtectedDatabasePaths: () => PROTECTED_DB_PATHS.slice()
};
