'use strict';

const { restoreSyntheticDatabase } = require('../backend/database/synthetic');

async function main() {
  if (process.argv.length !== 2) throw new Error('Use as variaveis explicitas do banco sintetico; nenhum argumento force e aceito.');
  const mode = process.env.NODE_ENV;
  const dbPath = mode === 'test' ? process.env.RALLY_TEST_DB_PATH : process.env.RALLY_DEV_DB_PATH;
  const result = await restoreSyntheticDatabase({ mode, dbPath, directory: process.env.RALLY_SYNTHETIC_DIR });
  console.log(result.updated
    ? 'Identidade do snapshot sintetico recuperada. Banco preservado; marker anterior guardado em backup.'
    : 'Identidade sintetica ja corresponde ao arquivo. Nenhuma alteracao necessaria.');
}

main().catch(error => {
  console.error(error.code?.startsWith('SQLITE_') ? 'Banco sintetico recusado na verificacao de recuperacao.' : error.message);
  process.exitCode = 1;
});
