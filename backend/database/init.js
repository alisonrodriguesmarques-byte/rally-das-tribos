/**
 * Script de Inicialização do Banco de Dados
 * Executa todas as migrations para criar e configurar o banco
 */

const { getDatabase } = require('./connection');
const path = require('path');
const fs = require('fs');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATIONS = [
  '001_initial_schema.sql',
  '002_add_indexes.sql',
  '003_create_views.sql',
  '004_seed_data.sql',
  '005_add_triggers.sql',
  '006_planejamento_unique_tribos_ranking.sql',
  '007_ranking_escopo_rally.sql',
  '008_integridade_pontuacao_rally_tribo.sql'
];

async function rollbackAndRestoreForeignKeys(db, foreignKeysEnabled) {
  let rollbackError = null;
  try {
    await db.run('ROLLBACK');
  } catch (error) {
    if (!/no transaction is active/i.test(error.message)) {
      rollbackError = error;
    }
  }

  let pragmaError = null;
  try {
    await db.run(`PRAGMA foreign_keys = ${foreignKeysEnabled ? 'ON' : 'OFF'}`);
  } catch (error) {
    pragmaError = error;
  }

  if (rollbackError || pragmaError) {
    const details = [rollbackError, pragmaError].filter(Boolean).map(error => error.message).join('; ');
    throw new Error(`Falha ao restaurar o estado da migration: ${details}`);
  }
}
/**
 * Executa uma migration específica
 * @param {Database} db - Instância do banco de dados
 * @param {string} migrationFile - Nome do arquivo da migration
 */
async function runMigration(db, migrationFile, silent = false) {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);

  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Arquivo de migration não encontrado: ${migrationFile}`);
  }

  if (!silent) {
    console.log(`📄 Executando: ${migrationFile}`);
  }

  const foreignKeysRow = await db.get('PRAGMA foreign_keys');
  const foreignKeysEnabled = Number(foreignKeysRow.foreign_keys) === 1;

  try {
    await db.executeScript(migrationPath);
    await db.run(`PRAGMA foreign_keys = ${foreignKeysEnabled ? 'ON' : 'OFF'}`);
    if (!silent) {
      console.log(`✅ Concluído: ${migrationFile}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao executar ${migrationFile}:`, error.message);
    try {
      await rollbackAndRestoreForeignKeys(db, foreignKeysEnabled);
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
      console.error('❌ Erro ao reverter a migration:', cleanupError.message);
    }
    throw error;
  }
}

/**
 * Cria a tabela de controle de migrations (se não existir)
 * @param {Database} db - Instância do banco de dados
 */
async function createMigrationsTable(db, silent = false) {
  const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT UNIQUE NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await db.run(sql);
  if (!silent) {
    console.log('✅ Tabela de migrations criada/verificada');
  }
}

/**
 * Verifica se uma migration já foi executada
 * @param {Database} db - Instância do banco de dados
 * @param {string} migrationName - Nome da migration
 * @returns {Promise<boolean>}
 */
async function isMigrationExecuted(db, migrationName) {
  const row = await db.get(
    'SELECT * FROM schema_migrations WHERE migration_name = ?',
    [migrationName]
  );
  return !!row;
}

/**
 * Registra uma migration como executada
 * @param {Database} db - Instância do banco de dados
 * @param {string} migrationName - Nome da migration
 */
async function markMigrationExecuted(db, migrationName) {
  await db.run(
    'INSERT INTO schema_migrations (migration_name) VALUES (?)',
    [migrationName]
  );
}

/**
 * Executa todas as migrations pendentes em uma conexão já aberta.
 * Idempotente: não reaplica arquivos já registrados.
 * Não fecha a conexão e não encerra o processo.
 */
async function migrate(db, options = {}) {
  throw new Error('Programmatic migrations are disabled in Fase 00.3.2');
  const silent = options.silent === true;

  const log = (...args) => {
    if (!silent) {
      console.log(...args);
    }
  };

  await createMigrationsTable(db, silent);

  for (const migrationFile of MIGRATIONS) {
    const executed = await isMigrationExecuted(db, migrationFile);

    if (executed) {
      log(`⏭️  Já executado: ${migrationFile} (pulando)`);
      continue;
    }

    await runMigration(db, migrationFile, silent);
    await markMigrationExecuted(db, migrationFile);
  }
}

async function migrateCli() {
  throw new Error('npm run init-db is disabled in Fase 00.3.2; no SQLite connection was opened');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏆 Rally das Tribos - Inicialização do Banco de Dados');
  console.log('═══════════════════════════════════════════════════════════\n');

  const db = getDatabase();

  try {
    await db.connect();
    await migrate(db);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Todas as migrations executadas com sucesso!');
    console.log('═══════════════════════════════════════════════════════════\n');

    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'schema_%'"
    );
    console.log(`📊 Total de tabelas criadas: ${tables.length}`);

    const views = await db.all(
      "SELECT name FROM sqlite_master WHERE type='view'"
    );
    console.log(`📊 Total de views criadas: ${views.length}`);

    const triggers = await db.all(
      "SELECT name FROM sqlite_master WHERE type='trigger'"
    );
    console.log(`📊 Total de triggers criados: ${triggers.length}`);

    const indexes = await db.all(
      "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    );
    console.log(`📊 Total de índices criados: ${indexes.length}`);

    await db.close();

    console.log('\n💚 Banco de dados inicializado com sucesso!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ Erro ao inicializar banco de dados');
    console.error('═══════════════════════════════════════════════════════════');
    console.error(error);
    console.error('═══════════════════════════════════════════════════════════\n');

    try {
      await db.close();
    } catch (closeError) {
      // conexão pode não ter sido aberta
    }
    process.exit(1);
  }
}

if (require.main === module) {
  migrateCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { migrate, MIGRATIONS };
