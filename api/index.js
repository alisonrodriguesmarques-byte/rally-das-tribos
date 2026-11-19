// Vercel chama o Express diretamente: sem listen, migrações ou seeds por requisição.
const config = require('../backend/src/config');
if (config.banco.cliente !== 'pg' || !config.banco.url) {
  throw new Error('Na Vercel, configure DB_CLIENT=pg e DATABASE_URL do Supabase. SQLite não é permitido.');
}
if (!config.jwtSecret) throw new Error('Configure JWT_SECRET na Vercel.');
module.exports = require('../backend/src/app').criarApp();
