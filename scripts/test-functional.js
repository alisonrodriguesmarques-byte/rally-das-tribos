'use strict';

// Each suite gets a new synthetic database. Existing application databases are
// never selected, copied, or cleaned up by this runner.
const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SUITE_TIMEOUT_MS = 60000;
const START_TIMEOUT_MS = 15000;
const children = new Set();
let interrupted = false;

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function within(promise, milliseconds, fallback) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise(resolve => { timer = setTimeout(() => resolve(fallback), milliseconds); })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function launch(script, env, options = {}) {
  const child = spawn(process.execPath, [script, ...(options.args || [])], {
    cwd: ROOT,
    env,
    stdio: options.capture ? [options.input ? 'pipe' : 'ignore', 'pipe', 'pipe'] : [options.input ? 'pipe' : 'ignore', 'inherit', 'inherit']
  });
  children.add(child);
  if (options.input) child.stdin.end(options.input);
  let output = '';
  if (options.capture) {
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', chunk => { output = (output + chunk.toString()).slice(-16000); });
    }
  }
  const finished = new Promise(resolve => {
    child.once('error', error => resolve({ code: 1, error }));
    child.once('close', (code, signal) => resolve({ code: code ?? 1, signal }));
  }).then(result => {
    children.delete(child);
    return result;
  });
  return { child, finished, output: () => output };
}

async function stop(processState) {
  if (!processState || !children.has(processState.child)) return;
  processState.child.kill('SIGTERM');
  const stopped = await within(processState.finished.then(() => true), 3000, false);
  if (!stopped) {
    processState.child.kill('SIGKILL');
    await processState.finished;
  }
}

async function run(script, env, options = {}) {
  if (interrupted) throw new Error('Execução interrompida');
  const running = launch(script, env, options);
  const result = await within(running.finished, SUITE_TIMEOUT_MS, { code: 124, timeout: true });
  if (result.timeout) await stop(running);
  if (result.code !== 0) {
    const error = new Error(result.timeout ? `Timeout em ${script}` : `${script} falhou (saída ${result.code})`);
    error.exitCode = result.code;
    throw error;
  }
}

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function fetchLocal(url) {
  return fetch(url, { signal: AbortSignal.timeout(1000), redirect: 'error' });
}

async function waitForServer(server, baseUrl, fingerprint) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (interrupted) throw new Error('Execução interrompida');
    if (!children.has(server.child)) {
      const result = await server.finished;
      const error = new Error(`Servidor encerrou durante inicialização (saída ${result.code})`);
      error.exitCode = result.code || 1;
      throw error;
    }
    try {
      const response = await fetchLocal(baseUrl + '/api/health');
      if (response.ok) {
        const health = await response.json();
        assert.equal(health.status, 'ok');
        assert.equal(health.databaseMode, 'test');
        assert.equal(health.databaseFingerprint, fingerprint);
        return;
      }
    } catch (error) {
      // Wait only for startup/connection failures. A responsive different
      // database must never be accepted as the server owned by this runner.
      if (error.code === 'ERR_ASSERTION') throw error;
    }
    await delay(100);
  }
  throw new Error('Servidor não ficou pronto dentro do prazo');
}

async function assertLocalBoundary(baseUrl) {
  for (const [headers, label] of [
    [{ Origin: 'https://example.invalid' }, 'Origin externo'],
    [{ 'Sec-Fetch-Site': 'cross-site' }, 'requisição cross-site'],
    [{ Host: 'untrusted.invalid' }, 'Host externo']
  ]) {
    // Use the HTTP client so the supplied Host is sent verbatim, independently
    // of fetch implementations' handling of forbidden browser headers.
    const response = await new Promise((resolve, reject) => {
      const request = http.get(baseUrl + '/api/rallies', { headers, timeout: 1000 }, result => {
        result.once('error', reject);
        result.resume();
        result.once('end', () => resolve(result));
      });
      request.once('timeout', () => request.destroy(new Error('Timeout na verificação de origem local')));
      request.once('error', reject);
    });
    assert.equal(response.statusCode, 403, `${label} deve ser recusado`);
    assert.notEqual(response.headers['access-control-allow-origin'], '*', `${label} não pode liberar CORS wildcard`);
  }
}

async function smoke(baseUrl, env, verifyBoundary = false) {
  const page = await fetchLocal(baseUrl + '/');
  assert.equal(page.status, 200, 'HTML inicial deve responder 200');
  assert.notEqual(page.headers.get('access-control-allow-origin'), '*', 'HTML não pode liberar CORS wildcard');
  assert.match(page.headers.get('content-type') || '', /text\/html/);
  assert.match(await page.text(), /Rally das Tribos/);
  const response = await fetchLocal(baseUrl + '/api/rallies');
  assert.equal(response.status, 401, 'Listagem de Rallys anonima deve responder 401');
  const login = await fetch(baseUrl + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.RALLY_TEST_ADMIN_EMAIL, password: env.RALLY_TEST_ADMIN_PASSWORD }),
    signal: AbortSignal.timeout(10000)
  });
  assert.equal(login.status, 200, 'Administrador sintetico deve autenticar');
  const session = await login.json();
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const authenticated = await fetch(baseUrl + '/api/rallies', { headers: { Cookie: cookie }, signal: AbortSignal.timeout(2000) });
  assert.equal(authenticated.status, 200, 'Listagem autenticada deve responder 200');
  assert.notEqual(response.headers.get('access-control-allow-origin'), '*', 'API não pode liberar CORS wildcard');
  const result = await authenticated.json();
  assert.equal(result.success, true);
  assert(Array.isArray(result.data), 'Listagem deve retornar um array');
  if (verifyBoundary) await assertLocalBoundary(baseUrl);
  const logout = await fetch(baseUrl + '/api/auth/logout', { method: 'POST',
    headers: { Cookie: cookie, 'X-CSRF-Token': session.data.csrfToken }, signal: AbortSignal.timeout(2000) });
  assert.equal(logout.status, 200, 'Sessao do smoke deve encerrar');
}

// The provisioning interface and environment are deliberately centralized here.
async function provision(directory) {
  const { provisionSyntheticDatabase } = require('../backend/database/synthetic');
  const { dbPath } = await provisionSyntheticDatabase({ directory, mode: 'test' });
  return {
    ...process.env,
    NODE_ENV: 'test',
    RALLY_TEST_DB_PATH: dbPath,
    RALLY_SYNTHETIC_DIR: directory,
    HOST: '127.0.0.1',
    RALLY_SKIP_PROMPT: '1'
  };
}

async function suite(name, script, http) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rally-functional-'));
  let server;
  try {
    await fs.chmod(directory, 0o700);
    const env = await provision(directory);
    await run('backend/database/init.js', env);
    // Re-running the documented initializer checks its no-op migration path.
    await run('backend/database/init.js', env);
    if (http) {
      env.RALLY_TEST_ADMIN_EMAIL = 'fixture-admin-' + crypto.randomUUID() + '@example.invalid';
      env.RALLY_TEST_ADMIN_PASSWORD = 'Synthetic-' + crypto.randomBytes(24).toString('hex');
      const bootstrapSecret = crypto.randomBytes(32).toString('hex');
      await run('scripts/bootstrap-admin.js', { ...env, RALLY_BOOTSTRAP_SECRET: bootstrapSecret }, {
        args: ['--json'], input: JSON.stringify({ secret: bootstrapSecret, nome_completo: 'Administrador sintetico',
          email: env.RALLY_TEST_ADMIN_EMAIL, password: env.RALLY_TEST_ADMIN_PASSWORD })
      });
      delete env.RALLY_BOOTSTRAP_SECRET;
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      env.PORT = String(port);
      env.RALLY_TEST_API_URL = baseUrl + '/api';
      const serverEnv = { ...env };
      delete serverEnv.RALLY_TEST_ADMIN_EMAIL;
      delete serverEnv.RALLY_TEST_ADMIN_PASSWORD;
      server = launch('backend/server.js', serverEnv, { capture: true });
      const { getDatabaseFingerprint } = require('../backend/database/connection');
      await waitForServer(server, baseUrl, getDatabaseFingerprint(env.RALLY_TEST_DB_PATH));
      await smoke(baseUrl, env, true);
    }
    await run(script, env);
    if (http) await smoke(env.RALLY_TEST_API_URL.replace(/\/api$/, ''), env);
    console.log(`PASSOU: ${name}`);
  } catch (error) {
    if (server?.output()) console.error(server.output());
    throw error;
  } finally {
    await stop(server);
    // directory comes only from this invocation's mkdtemp, never from env/CLI.
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const suites = [
    ['test:repos', 'backend/database/test-repos.js', false],
    ['test:api', 'backend/database/test-api.js', true],
    ['test:review', 'backend/database/test-revisao.js', true],
    ['test:auth', 'backend/database/test-auth.js', true],
    ['test:tribes', 'backend/database/test-tribes.js', true],
    ['test:teams', 'backend/database/test-teams.js', true],
    ['test:scores', 'backend/database/test-scores.js', true],
    ['test:activities', 'backend/database/test-activities.js', true]
  ];
  const results = [];
  for (const [name, script, http] of suites) {
    if (interrupted) break;
    console.log(`\nExecutando ${name} com banco sintético independente...`);
    try {
      await suite(name, script, http);
      results.push([name, 'passou']);
    } catch (error) {
      results.push([name, 'falhou']);
      console.error(`${name}: ${error.message}`);
      process.exitCode ||= error.exitCode || 1;
    }
  }
  console.log('\nResultado funcional:');
  for (const [name] of suites) {
    console.log(`${name}: ${results.find(result => result[0] === name)?.[1] || 'não executado'}`);
  }
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.on(signal, () => {
    interrupted = true;
    process.exitCode = code;
    for (const child of children) child.kill('SIGTERM');
  });
}

main().catch(error => {
  console.error(error.message);
  process.exitCode ||= 1;
});
