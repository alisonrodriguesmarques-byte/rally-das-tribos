'use strict';

const { provisionSyntheticDatabase } = require('../backend/database/synthetic');

async function main() {
  const mode = process.env.NODE_ENV;
  const directory = process.env.RALLY_SYNTHETIC_DIR;
  const selected = await provisionSyntheticDatabase({ directory, mode });
  const variable = mode === 'test' ? 'RALLY_TEST_DB_PATH' : 'RALLY_DEV_DB_PATH';
  console.log('Banco sintetico criado sem sobrescrita. Configure ' + variable + '=' + selected.dbPath);
  console.log('Execute npm run init-db com o mesmo NODE_ENV e RALLY_SYNTHETIC_DIR antes de iniciar o servidor.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
