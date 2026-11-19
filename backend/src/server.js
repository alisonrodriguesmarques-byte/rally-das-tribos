const config = require('./config');
const db = require('./database/connection');
const { criarApp } = require('./app');
 
async function iniciar() {
  if (!config.jwtSecret) throw new Error('Defina JWT_SECRET antes de iniciar o servidor.');
  if (config.banco.cliente === 'pg') await db.raw('CREATE SCHEMA IF NOT EXISTS ??', [config.banco.schema]);
  await db.migrate.latest();
  await db.seed.run();
  const app = criarApp();
  app.listen(config.porta, '0.0.0.0', () => {
    console.log(`Rally das Tribos rodando em http://localhost:${config.porta}`);
  });
}
 
iniciar().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
