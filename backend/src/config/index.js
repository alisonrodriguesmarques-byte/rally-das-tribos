const path = require('path');
const os = require('os');
 
const env = process.env.NODE_ENV || 'development';
 
module.exports = {
  env,
  porta: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiracao: '7d',
  banco: {
    cliente: process.env.DB_CLIENT || 'better-sqlite3',
    arquivo: process.env.DB_FILE || (process.env.RENDER ? path.join(process.env.RENDER_DISK_MOUNT_PATH || os.tmpdir(), 'rally.sqlite') : path.join(__dirname, '..', '..', 'data', 'rally.sqlite')),
    url: process.env.DATABASE_URL,
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@rally.local',
    senha: process.env.ADMIN_PASSWORD,
    nome: process.env.ADMIN_NAME || 'Administrador',
  },
  frontendDir: process.env.FRONTEND_DIR || path.join(__dirname, '..', '..', '..', 'frontend', 'public'),
};

if (process.env.RENDER && !process.env.DB_FILE && !process.env.RENDER_DISK_MOUNT_PATH) {
  console.warn('Render sem disco configurado: SQLite temporário. Os dados podem ser perdidos em reinicializações e deploys. Para persistência, monte um disco e defina DB_FILE no caminho montado.');
}
