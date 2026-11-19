const fs = require('fs');
const path = require('path');
const config = require('../config');
 
function montarConfig() {
  const comum = {
    migrations: { directory: path.join(__dirname, 'migrations') },
    seeds: { directory: path.join(__dirname, 'seeds') },
  };
 
  if (config.banco.cliente === 'pg') {
    const { postgresConfig } = require('./postgres-config');
    return { ...comum, ...postgresConfig(config.banco) };
  }
 
  if (config.banco.arquivo !== ':memory:') {
    fs.mkdirSync(path.dirname(config.banco.arquivo), { recursive: true });
  }
  return {
    ...comum,
    client: 'better-sqlite3',
    connection: { filename: config.banco.arquivo },
    useNullAsDefault: true,
    pool: {
      min: 1,
      max: 1,
      afterCreate: (conn, done) => {
        conn.pragma('foreign_keys = ON');
        conn.pragma('journal_mode = WAL');
        done();
      },
    },
  };
}
 
module.exports = montarConfig();
