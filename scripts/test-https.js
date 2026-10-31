'use strict';

// Every certificate, credential, process and database belongs to this test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const https = require('node:https');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { readTransportConfig } = require('../backend/config/httpTransport');
const { provisionSyntheticDatabase } = require('../backend/database/synthetic');
const { Database } = require('../backend/database/connection');
const { migrate } = require('../backend/database/init');
const { bootstrapAdmin } = require('../backend/services/bootstrapService');

const ROOT = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function openssl(args) {
  const result = spawnSync('openssl', args, { stdio: 'ignore', timeout: 15000 });
  if (result.error || result.status !== 0) throw new Error('OpenSSL indisponivel ou fixture TLS invalida.');
}

function certificates(directory) {
  const caKey = path.join(directory, 'ca.key');
  const caCert = path.join(directory, 'ca.crt');
  const key = path.join(directory, 'server.key');
  const cert = path.join(directory, 'server.crt');
  const csr = path.join(directory, 'server.csr');
  const extensions = path.join(directory, 'extensions.cnf');
  fs.writeFileSync(extensions, 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n', { mode: 0o600 });
  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1', '-keyout', caKey, '-out', caCert, '-subj', '/CN=Rally synthetic test CA']);
  openssl(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-keyout', key, '-out', csr, '-subj', '/CN=localhost']);
  openssl(['x509', '-req', '-in', csr, '-CA', caCert, '-CAkey', caKey, '-set_serial', '1', '-days', '1', '-sha256', '-extfile', extensions, '-out', cert]);
  for (const filename of [caKey, key]) fs.chmodSync(filename, 0o600);
  return { key, cert, ca: fs.readFileSync(caCert) };
}

async function startServer(env) {
  const processState = spawn(process.execPath, ['backend/server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [processState.stdout, processState.stderr]) stream.on('data', chunk => { output = (output + String(chunk)).slice(-10000); });
  const finished = new Promise(resolve => { processState.once('exit', resolve); processState.once('error', resolve); });
  async function stop() {
    if (processState.exitCode !== null) return;
    processState.kill('SIGTERM');
    const timer = setTimeout(() => processState.kill('SIGKILL'), 5000);
    try { await finished; } finally { clearTimeout(timer); }
  }
  const deadline = Date.now() + 15000;
  let port;
  while (!(port = output.match(/local iniciado na porta (\d+)/)?.[1])) {
    if (processState.exitCode !== null || Date.now() > deadline) {
      await stop();
      throw new Error('Servidor de fixture HTTPS nao iniciou.');
    }
    await delay(50);
  }
  return { port: Number(port), stop };
}

function request(port, ca, route, options = {}) {
  const transport = options.http ? http : https;
  const payload = options.body === undefined ? null : JSON.stringify(options.body);
  return new Promise((resolve, reject) => {
    const req = transport.request({
      host: '127.0.0.1', port, path: route, method: options.method || 'GET',
      ca, agent: false, minVersion: 'TLSv1.2', servername: options.servername || 'localhost',
      headers: { ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}), ...options.headers }
    }, res => {
      let text = '';
      res.setEncoding('utf8');
      const authorized = res.socket.authorized;
      const protocol = res.socket.getProtocol?.();
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, authorized, protocol }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('Timeout em fixture HTTPS')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('HTTPS configuration and authenticated transport', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-https-'));
  fs.chmodSync(directory, 0o700);
  let db, tlsServer, httpServer;
  try {
    const tlsDir = path.join(directory, 'tls');
    fs.mkdirSync(tlsDir, { mode: 0o700 });
    const tls = certificates(tlsDir);
    const config = { HOST: '127.0.0.1', PORT: '0', RALLY_TLS_CERT_PATH: tls.cert, RALLY_TLS_KEY_PATH: tls.key };
    await t.test('partial, unsafe and mismatched TLS configurations fail closed', () => {
      assert.equal(readTransportConfig({}).protocol, 'http:');
      assert.equal(readTransportConfig(config).tls.minVersion, 'TLSv1.2');
      assert.throws(() => readTransportConfig({ ...config, RALLY_TLS_KEY_PATH: '' }), /juntos/);
      assert.throws(() => readTransportConfig({ ...config, RALLY_TLS_KEY_PATH: 'relative.key' }), /absolutos/);
      assert.throws(() => readTransportConfig({ ...config, RALLY_TLS_KEY_PATH: path.join(ROOT, 'key.pem') }), /checkout/);
      assert.throws(() => readTransportConfig({ ...config, HOST: '0.0.0.0' }), /loopback/);
      fs.chmodSync(tls.key, 0o644);
      assert.throws(() => readTransportConfig(config), /privadas/);
      fs.chmodSync(tls.key, 0o600);
      const linkedKey = path.join(tlsDir, 'linked.key');
      fs.symlinkSync(tls.key, linkedKey);
      assert.throws(() => readTransportConfig({ ...config, RALLY_TLS_KEY_PATH: linkedKey }), /simbolicos/);
      const hardKey = path.join(tlsDir, 'hard.key');
      fs.linkSync(tls.key, hardKey);
      assert.throws(() => readTransportConfig(config), /Arquivo TLS/);
      fs.unlinkSync(hardKey);
      const wrongKey = path.join(tlsDir, 'wrong.key');
      fs.writeFileSync(wrongKey, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
      assert.throws(() => readTransportConfig({ ...config, RALLY_TLS_KEY_PATH: wrongKey }));
    });

    const dataDir = path.join(directory, 'data');
    const selected = await provisionSyntheticDatabase({ directory: dataDir, mode: 'test' });
    Object.assign(process.env, { NODE_ENV: 'test', RALLY_SYNTHETIC_DIR: dataDir, RALLY_TEST_DB_PATH: selected.dbPath });
    db = new Database();
    await db.connect();
    await migrate(db, { silent: true });
    const password = crypto.randomBytes(24).toString('base64url');
    const secret = crypto.randomBytes(32).toString('hex');
    const email = 'tls-admin@example.invalid';
    await bootstrapAdmin(db, { secret, nome_completo: 'Administração sintética TLS', email, password }, secret);
    await db.close(); db = null;
    tlsServer = await startServer({ ...process.env, ...config });
    const { port } = tlsServer;
    const origin = 'https://127.0.0.1:' + port;

    await t.test('certificate chain and hostname are verified, HTTPS serves the app and plaintext is rejected', async () => {
      const health = await request(port, tls.ca, '/api/health');
      assert.equal(health.status, 200);
      assert.equal(health.authorized, true);
      assert(['TLSv1.2', 'TLSv1.3'].includes(health.protocol));
      assert.equal(JSON.parse(health.text).databaseMode, 'test');
      assert.equal(health.headers['strict-transport-security'], 'max-age=86400');
      assert.match((await request(port, tls.ca, '/')).text, /Rally das Tribos/);
      await assert.rejects(request(port, undefined, '/api/health'));
      await assert.rejects(request(port, tls.ca, '/api/health', { servername: 'untrusted.example' }), error => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID');
      await assert.rejects(request(port, undefined, '/api/health', { http: true }));
    });

    await t.test('origin downgrade, foreign hosts and spoofed proxy headers are refused', async () => {
      for (const headers of [
        { Origin: origin.replace('https:', 'http:') }, { Origin: 'https://untrusted.example' },
        { Host: 'untrusted.example' }, { Host: 'localhost:99999' }, { 'X-Forwarded-Proto': 'https' },
        { Forwarded: 'proto=https;host=localhost' }, { 'X-Forwarded-Host': 'localhost' },
        { 'Sec-Fetch-Site': 'cross-site' }
      ]) assert.equal((await request(port, tls.ca, '/api/health', { headers })).status, 403);
      assert.equal((await request(port, tls.ca, '/api/health', { headers: { Origin: origin } })).status, 200);
    });

    await t.test('login, session and CSRF use Secure cookies and logout clears them over TLS', async () => {
      const anonymous = await request(port, tls.ca, '/api/auth/session');
      assert.equal(anonymous.status, 401);
      assert.match(anonymous.headers['set-cookie'][0], /; Secure(?:;|$)/);
      const login = await request(port, tls.ca, '/api/auth/login', { method: 'POST', headers: { Origin: origin }, body: { email, password } });
      assert.equal(login.status, 200);
      const cookie = login.headers['set-cookie'][0];
      assert.match(cookie, /; Secure(?:;|$)/);
      assert.match(cookie, /; HttpOnly(?:;|$)/);
      assert.match(cookie, /; SameSite=Strict(?:;|$)/);
      const sessionCookie = cookie.split(';')[0];
      const { csrfToken } = JSON.parse(login.text).data;
      assert.equal((await request(port, tls.ca, '/api/auth/session', { headers: { Cookie: sessionCookie } })).status, 200);
      assert.equal((await request(port, tls.ca, '/api/auth/logout', { method: 'POST', headers: { Cookie: sessionCookie, Origin: origin }, body: {} })).status, 403);
      const logout = await request(port, tls.ca, '/api/auth/logout', { method: 'POST', headers: { Cookie: sessionCookie, Origin: origin, 'X-CSRF-Token': csrfToken }, body: {} });
      assert.equal(logout.status, 200);
      assert.match(logout.headers['set-cookie'][0], /; Secure(?:;|$)/);
      assert.equal((await request(port, tls.ca, '/api/auth/session', { headers: { Cookie: sessionCookie } })).status, 401);
    });

    await t.test('HTTP loopback remains available without trusting forwarded headers', async () => {
      await tlsServer.stop(); tlsServer = null;
      httpServer = await startServer({ ...process.env, HOST: '127.0.0.1', PORT: '0', RALLY_TLS_CERT_PATH: '', RALLY_TLS_KEY_PATH: '' });
      const health = await request(httpServer.port, undefined, '/api/health', { http: true });
      assert.equal(health.status, 200);
      assert.equal(health.headers['strict-transport-security'], undefined);
      const login = await request(httpServer.port, undefined, '/api/auth/login', { http: true, method: 'POST', body: { email, password } });
      assert.equal(login.status, 200);
      assert.doesNotMatch(login.headers['set-cookie'][0], /; Secure(?:;|$)/);
      assert.equal((await request(httpServer.port, undefined, '/api/health', { http: true, headers: { 'X-Forwarded-Proto': 'https' } })).status, 403);
    });
  } finally {
    await tlsServer?.stop();
    await httpServer?.stop();
    await db?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
