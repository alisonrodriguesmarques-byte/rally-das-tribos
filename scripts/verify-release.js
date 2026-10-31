'use strict';

// This command validates a candidate; it never publishes or changes a retained
// application database. Child suites provision their own synthetic fixtures.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const browserSuites = ['test:ui', 'test:teams:ui', 'test:scores:ui', 'test:activities:ui', 'test:responsive:ui'];
const browserOnly = process.argv.length === 3 && process.argv[2] === '--browser-only';
if (process.argv.length > 2 && !browserOnly) {
  console.error('Uso: node scripts/verify-release.js [--browser-only]');
  process.exit(2);
}
const suites = browserOnly ? browserSuites : ['audit:runtime', 'test', ...browserSuites];
const directory = path.join(root, 'artifacts');
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const runDirectory = path.join(directory, 'release-' + randomUUID());
fs.mkdirSync(runDirectory, { mode: 0o700 });
const report = {
  version: 1,
  startedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  scope: browserOnly ? 'browser' : 'complete',
  database: 'temporary-synthetic-fixtures',
  status: 'running',
  suites: []
};
const reportPath = path.join(runDirectory, 'report.json');
let child = null, stopping = false;

function saveReport() {
  const temporary = path.join(runDirectory, randomUUID() + '.tmp');
  fs.writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, reportPath);
}

function signalChild(signal) {
  if (!child) return;
  try {
    // Each owned child group contains only this command's suite and fixtures.
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) { if (error.code !== 'ESRCH') throw error; }
}

async function runSuite(script) {
  const started = Date.now();
  const logPath = path.join(runDirectory, script.replaceAll(':', '-') + '.log');
  const log = fs.openSync(logPath, 'wx', 0o600);
  // Never inherit an operator's database, bootstrap secret, listener or TLS
  // configuration. Keep the configured network proxy and CA trust untouched.
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('RALLY_') || ['HOST', 'PORT', 'NODE_ENV'].includes(key)) delete env[key];
  }
  const invocation = process.env.npm_execpath
    ? [process.execPath, [process.env.npm_execpath, 'run', script]]
    : ['npm', ['run', script]];
  let timedOut = false, timer, forceTimer;
  let result;
  try {
    result = await new Promise(resolve => {
      child = spawn(invocation[0], invocation[1], {
        cwd: root, env, detached: process.platform !== 'win32', stdio: ['ignore', log, log]
      });
      timer = setTimeout(() => {
        timedOut = true;
        signalChild('SIGTERM');
        forceTimer = setTimeout(() => signalChild('SIGKILL'), 8000);
      }, 240000);
      child.once('error', () => resolve({ exitCode: 1, error: 'Nao foi possivel iniciar a suite.' }));
      child.once('close', (code, signal) => resolve({ exitCode: code ?? 1, signal }));
    });
  } finally {
    clearTimeout(timer);
    clearTimeout(forceTimer);
    child = null;
    fs.closeSync(log);
  }
  const status = result.exitCode === 0 && !timedOut ? 'passed' : 'failed';
  return { script, status, ...result, timedOut, durationMs: Date.now() - started, log: logPath };
}

for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  stopping = true;
  signalChild('SIGTERM');
  setTimeout(() => signalChild('SIGKILL'), 8000).unref();
});

async function main() {
  saveReport();
  for (const script of suites) {
    if (stopping) break;
    console.log('Verificando ' + script + '...');
    const result = await runSuite(script);
    report.suites.push(result);
    saveReport();
    console.log((result.status === 'passed' ? 'PASSOU: ' : 'FALHOU: ') + script);
    if (result.status !== 'passed') {
      console.error('Detalhes: ' + result.log);
      break;
    }
  }
  report.finishedAt = new Date().toISOString();
  report.status = stopping ? 'interrupted' :
    report.suites.length === suites.length && report.suites.every(s => s.status === 'passed') ? 'passed' : 'failed';
  saveReport();
  console.log('Relatorio: ' + reportPath);
  process.exitCode = report.status === 'passed' ? 0 : stopping ? 130 : 1;
}

main().catch(error => {
  report.status = 'failed';
  report.finishedAt = new Date().toISOString();
  saveReport();
  console.error(error.message);
  process.exitCode = 1;
});
