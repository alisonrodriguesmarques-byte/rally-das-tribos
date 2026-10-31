'use strict';

const fs = require('node:fs');
const path = require('node:path');
const tls = require('node:tls');
const { X509Certificate } = require('node:crypto');

const CHECKOUT = path.resolve(__dirname, '../..');
const MAX_PEM_BYTES = 512 * 1024;

function readPem(filePath, privateKey) {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
    throw new Error('TLS exige caminhos absolutos para certificado e chave.');
  }
  const resolved = path.resolve(filePath);
  if (resolved === CHECKOUT || resolved.startsWith(CHECKOUT + path.sep)) {
    throw new Error('Material TLS deve ficar fora do checkout.');
  }
  if (fs.realpathSync(resolved) !== resolved) {
    throw new Error('TLS recusa caminhos com links simbolicos.');
  }
  const fd = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size < 1 || stat.size > MAX_PEM_BYTES) {
      throw new Error('Arquivo TLS invalido.');
    }
    if (privateKey && (![0o400, 0o600].includes(stat.mode & 0o777) || (typeof process.getuid === 'function' && stat.uid !== process.getuid()))) {
      throw new Error('Chave TLS exige proprietario do processo e permissoes privadas (0600 ou 0400).');
    }
    return fs.readFileSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function readTransportConfig(env = process.env) {
  const host = env.HOST || '127.0.0.1';
  const port = env.PORT || '3000';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) {
    throw new Error('Nesta etapa o servidor sintetico aceita apenas HOST de loopback.');
  }
  if (!/^\d+$/.test(String(port)) || Number(port) > 65535) throw new Error('PORT invalida.');
  const certPath = env.RALLY_TLS_CERT_PATH;
  const keyPath = env.RALLY_TLS_KEY_PATH;
  if (Boolean(certPath) !== Boolean(keyPath)) {
    throw new Error('Configure RALLY_TLS_CERT_PATH e RALLY_TLS_KEY_PATH juntos.');
  }
  if (!certPath) return { host, port: Number(port), protocol: 'http:', tls: null };
  const cert = readPem(certPath, false);
  const key = readPem(keyPath, true);
  const certificate = new X509Certificate(cert);
  const now = Date.now();
  if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) <= now) {
    throw new Error('Certificado TLS fora da validade.');
  }
  const options = { cert, key, minVersion: 'TLSv1.2' };
  // This validates the certificate/key pair before the database is opened.
  tls.createSecureContext(options);
  return { host, port: Number(port), protocol: 'https:', tls: options };
}

function protectRequest(req, res, next) {
  const host = req.get('host') || '';
  const hostPort = host.match(/:(\d+)$/)?.[1];
  let hostCount = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() === 'host') hostCount++;
  }
  if (hostCount !== 1 || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(host) || hostPort && Number(hostPort) > 65535) {
    return res.status(403).json({ error: 'Host local invalido' });
  }
  // No reverse proxy is trusted in this workflow. In particular these headers
  // cannot switch an HTTP request into HTTPS or change the accepted origin.
  if (Object.keys(req.headers).some(name => name === 'forwarded' || name.startsWith('x-forwarded-'))) {
    return res.status(403).json({ error: 'Proxy nao configurado' });
  }
  if (req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Origem nao permitida' });
  }
  const protocol = req.socket.encrypted === true ? 'https:' : 'http:';
  const origin = req.get('origin');
  if (origin && origin !== new URL(protocol + '//' + host).origin) {
    return res.status(403).json({ error: 'Origem nao permitida' });
  }
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (protocol === 'https:') res.set('Strict-Transport-Security', 'max-age=86400');
  next();
}

module.exports = { readTransportConfig, protectRequest };
