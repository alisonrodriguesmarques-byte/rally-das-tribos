/**
 * Impede uma segunda instância do próprio Rally das Tribos.
 * Não encerra processos de terceiros.
 */

const fs = require('fs');
const path = require('path');

function defaultLockPath() {
  return path.join(__dirname, '../../data/.instance.lock');
}

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') {
      return true;
    }
    return false;
  }
}

function readLock(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function acquireLock(lockPath = defaultLockPath()) {
  const dir = path.dirname(lockPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(lockPath)) {
    const existing = readLock(lockPath);

    if (!existing) {
      const error = new Error(
        `Não foi possível confirmar se já existe uma instância do Rally das Tribos. ` +
          `O arquivo de lock está presente mas não pôde ser lido: ${lockPath}. ` +
          `Encerre a instância anterior (se for deste projeto) ou remova o arquivo de lock manualmente.`
      );
      error.code = 'INSTANCE_LOCK_UNKNOWN';
      error.lockPath = lockPath;
      throw error;
    }

    if (isPidAlive(existing.pid)) {
      const error = new Error(
        `Já existe uma instância do Rally das Tribos em execução (PID ${existing.pid}). ` +
          `Encerre essa instância antes de iniciar outra. Nenhum processo foi encerrado automaticamente.`
      );
      error.code = 'INSTANCE_RUNNING';
      error.pid = existing.pid;
      error.lockPath = lockPath;
      throw error;
    }

    try {
      fs.unlinkSync(lockPath);
    } catch (error) {
      const conflict = new Error(
        `Encontrado lock antigo em ${lockPath}, mas não foi possível removê-lo. Verifique permissões.`
      );
      conflict.code = 'INSTANCE_LOCK_UNKNOWN';
      throw conflict;
    }
  }

  const payload = JSON.stringify({
    pid: process.pid,
    startedAt: new Date().toISOString(),
    cwd: process.cwd()
  });

  try {
    fs.writeFileSync(lockPath, payload, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') {
      const conflict = new Error(
        'Outra instância do Rally das Tribos acabou de obter o lock. Não inicie uma segunda cópia.'
      );
      conflict.code = 'INSTANCE_RUNNING';
      throw conflict;
    }
    throw error;
  }

  return lockPath;
}

function releaseLock(lockPath = defaultLockPath()) {
  if (!fs.existsSync(lockPath)) {
    return;
  }

  const existing = readLock(lockPath);
  if (existing && existing.pid !== process.pid) {
    return;
  }

  try {
    fs.unlinkSync(lockPath);
  } catch (error) {
    console.error('Não foi possível remover o arquivo de lock:', error.message);
  }
}

module.exports = {
  defaultLockPath,
  isPidAlive,
  acquireLock,
  releaseLock
};
