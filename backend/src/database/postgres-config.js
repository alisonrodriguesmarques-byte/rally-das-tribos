const pg = require('pg');
// DATE deve continuar YYYY-MM-DD, sem conversão de fuso no navegador.
pg.types.setTypeParser(1082, (value) => value);
function postgresConfig(banco) {
  if (!banco.url) throw new Error('Defina DATABASE_URL para PostgreSQL.');
  if (!/^[a-z_][a-z0-9_]*$/.test(banco.schema) || banco.schema === 'public') throw new Error('DB_SCHEMA deve ser um schema privado, por exemplo rally.');
  let url;
  try { url = new URL(banco.url); } catch { throw new Error('DATABASE_URL inválida. Confira a conexão PostgreSQL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL deve usar postgresql://.');
  // Evita que sslmode da URL sobrescreva a validação do certificado.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (process.env.DB_SSL === 'false' && !local) throw new Error('DB_SSL=false permitido apenas em banco local de teste.');
  const ssl = process.env.DB_SSL === 'false' ? false : {
    rejectUnauthorized: true,
    ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}),
  };
  return {
    client: 'pg',
    connection: { connectionString: url.toString(), ssl },
    searchPath: [banco.schema],
    migrations: { directory: require('path').join(__dirname, 'migrations'), schemaName: banco.schema },
    pool: { min: 0, max: 5 },
    acquireConnectionTimeout: 30000,
  };
}
module.exports = { postgresConfig };
