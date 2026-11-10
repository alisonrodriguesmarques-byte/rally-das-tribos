const { spawnSync, spawn } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const backend = path.resolve(__dirname, '../backend');
if (Number(process.versions.node.split('.')[0]) !== 24) {
  console.error('Instale o Node.js 24 LTS e abra este iniciador novamente.'); process.exit(1);
}
if (!existsSync(path.join(backend, '.env'))) {
  console.error('Copie backend/.env.example para backend/.env e preencha ADMIN_PASSWORD e JWT_SECRET.'); process.exit(1);
}
try {
  const Sqlite = require(path.join(backend, 'node_modules/better-sqlite3'));
  const db = new Sqlite(':memory:'); db.close();
  require.resolve(path.join(backend, 'node_modules/express'));
} catch {
  console.log('Instalando as dependências para este computador (primeira execução)...');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['ci', '--no-audit', '--no-fund'], { cwd: backend, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error || r.status !== 0) { console.error('A instalação não terminou. Verifique a internet e tente novamente.'); process.exit(1); }
}
const server = spawn(process.execPath, ['--env-file=.env', 'src/server.js'], { cwd: backend, stdio: 'inherit' });
server.on('error', (err) => { console.error(err.message); process.exitCode = 1; });
server.on('exit', (code) => { process.exitCode = code || 0; });
