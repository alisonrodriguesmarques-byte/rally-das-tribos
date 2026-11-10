const path = require('path');
 
const env = process.env.NODE_ENV || 'development';
 
module.exports = {
  env,
  porta: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiracao: '7d',
  banco: {
    cliente: process.env.DB_CLIENT || 'better-sqlite3',
    arquivo: process.env.DB_FILE || path.join(__dirname, '..', '..', 'data', 'rally.sqlite'),
    url: process.env.DATABASE_URL,
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@rally.local',
    senha: process.env.ADMIN_PASSWORD,
    nome: process.env.ADMIN_NAME || 'Administrador',
  },
  frontendDir: process.env.FRONTEND_DIR || path.join(__dirname, '..', '..', '..', 'frontend', 'public'),
};
