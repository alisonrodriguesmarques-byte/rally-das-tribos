'use strict';
const { Database } = require('../backend/database/connection');
const { createBackup } = require('../backend/database/backup');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Uso: npm run db:backup -- --dest /diretorio/novo-do-backup');
    return;
  }
  if (args.length !== 2 || args[0] !== '--dest') throw new Error('Informe somente --dest /diretorio/novo-do-backup; consulte --help.');
  const db = new Database();
  try {
    await db.connect();
    const result = await createBackup(db, { directory: args[1] });
    console.log('Backup sintetico consistente e verificado: ' + result.directory);
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
