'use strict';

// Every file touched by this suite is created under its own private temporary
// directory. It never discovers, opens, copies, links or migrates existing DBs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { provisionSyntheticDatabase, restoreSyntheticDatabase, getProtectedDatabasePaths } = require('./synthetic');
const { Database, getTestDatabasePath, getDevelopmentDatabasePath } = require('./connection');
const { migrate, MIGRATIONS, assertSchemaReady } = require('./init');

const ENV_NAMES = [
  'NODE_ENV', 'RALLY_SYNTHETIC_DIR', 'RALLY_TEST_DB_PATH', 'RALLY_DEV_DB_PATH'
];

function rejection(action, message) {
  // Both synchronous configuration refusals and asynchronous SQLite failures
  // count as rejection, without coupling these tests to translated messages.
  return assert.rejects(Promise.resolve().then(action), message);
}

async function fixture(run) {
  const previous = Object.fromEntries(ENV_NAMES.map(name => [name, process.env[name]]));
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-persistence-'));
  fs.chmodSync(parent, 0o700);
  const directory = path.join(parent, 'synthetic');
  const connections = [];
  try {
    const created = await provisionSyntheticDatabase({ directory, mode: 'test' });
    assert.equal(created.directory, directory);
    assert.equal(path.dirname(created.dbPath), directory);
    process.env.NODE_ENV = 'test';
    process.env.RALLY_SYNTHETIC_DIR = directory;
    process.env.RALLY_TEST_DB_PATH = created.dbPath;
    delete process.env.RALLY_DEV_DB_PATH;
    const open = async () => {
      const db = new Database(created.dbPath);
      connections.push(db);
      await db.connect();
      return db;
    };
    await run({ ...created, parent, open, connections });
  } finally {
    for (const db of connections.reverse()) {
      await db.close();
    }
    for (const name of ENV_NAMES) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    fs.rmSync(parent, { recursive: true, force: true });
  }
}

test('synthetic persistence safety and migrations', { concurrency: false }, async t => {
  await t.test('provisions exclusively and refuses overwrite without changing files', async () => {
    await fixture(async ({ directory, dbPath }) => {
      const marker = dbPath + '.synthetic.json';
      const originalDatabase = fs.readFileSync(dbPath);
      const originalMarker = fs.readFileSync(marker);
      assert.equal(getTestDatabasePath(), dbPath);
      assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
      assert.equal(fs.statSync(dbPath).mode & 0o777, 0o600);
      await rejection(() => provisionSyntheticDatabase({ directory, mode: 'test' }));
      assert.deepEqual(fs.readFileSync(dbPath), originalDatabase);
      assert.deepEqual(fs.readFileSync(marker), originalMarker);
    });
  });

  await t.test('requires a valid matching local marker', async () => {
    await fixture(async ({ dbPath }) => {
      const marker = dbPath + '.synthetic.json';
      const original = fs.readFileSync(marker);
      fs.unlinkSync(marker);
      await rejection(() => getTestDatabasePath());
      fs.writeFileSync(marker, '{not-json', { mode: 0o600 });
      await rejection(() => getTestDatabasePath());
      fs.writeFileSync(marker, '{}', { mode: 0o600 });
      await rejection(() => getTestDatabasePath());
      fs.writeFileSync(marker, original, { mode: 0o600 });
      assert.equal(getTestDatabasePath(), dbPath);
      process.env.NODE_ENV = 'development';
      process.env.RALLY_DEV_DB_PATH = dbPath;
      await rejection(() => new Database(dbPath));
    });
  });

  await t.test('refuses permissive directories without repairing their permissions', async () => {
    await fixture(async ({ directory, parent }) => {
      fs.chmodSync(directory, 0o755);
      try {
        await rejection(() => getTestDatabasePath());
        assert.equal(fs.statSync(directory).mode & 0o777, 0o755);
      } finally {
        fs.chmodSync(directory, 0o700);
      }
      const publicDirectory = path.join(parent, 'permissive');
      fs.mkdirSync(publicDirectory, { mode: 0o755 });
      fs.chmodSync(publicDirectory, 0o755);
      await rejection(() => provisionSyntheticDatabase({ directory: publicDirectory, mode: 'test' }));
      assert.equal(fs.statSync(publicDirectory).mode & 0o777, 0o755);
      assert.deepEqual(fs.readdirSync(publicDirectory), []);
    });
  });

  await t.test('refuses a private root under a world-writable ancestor without changing permissions', async () => {
    await fixture(async ({ parent }) => {
      const ancestor = path.join(parent, 'unsafe-parent');
      const directory = path.join(ancestor, 'private-root');
      fs.mkdirSync(ancestor, { mode: 0o777 });
      fs.chmodSync(ancestor, 0o777);
      fs.mkdirSync(directory, { mode: 0o700 });
      await rejection(() => provisionSyntheticDatabase({ directory, mode: 'test' }));
      assert.equal(fs.statSync(ancestor).mode & 0o1777, 0o777);
      assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
      assert.deepEqual(fs.readdirSync(directory), []);
    });
  });

  await t.test('refuses relative paths and unrecognized environment modes', async () => {
    await fixture(async ({ dbPath, directory }) => {
      process.env.RALLY_TEST_DB_PATH = path.basename(dbPath);
      await rejection(() => getTestDatabasePath());
      process.env.RALLY_TEST_DB_PATH = dbPath;
      process.env.RALLY_SYNTHETIC_DIR = path.basename(directory);
      await rejection(() => getTestDatabasePath());
      process.env.RALLY_SYNTHETIC_DIR = directory;
      process.env.NODE_ENV = 'staging';
      await rejection(() => new Database(dbPath));
    });
  });

  await t.test('requires explicit development mode and development database configuration', async () => {
    await fixture(async ({ directory }) => {
      await rejection(() => getDevelopmentDatabasePath());
      process.env.NODE_ENV = 'development';
      delete process.env.RALLY_DEV_DB_PATH;
      await rejection(() => getDevelopmentDatabasePath());
      const created = await provisionSyntheticDatabase({ directory, mode: 'development' });
      process.env.RALLY_DEV_DB_PATH = created.dbPath;
      assert.equal(getDevelopmentDatabasePath(), created.dbPath);
      delete process.env.RALLY_SYNTHETIC_DIR;
      await rejection(() => getDevelopmentDatabasePath());
      process.env.RALLY_SYNTHETIC_DIR = directory;
      delete process.env.NODE_ENV;
      await rejection(() => getDevelopmentDatabasePath());
    });
  });

  await t.test('rejects a replaced database even when its path and marker remain', async () => {
    await fixture(async ({ dbPath }) => {
      const original = fs.readFileSync(dbPath);
      const heldOriginal = dbPath + '.original';
      fs.renameSync(dbPath, heldOriginal);
      fs.writeFileSync(dbPath, original, { mode: 0o600, flag: 'wx' });
      await rejection(() => getTestDatabasePath());
    });
  });

  await t.test('rejects database symlinks and hardlinks made only from this fixture', async () => {
    await fixture(async ({ dbPath }) => {
      const heldOriginal = dbPath + '.original';
      fs.renameSync(dbPath, heldOriginal);
      fs.symlinkSync(heldOriginal, dbPath);
      await rejection(() => getTestDatabasePath());
      fs.unlinkSync(dbPath);
      fs.renameSync(heldOriginal, dbPath);
      const hardlink = dbPath + '.alias';
      fs.linkSync(dbPath, hardlink);
      await rejection(() => getTestDatabasePath());
      fs.unlinkSync(hardlink);
      assert.equal(getTestDatabasePath(), dbPath);
    });
  });

  await t.test('rejects symlinked directory paths and marker links', async () => {
    await fixture(async ({ directory, parent, dbPath }) => {
      const alias = path.join(parent, 'directory-link');
      fs.symlinkSync(directory, alias, 'dir');
      process.env.RALLY_SYNTHETIC_DIR = alias;
      process.env.RALLY_TEST_DB_PATH = path.join(alias, path.basename(dbPath));
      await rejection(() => getTestDatabasePath());
      process.env.RALLY_SYNTHETIC_DIR = directory;
      process.env.RALLY_TEST_DB_PATH = dbPath;
      const marker = dbPath + '.synthetic.json';
      const heldMarker = marker + '.original';
      fs.renameSync(marker, heldMarker);
      fs.symlinkSync(heldMarker, marker);
      await rejection(() => getTestDatabasePath());
      fs.unlinkSync(marker);
      fs.renameSync(heldMarker, marker);
      const markerAlias = marker + '.alias';
      fs.linkSync(marker, markerAlias);
      await rejection(() => getTestDatabasePath());
    });
  });

  await t.test('rejects linked or non-file SQLite sidecars without touching their targets', async () => {
    await fixture(async ({ parent, dbPath }) => {
      const target = path.join(parent, 'synthetic-sidecar-target.txt');
      const content = 'Synthetic test fixture; never an existing database.';
      fs.writeFileSync(target, content, { mode: 0o600, flag: 'wx' });
      for (const suffix of ['-wal', '-shm', '-journal']) {
        const sidecar = dbPath + suffix;
        fs.symlinkSync(target, sidecar);
        await rejection(() => getTestDatabasePath());
        assert.equal(fs.readFileSync(target, 'utf8'), content);
        fs.unlinkSync(sidecar);
        fs.linkSync(target, sidecar);
        await rejection(() => getTestDatabasePath());
        assert.equal(fs.readFileSync(target, 'utf8'), content);
        fs.unlinkSync(sidecar);
        fs.mkdirSync(sidecar, { mode: 0o700 });
        await rejection(() => getTestDatabasePath());
        fs.rmdirSync(sidecar);
      }
      assert.equal(getTestDatabasePath(), dbPath);
    });
  });

  await t.test('refuses production, unspecified configuration and absent files without creating them', async () => {
    await fixture(async ({ directory, dbPath }) => {
      process.env.NODE_ENV = 'production';
      await rejection(() => new Database(dbPath));
      process.env.NODE_ENV = 'test';
      delete process.env.RALLY_TEST_DB_PATH;
      await rejection(() => getTestDatabasePath());
      process.env.RALLY_TEST_DB_PATH = dbPath;
      delete process.env.RALLY_SYNTHETIC_DIR;
      await rejection(() => getTestDatabasePath());
      process.env.RALLY_SYNTHETIC_DIR = directory;
      delete process.env.NODE_ENV;
      await rejection(() => new Database(dbPath));
      process.env.NODE_ENV = 'test';
      fs.unlinkSync(dbPath);
      await rejection(() => new Database(dbPath));
      assert.equal(fs.existsSync(dbPath), false);
    });
  });

  await t.test('verifies FK enforcement, journal mode and persistence after close and reopen', async () => {
    await fixture(async ({ open }) => {
      const db = await open();
      assert.equal((await db.get('PRAGMA foreign_keys')).foreign_keys, 1);
      assert.equal((await db.get('PRAGMA journal_mode')).journal_mode.toLowerCase(), 'delete');
      assert((await db.get('PRAGMA busy_timeout')).timeout > 0);
      await db.run('CREATE TABLE persistence_parent (id INTEGER PRIMARY KEY)');
      await db.run('CREATE TABLE persistence_child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES persistence_parent(id))');
      await rejection(() => db.run('INSERT INTO persistence_child VALUES (?, ?)', [1, 999]));
      await db.run('INSERT INTO persistence_parent VALUES (?)', [7]);
      await db.run('INSERT INTO persistence_child VALUES (?, ?)', [1, 7]);
      await db.close();
      const reopened = await open();
      assert.deepEqual(await reopened.all('SELECT id, parent_id FROM persistence_child'), [{ id: 1, parent_id: 7 }]);
      assert.equal((await reopened.get('PRAGMA foreign_keys')).foreign_keys, 1);
    });
  });

  await t.test('closes and invalidates a connection when internal synthetic metadata is altered', async () => {
    await fixture(async ({ dbPath, open, connections }) => {
      const writer = await open();
      await writer.run('UPDATE _rally_synthetic SET id = ?', [crypto.randomUUID()]);
      await writer.close();
      const refused = new Database(dbPath);
      connections.push(refused);
      await rejection(() => refused.connect());
      assert.equal(refused.db, null);
      assert.equal(refused.closed, true);
      await rejection(() => refused.run('CREATE TABLE must_not_exist (id INTEGER)'));
      await rejection(() => refused.connect());
    });
  });

  await t.test('close waits for an outstanding connection attempt and leaves no open handle', async () => {
    await fixture(async ({ dbPath, connections }) => {
      const db = new Database(dbPath);
      connections.push(db);
      await Promise.all([db.connect(), db.close()]);
      assert.equal(db.closed, true);
      assert.equal(db.db, null);
      await rejection(() => db.run('CREATE TABLE closed_handle_must_not_write (id INTEGER)'));
    });
  });

  await t.test('startup schema validation refuses an uninitialized database without writing to it', async () => {
    await fixture(async ({ dbPath, open }) => {
      const db = await open();
      const before = fs.readFileSync(dbPath);
      const schema = await db.all('SELECT type, name, sql FROM sqlite_master ORDER BY name');
      await rejection(() => assertSchemaReady(db));
      assert.deepEqual(await db.all('SELECT type, name, sql FROM sqlite_master ORDER BY name'), schema);
      assert.deepEqual(fs.readFileSync(dbPath), before);
      await migrate(db, { silent: true });
      await assertSchemaReady(db);
    });
  });

  await t.test('startup schema validation refuses missing application tables without repairing them', async () => {
    await fixture(async ({ dbPath, open }) => {
      const db = await open();
      await migrate(db, { silent: true });
      await db.run('DROP TABLE rallies');
      const before = fs.readFileSync(dbPath);
      const schema = await db.all('SELECT type, name, sql FROM sqlite_master ORDER BY name');
      await rejection(() => assertSchemaReady(db));
      assert.deepEqual(await db.all('SELECT type, name, sql FROM sqlite_master ORDER BY name'), schema);
      assert.deepEqual(fs.readFileSync(dbPath), before);
    });
  });

  await t.test('refuses execution of external SQL files', async () => {
    await fixture(async ({ parent, open }) => {
      const db = await open();
      const file = path.join(parent, 'external.sql');
      const sql = 'CREATE TABLE external_sql_must_not_run (id INTEGER);';
      fs.writeFileSync(file, sql, { mode: 0o600, flag: 'wx' });
      await rejection(() => db.executeScript(file));
      assert.equal(await db.get("SELECT name FROM sqlite_master WHERE name = 'external_sql_must_not_run'"), undefined);
      assert.equal(fs.readFileSync(file, 'utf8'), sql);
    });
  });

  await t.test('rolls back data and DDL together and rejects nested transactions', async () => {
    await fixture(async ({ open }) => {
      const db = await open();
      await db.run('CREATE TABLE transaction_probe (id INTEGER PRIMARY KEY, value TEXT)');
      await db.run("INSERT INTO transaction_probe VALUES (1, 'initial')");
      const failure = new Error('deliberate synthetic transaction failure');
      await assert.rejects(db.transaction(async () => {
        await db.run("UPDATE transaction_probe SET value = 'rolled-back' WHERE id = 1");
        await db.run('CREATE TABLE rolled_back_ddl (id INTEGER)');
        throw failure;
      }), error => error === failure);
      assert.equal((await db.get('SELECT value FROM transaction_probe')).value, 'initial');
      assert.equal(await db.get("SELECT name FROM sqlite_master WHERE name = 'rolled_back_ddl'"), undefined);
      await db.transaction(async () => {
        await rejection(() => db.transaction(async () => {}));
        await db.run("UPDATE transaction_probe SET value = 'committed' WHERE id = 1");
      });
      assert.equal((await db.get('SELECT value FROM transaction_probe')).value, 'committed');
      await db.transaction(async () => {
        assert.equal((await db.get('SELECT 1 AS ready')).ready, 1);
      });
    });
  });

  await t.test('refuses closing inside a transaction without interrupting its eventual commit', async () => {
    await fixture(async ({ open }) => {
      const db = await open();
      await db.run('CREATE TABLE transaction_close_probe (id INTEGER PRIMARY KEY)');
      await db.transaction(async () => {
        await rejection(() => db.close());
        await db.run('INSERT INTO transaction_close_probe VALUES (1)');
      });
      assert.equal(db.closed, false);
      assert.deepEqual(await db.all('SELECT id FROM transaction_close_probe'), [{ id: 1 }]);
    });
  });

  await t.test('migrates twice without duplicate seeds and records exact SQL checksums', async () => {
    await fixture(async ({ open }) => {
      const db = await open();
      await migrate(db, { silent: true });
      const ledger = await db.all('SELECT migration_name, checksum FROM schema_migrations ORDER BY migration_name');
      assert.equal(ledger.length, MIGRATIONS.length);
      assert.deepEqual(ledger.map(row => row.migration_name), [...MIGRATIONS].sort());
      for (const row of ledger) {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', row.migration_name));
        assert.equal(row.checksum, crypto.createHash('sha256').update(sql).digest('hex'));
      }
      const seeds = await db.all('SELECT id, nome, descricao, cor FROM categorias_pontos ORDER BY id');
      assert.equal(seeds.length, 9);
      await migrate(db, { silent: true });
      assert.deepEqual(await db.all('SELECT migration_name, checksum FROM schema_migrations ORDER BY migration_name'), ledger);
      assert.deepEqual(await db.all('SELECT id, nome, descricao, cor FROM categorias_pontos ORDER BY id'), seeds);
      assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
      assert.equal((await db.get('PRAGMA foreign_keys')).foreign_keys, 1);
    });
  });

  await t.test('refuses a tampered ledger checksum without changing migration source', async () => {
    await fixture(async ({ open }) => {
      const db = await open();
      await migrate(db, { silent: true });
      await db.run('UPDATE schema_migrations SET checksum = ? WHERE migration_name = ?', ['0'.repeat(64), MIGRATIONS[0]]);
      const ledger = await db.all('SELECT * FROM schema_migrations ORDER BY migration_name');
      const seeds = await db.all('SELECT * FROM categorias_pontos ORDER BY id');
      await rejection(() => migrate(db, { silent: true }));
      assert.deepEqual(await db.all('SELECT * FROM schema_migrations ORDER BY migration_name'), ledger);
      assert.deepEqual(await db.all('SELECT * FROM categorias_pontos ORDER BY id'), seeds);
    });
  });

  await t.test('rolls back a partially applied migration and its ledger before a successful retry', async () => {
    await fixture(async ({ open }) => {
      const db = await open();
      const originalExec = db.exec.bind(db);
      const failure = new Error('deliberate synthetic failure after seed inserts');
      let injected = false;
      let seedsWritten = 0;
      db.exec = async sql => {
        const result = await originalExec(sql);
        if (!injected && /INSERT INTO categorias_pontos/i.test(sql)) {
          injected = true;
          seedsWritten = (await db.get('SELECT COUNT(*) AS total FROM categorias_pontos')).total;
          throw failure;
        }
        return result;
      };
      try {
        await assert.rejects(migrate(db, { silent: true }), error => error === failure);
      } finally {
        db.exec = originalExec;
      }
      assert.equal(injected, true, 'the intended migration failure must actually execute');
      assert.equal(seedsWritten, 9, 'all initial seed inserts must happen before the injected failure');
      assert.equal(await db.get("SELECT name FROM sqlite_master WHERE name = 'rallies'"), undefined);
      assert.equal(await db.get("SELECT name FROM sqlite_master WHERE name = 'categorias_pontos'"), undefined);
      assert.equal(await db.get("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'"), undefined);
      assert.equal((await db.get('PRAGMA foreign_keys')).foreign_keys, 1);
      await migrate(db, { silent: true });
      assert.equal((await db.get('SELECT COUNT(*) AS total FROM schema_migrations')).total, MIGRATIONS.length);
      assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
    });
  });
  await t.test('explicit snapshot restore preserves database bytes, data and the old marker', async () => {
    await fixture(async ({ directory, dbPath, open }) => {
      const db = await open();
      await db.run('CREATE TABLE restore_probe (value TEXT)');
      await db.run('INSERT INTO restore_probe VALUES (?)', ['synthetic preserved data']);
      await db.close();
      const marker = fs.readFileSync(dbPath + '.synthetic.json');
      const bytes = fs.readFileSync(dbPath);
      fs.copyFileSync(dbPath, dbPath + '.snapshot');
      fs.chmodSync(dbPath + '.snapshot', 0o600);
      fs.renameSync(dbPath + '.snapshot', dbPath);
      await rejection(() => getTestDatabasePath());
      const options = { directory, dbPath, mode: 'test' };
      assert.equal((await restoreSyntheticDatabase(options)).updated, true);
      assert.deepEqual(fs.readFileSync(dbPath), bytes, 'restore must not write SQLite data');
      const backups = fs.readdirSync(directory).filter(name => name.includes('.restore-backup-'));
      assert.equal(backups.length, 1);
      assert.deepEqual(fs.readFileSync(path.join(directory, backups[0])), marker);
      assert.equal(getTestDatabasePath(), dbPath);
      const restored = await open();
      assert.deepEqual(await restored.all('SELECT value FROM restore_probe'), [{ value: 'synthetic preserved data' }]);
      await restored.close();
      const currentMarker = fs.readFileSync(dbPath + '.synthetic.json');
      assert.equal((await restoreSyntheticDatabase(options)).updated, false);
      assert.deepEqual(fs.readFileSync(dbPath + '.synthetic.json'), currentMarker);
      assert.equal(fs.readdirSync(directory).filter(name => name.includes('.restore-backup-')).length, 1);
    });
  });

  await t.test('restore refuses a different synthetic identity instead of adopting it', async () => {
    await fixture(async ({ directory, dbPath, parent }) => {
      const other = await provisionSyntheticDatabase({ directory: path.join(parent, 'other'), mode: 'test' });
      const marker = fs.readFileSync(dbPath + '.synthetic.json');
      fs.copyFileSync(other.dbPath, dbPath + '.replacement');
      fs.chmodSync(dbPath + '.replacement', 0o600);
      fs.renameSync(dbPath + '.replacement', dbPath);
      const before = fs.readFileSync(dbPath);
      await rejection(() => restoreSyntheticDatabase({ directory, dbPath, mode: 'test' }));
      assert.deepEqual(fs.readFileSync(dbPath), before);
      assert.deepEqual(fs.readFileSync(dbPath + '.synthetic.json'), marker);
      assert.equal(fs.readdirSync(directory).filter(name => name.includes('.restore-backup-')).length, 0);
    });
  });

  await t.test('restore refuses sidecars, links, absent markers and forbidden paths without cleanup', async () => {
    await fixture(async ({ directory, dbPath, parent }) => {
      const options = { directory, dbPath, mode: 'test' };
      const marker = fs.readFileSync(dbPath + '.synthetic.json');
      for (const suffix of ['-wal', '-shm', '-journal']) {
        fs.writeFileSync(dbPath + suffix, 'synthetic sidecar', { mode: 0o600 });
        await rejection(() => restoreSyntheticDatabase(options));
        assert.equal(fs.readFileSync(dbPath + suffix, 'utf8'), 'synthetic sidecar');
        fs.unlinkSync(dbPath + suffix);
      }
      const alias = path.join(parent, 'alias');
      fs.linkSync(dbPath, alias);
      await rejection(() => restoreSyntheticDatabase(options));
      fs.unlinkSync(alias);
      fs.renameSync(dbPath, dbPath + '.held');
      fs.symlinkSync(dbPath + '.held', dbPath);
      await rejection(() => restoreSyntheticDatabase(options));
      fs.unlinkSync(dbPath);
      fs.renameSync(dbPath + '.held', dbPath);
      fs.unlinkSync(dbPath + '.synthetic.json');
      await rejection(() => restoreSyntheticDatabase(options));
      fs.writeFileSync(dbPath + '.synthetic.json', marker, { mode: 0o600 });
      for (const protectedPath of getProtectedDatabasePaths()) {
        await rejection(() => restoreSyntheticDatabase({ ...options, dbPath: protectedPath }));
      }
      await rejection(() => restoreSyntheticDatabase({ ...options, mode: 'production' }));
      assert.deepEqual(fs.readFileSync(dbPath + '.synthetic.json'), marker);
    });
  });

});
