'use strict';

/**
 * Reviewed migrations for explicitly provisioned synthetic databases only.
 * SQL files are read once, checked against a committed SHA-256 manifest, and
 * applied together with their ledger in one transaction. Never accepts SQL paths.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getDatabase, assertSyntheticDatabase } = require('./connection');
const manifest = require('./migration-manifest.json');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATIONS = Object.freeze([
  '001_initial_schema.sql',
  '002_add_indexes.sql',
  '003_create_views.sql',
  '004_seed_data.sql',
  '005_add_triggers.sql',
  '006_planejamento_unique_tribos_ranking.sql',
  '007_ranking_escopo_rally.sql',
  '008_integridade_pontuacao_rally_tribo.sql',
  '009_auth_sessions.sql',
  '010_duas_tribos_legado.sql',
  '011_equipes_historico.sql',
  '012_pontuacao_imediata.sql',
  '013_atividades.sql'
]);

function migrationError(message) {
  const error = new Error(message);
  error.code = 'MIGRATION_VALIDATION_FAILED';
  return error;
}

/**
 * Strip only the exact transaction/pragma lines of these hash-pinned scripts.
 * Trigger bodies keep their BEGIN/END. The runner owns the outer transaction
 * and the connection owns the foreign-key toggle outside that transaction.
 */
function transactionBody(name, sql) {
  const lines = sql.replace(/^\uFEFF/, '').split(/\r?\n/);
  const expected = name.startsWith('006_')
    ? ['PRAGMA foreign_keys = OFF;', 'BEGIN;', 'COMMIT;', 'PRAGMA foreign_keys = ON;']
    : name.startsWith('007_')
      ? ['BEGIN;', 'COMMIT;']
      : name.startsWith('008_') ? ['BEGIN IMMEDIATE;', 'COMMIT;'] : [];
  const found = [];
  const body = lines.filter(line => {
    if (/^(?:BEGIN(?: IMMEDIATE)?;|COMMIT;|PRAGMA foreign_keys = (?:OFF|ON);)$/.test(line)) {
      found.push(line);
      return false;
    }
    return true;
  }).join('\n');
  if (JSON.stringify(found) !== JSON.stringify(expected)) {
    throw migrationError('Unexpected migration transaction envelope: ' + name);
  }
  return body;
}

/** Reads fixed local files only. All validation completes before any DB writes. */
function validateMigrations() {
  if (manifest.version !== 1 || manifest.algorithm !== 'sha256' ||
      !Array.isArray(manifest.migrations) || manifest.migrations.length !== MIGRATIONS.length) {
    throw migrationError('Invalid migration manifest');
  }
  return MIGRATIONS.map((name, index) => {
    const entry = manifest.migrations[index];
    if (!entry || entry.name !== name || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw migrationError('Invalid migration manifest entry: ' + name);
    }
    const file = path.join(MIGRATIONS_DIR, name);
    if (!fs.lstatSync(file).isFile()) {
      throw migrationError('Migration must be a regular local file: ' + name);
    }
    const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let bytes;
    try {
      if (!fs.fstatSync(descriptor).isFile()) throw migrationError('Invalid migration file: ' + name);
      bytes = fs.readFileSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    if (checksum !== entry.sha256) throw migrationError('Migration checksum mismatch: ' + name);
    return Object.freeze({ name, checksum, sql: transactionBody(name, bytes.toString('utf8')) });
  });
}

async function readHistory(db, migrations) {
  const columns = await db.all('PRAGMA table_info(schema_migrations)');
  if (columns.length === 0) return [];
  if (!columns.some(column => column.name === 'migration_name') ||
      !columns.some(column => column.name === 'checksum')) {
    throw migrationError('Legacy migration ledger has no verified checksums; refusing to adopt it');
  }
  const rows = await db.all('SELECT migration_name, checksum FROM schema_migrations ORDER BY id');
  if (rows.length > migrations.length) throw migrationError('Unknown migration history');
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].migration_name !== migrations[index].name || rows[index].checksum !== migrations[index].checksum) {
      throw migrationError('Migration history is not a verified ordered prefix');
    }
  }
  return rows;
}

/** Read-only startup gate: initialization is an explicit operation, never implicit. */
async function assertSchemaReady(db) {
  assertSyntheticDatabase(db);
  const migrations = validateMigrations();
  const history = await readHistory(db, migrations);
  if (history.length !== migrations.length) {
    throw migrationError('Synthetic database schema is incomplete; run npm run init-db explicitly');
  }
  // The ledger proves which scripts ran, not that their objects still exist.
  // Require the final essential schema, including integrity triggers and the
  // uniqueness index. Additional application objects are deliberately permitted.
  const expectedSchema = manifest.required_schema;
  if (!expectedSchema || Object.keys(expectedSchema).sort().join(',') !== 'index,table,trigger,view') {
    throw migrationError('Invalid required schema manifest');
  }
  const objects = await db.all("SELECT type, name FROM sqlite_master WHERE type IN ('table', 'view', 'trigger', 'index')");
  const present = new Set(objects.map(object => object.type + ':' + object.name));
  for (const [type, names] of Object.entries(expectedSchema)) {
    if (!Array.isArray(names) || names.length === 0 || names.some(name => typeof name !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(name))) {
      throw migrationError('Invalid required schema manifest for ' + type);
    }
    for (const name of names) {
      if (!present.has(type + ':' + name)) {
        throw migrationError('Synthetic database schema is incomplete: missing ' + type + ' ' + name);
      }
    }
  }
  // Preparing each view also detects broken references, even on empty tables.
  for (const name of expectedSchema.view) await db.all('SELECT * FROM "' + name + '" LIMIT 0');
  const foreignKeys = await db.get('PRAGMA foreign_keys');
  if (foreignKeys.foreign_keys !== 1) throw migrationError('Foreign-key enforcement is disabled');
  const foreignKeyErrors = await db.all('PRAGMA foreign_key_check');
  if (foreignKeyErrors.length) throw migrationError('Foreign-key violations in synthetic database');
  const integrity = await db.all('PRAGMA quick_check');
  if (integrity.length !== 1 || integrity[0].quick_check !== 'ok') {
    throw migrationError('Quick integrity check failed in synthetic database');
  }
}

async function migrate(db, options = {}) {
  assertSyntheticDatabase(db);
  const migrations = validateMigrations();
  if (typeof db.migrationTransaction !== 'function' || typeof db.exec !== 'function') {
    throw migrationError('A verified migration-capable synthetic connection is required');
  }
  const result = await db.migrationTransaction(async () => {
    const history = await readHistory(db, migrations);
    await db.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT UNIQUE NOT NULL,
      checksum TEXT NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    const applied = [];
    for (const migration of migrations.slice(history.length)) {
      await db.exec(migration.sql);
      await db.run('INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)',
        [migration.name, migration.checksum]);
      applied.push(migration.name);
    }
    const foreignKeyErrors = await db.all('PRAGMA foreign_key_check');
    if (foreignKeyErrors.length) throw migrationError('Foreign-key violations after migrations');
    const integrity = await db.all('PRAGMA integrity_check');
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      throw migrationError('Integrity check failed after migrations');
    }
    return { applied, skipped: history.map(row => row.migration_name) };
  });
  if (!options.silent) console.log('Migrations applied: ' + result.applied.length + '; already verified: ' + result.skipped.length);
  return result;
}

async function migrateCli() {
  // Validate local artifacts before selecting or opening any database.
  validateMigrations();
  const db = getDatabase();
  try {
    await db.connect();
    const result = await migrate(db);
    console.log('Synthetic database schema verified (' + (result.applied.length + result.skipped.length) + ' migrations).');
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  migrateCli().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { migrate, MIGRATIONS, validateMigrations, assertSchemaReady };
