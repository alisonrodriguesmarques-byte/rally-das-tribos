'use strict';
const { restoreBackup } = require('../backend/database/backup');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Uso: npm run db:restore -- --backup /pacote-de-backup --dest /nova-instancia-sintetica');
    return;
  }
  if (args.length !== 4 || args[0] !== '--backup' || args[2] !== '--dest') {
    throw new Error('Informe somente --backup /pacote --dest /nova-instancia; consulte --help.');
  }
  const result = await restoreBackup({ backupDirectory: args[1], directory: args[3] });
  console.log('Banco sintetico restaurado e verificado: ' + result.dbPath);
  console.log('Sessoes anteriores revogadas; entre novamente. Configure o caminho restaurado antes de iniciar o servidor.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
