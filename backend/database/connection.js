/**
 * Conexão com Banco de Dados SQLite
 * Gerencia a conexão e executa queries
 */

const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { AsyncLocalStorage } = require('async_hooks');
const {
  configuredSyntheticDatabase, validateSyntheticDatabase, getProtectedDatabasePaths
} = require('./synthetic');
const configuredConnections = new WeakSet();

function getDevelopmentDatabasePath() {
  return configuredSyntheticDatabase('development').dbPath;
}

function getTestDatabasePath() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Defina NODE_ENV=test antes de usar o banco de testes');
  return configuredSyntheticDatabase('test').dbPath;
}

function assertSyntheticDatabase(database) {
  if (!configuredConnections.has(database) || database.closed || !database.db) {
    throw new Error('A configured synthetic connection is required');
  }
  const current = validateSyntheticDatabase(database.synthetic);
  if (current.id !== database.synthetic.id || current.dev !== database.synthetic.dev || current.ino !== database.synthetic.ino) {
    throw new Error('Synthetic database configuration changed');
  }
}

const nativeRun = (handle, sql) => new Promise((resolve, reject) => handle.run(sql, error => error ? reject(error) : resolve()));
const nativeGet = (handle, sql) => new Promise((resolve, reject) => handle.get(sql, (error, row) => error ? reject(error) : resolve(row)));
const nativeAll = (handle, sql) => new Promise((resolve, reject) => handle.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));

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
  constructor(dbPath) {
    this.synthetic = configuredSyntheticDatabase();
    if (dbPath !== undefined && dbPath !== this.synthetic.dbPath) {
      throw new Error('Database only accepts the explicit approved synthetic path');
    }
    this.dbPath = this.synthetic.dbPath;
    this.db = null;
    this.closed = false;
    this.unusableError = null;
    this.connecting = null;
    this.operationQueue = Promise.resolve();
    this.transactionStorage = new AsyncLocalStorage();
  }

  _assertUsable() {
    if (this.unusableError) throw this.unusableError;
    if (this.closed || !this.db || !configuredConnections.has(this)) {
      const error = new Error('Synthetic database connection is not open and configured');
      error.code = 'SQLITE_CONNECTION_NOT_READY';
      throw error;
    }
  }

  connect() {
    if (this.unusableError) throw this.unusableError;
    if (this.connecting) return this.connecting;
    if (configuredConnections.has(this)) return Promise.resolve(this);
    const selected = configuredSyntheticDatabase();
    if (selected.dbPath !== this.dbPath || selected.id !== this.synthetic.id || selected.ino !== this.synthetic.ino || selected.dev !== this.synthetic.dev) {
      throw new Error('Synthetic database changed before connection');
    }
    this.connecting = this._openSynthetic();
    return this.connecting;
  }

  async _openSynthetic() {
    let handle;
    try {
      handle = await new Promise((resolve, reject) => {
        const opened = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_FULLMUTEX,
          error => error ? reject(error) : resolve(opened));
      });
      // Provenance and paths are auxiliary checks, not proof of native handle identity.
      const markerRows = await nativeAll(handle, 'SELECT id, mode, version FROM _rally_synthetic');
      if (markerRows.length !== 1 || markerRows[0].id !== this.synthetic.id || markerRows[0].mode !== this.synthetic.mode || markerRows[0].version !== 1) {
        throw new Error('SQLite synthetic provenance is invalid');
      }
      validateSyntheticDatabase(this.synthetic);
      await nativeRun(handle, 'PRAGMA foreign_keys = ON');
      await nativeGet(handle, 'PRAGMA journal_mode = DELETE');
      await nativeRun(handle, 'PRAGMA busy_timeout = 5000');
      const foreignKeys = await nativeGet(handle, 'PRAGMA foreign_keys');
      const journal = await nativeGet(handle, 'PRAGMA journal_mode');
      const timeout = await nativeGet(handle, 'PRAGMA busy_timeout');
      if (foreignKeys.foreign_keys !== 1 || journal.journal_mode !== 'delete' || timeout.timeout !== 5000) {
        throw new Error('SQLite connection configuration could not be verified');
      }
      this.db = handle;
      this.closed = false;
      configuredConnections.add(this);
      return this;
    } catch (error) {
      if (handle) await new Promise(resolve => handle.close(() => resolve()));
      this.db = null;
      this.closed = true;
      this.unusableError = error;
      throw error;
    }
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

  exec(sql) {
    this._assertUsable();
    if (this._hasActiveTransactionContext()) return this._execRaw(sql);
    return this._enqueueOperation(() => this._execRaw(sql));
  }

  migrationTransaction(callback) {
    assertSyntheticDatabase(this);
    if (this._hasActiveTransactionContext()) return Promise.reject(new Error('Nested migrations are not allowed'));
    return this._enqueueOperation(async () => {
      assertSyntheticDatabase(this);
      await this._runRaw('PRAGMA foreign_keys = OFF');
      try {
        if ((await this._getRaw('PRAGMA foreign_keys')).foreign_keys !== 0) throw new Error('Could not disable FK for migration');
        return await this._executeTransaction(callback);
      } finally {
        if (!this.unusableError) {
          try {
            await this._runRaw('PRAGMA foreign_keys = ON');
            if ((await this._getRaw('PRAGMA foreign_keys')).foreign_keys !== 1) throw new Error('Foreign keys were not restored');
          } catch (error) {
            this.unusableError = error;
            await this._closeRaw();
            throw error;
          }
        }
      }
    });
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
            configuredConnections.delete(this);
            this.db = null;
            this.connecting = null;
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
    if (this._hasActiveTransactionContext()) return Promise.reject(new Error('Cannot close a database inside a transaction'));
    const opening = this.connecting;
    const pending = this.operationQueue.then(async () => {
      // A close requested while the native handle is opening must not leak it.
      if (opening) await opening.catch(() => undefined);
      return this._closeRaw();
    });
    this.operationQueue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  /**
   * Executa um script SQL de um arquivo
   * @param {string} filePath - Caminho do arquivo SQL
   * @returns {Promise}
   */
  async executeScript() {
    throw new Error('External SQL files are disabled; use the reviewed migration runner');
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
  const selected = configuredSyntheticDatabase();
  if (dbInstance && (dbInstanceMode !== selected.mode || dbInstance.dbPath !== selected.dbPath)) {
    throw new Error('A configuracao do banco mudou depois que a conexao foi criada');
  }

  if (!dbInstance) {
    dbInstance = new Database(selected.dbPath);
    dbInstanceMode = selected.mode;
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
  assertSyntheticDatabase,
  getProtectedDatabasePaths
};
