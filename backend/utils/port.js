/**
 * Validação, disponibilidade e escolha da porta do servidor.
 */

const net = require('net');
const readline = require('readline');

const DEFAULT_PORT = 3000;

function parsePort(value, defaultPort = DEFAULT_PORT) {
  if (value === undefined || value === null) {
    return { ok: false, error: 'Porta não informada' };
  }

  const trimmed = String(value).trim();
  if (trimmed === '') {
    return { ok: true, port: defaultPort, usedDefault: true };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Porta inválida. Informe um número entre 1 e 65535.' };
  }

  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { ok: false, error: 'Porta inválida. Informe um número entre 1 e 65535.' };
  }

  return { ok: true, port, usedDefault: false };
}

function isPortAvailable(port, host = '0.0.0.0') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

function createPrompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Resolve a porta a ser usada.
 * - skipPrompt: usa PORT ou o padrão, sem perguntar (testes / CI).
 * - ask: função injetável para testes (substitui readline).
 */
async function resolvePort(options = {}) {
  const {
    envPort = process.env.PORT,
    skipPrompt = process.env.RALLY_SKIP_PROMPT === '1' || !process.stdin.isTTY,
    ask = createPrompt,
    defaultPort = DEFAULT_PORT
  } = options;

  const tryPort = async (rawValue, source) => {
    const parsed = parsePort(rawValue, defaultPort);
    if (!parsed.ok) {
      const error = new Error(parsed.error);
      error.code = 'INVALID_PORT';
      throw error;
    }

    const available = await isPortAvailable(parsed.port);
    if (!available) {
      const error = new Error(
        `A porta ${parsed.port} já está em uso. Escolha outra porta. Nenhum processo foi encerrado.`
      );
      error.code = 'PORT_IN_USE';
      error.port = parsed.port;
      throw error;
    }

    return {
      port: parsed.port,
      usedDefault: parsed.usedDefault || source === 'default'
    };
  };

  if (envPort !== undefined && String(envPort).trim() !== '') {
    return tryPort(envPort, 'env');
  }

  if (skipPrompt) {
    return tryPort(String(defaultPort), 'default');
  }

  while (true) {
    const answer = await ask(`Qual porta deve ser utilizada? [${defaultPort}]: `);
    const parsed = parsePort(answer, defaultPort);

    if (!parsed.ok) {
      console.error(`[ERRO] ${parsed.error}`);
      continue;
    }

    const available = await isPortAvailable(parsed.port);
    if (!available) {
      console.error(
        `[ERRO] A porta ${parsed.port} já está em uso. Informe outra porta. Nenhum processo foi encerrado.`
      );
      continue;
    }

    return { port: parsed.port, usedDefault: parsed.usedDefault };
  }
}

module.exports = {
  DEFAULT_PORT,
  parsePort,
  isPortAvailable,
  resolvePort
};
