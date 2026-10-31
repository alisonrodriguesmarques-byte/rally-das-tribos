'use strict';

// Optional real-browser test: only newly provisioned synthetic databases,
// random credentials, owned children and owned temporary directories are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { provisionSyntheticDatabase } = require('../backend/database/synthetic');
const { Database } = require('../backend/database/connection');
const { migrate, validateMigrations } = require('../backend/database/init');
const { bootstrapAdmin } = require('../backend/services/bootstrapService');
const RallyRepository = require('../backend/repositories/rallyRepository');
const { TRIBOS_OFICIAIS } = require('../backend/constants/tribosOficiais');

let directory, db, server, serverExit, browser;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function cleanup() {
  if (browser) { await browser.close(); browser = null; }
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
    await serverExit;
    clearTimeout(timer);
  }
  if (db) { await db.close(); db = null; }
  if (directory) { fs.rmSync(directory, { recursive: true, force: true }); directory = null; }
}

async function waitText(locator, text) {
  await locator.filter({ hasText: text }).first().waitFor({ state: 'visible' });
}
async function fits(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'team page must fit the viewport');
}
async function selectEdition(page, id) {
  await page.locator('#team-rally-select').selectOption(String(id));
  await page.waitForFunction(expected => Number(document.querySelector('#team-rally-select').value) === expected && !document.querySelector('#teams-content').hidden && document.querySelector('#team-tribes').children.length > 0, id);
}
async function createPerson(page, name, nickname) {
  await page.locator('#show-person-form').click();
  await page.locator('#person-name').fill(name);
  await page.locator('#person-nickname').fill(nickname);
  await page.locator('#person-create-submit').click();
  await page.locator('#team-assignment-card').waitFor({ state: 'visible' });
  assert.match(await page.locator('#selected-person-name').innerText(), new RegExp(name));
}
async function assign(page, tribeId, role, date) {
  await page.locator('#assignment-tribe').selectOption(String(tribeId));
  await page.locator('#assignment-role').selectOption(role);
  await page.locator('#assignment-date').fill(date);
  await page.locator('#assignment-reason').fill('Vínculo de fixture para teste de equipe');
  await page.locator('#team-assignment-submit').click();
  await page.locator('#team-assignment-card').waitFor({ state: 'hidden' });
}
async function action(page, name, button, values) {
  const row = page.locator('.team-member').filter({ hasText: name });
  await row.getByRole('button', { name: button, exact: true }).click();
  await page.locator('#team-action-dialog').waitFor({ state: 'visible' });
  if (values.tribe) await page.locator('#team-action-tribe').selectOption(String(values.tribe));
  if (values.role) await page.locator('#team-action-role').selectOption(values.role);
  await page.locator('#team-action-date').fill(values.date);
  await page.locator('#team-action-reason').fill('Movimentação de fixture para preservar o histórico');
  await page.locator('#team-action-submit').click();
  await page.locator('#team-action-dialog').waitFor({ state: 'hidden' });
}

async function main() {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { throw new Error('Teste opcional requer Playwright e Chromium instalados no ambiente.'); }
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-teams-ui-'));
  fs.chmodSync(directory, 0o700);
  const fixture = await provisionSyntheticDatabase({ directory, mode: 'test' });
  process.env.NODE_ENV = 'test';
  process.env.RALLY_SYNTHETIC_DIR = directory;
  process.env.RALLY_TEST_DB_PATH = fixture.dbPath;
  db = new Database();
  await db.connect();
  let legacyId;
  await db.migrationTransaction(async () => {
    await db.run('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration_name TEXT UNIQUE NOT NULL, checksum TEXT NOT NULL, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
    for (const migration of validateMigrations().slice(0, 9)) {
      await db.exec(migration.sql);
      await db.run('INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)', [migration.name, migration.checksum]);
    }
    const legacy = await db.run("INSERT INTO rallies (nome,data_inicio,data_fim,status) VALUES ('Edição histórica de equipes','2025-01-01','2025-03-31','encerrado')");
    legacyId = legacy.id;
    for (const tribe of TRIBOS_OFICIAIS) await db.run('INSERT INTO tribos (rally_id,nome,cor) VALUES (?,?,?)', [legacyId, tribe.nome, tribe.cor]);
  });
  await migrate(db, { silent: true });
  const repository = new RallyRepository(db);
  const first = await repository.create({ nome: 'Rally das Equipes', data_inicio: '2026-11-01', data_fim: '2026-12-31', tribos_ids: [1, 2] });
  const second = await repository.create({ nome: 'Próxima edição das Equipes', data_inicio: '2027-01-01', data_fim: '2027-03-31', tribos_ids: [3, 4] });
  await repository.start(first.id);
  const password = crypto.randomBytes(24).toString('base64url');
  const secret = crypto.randomBytes(32).toString('hex');
  const email = 'teams-ui@example.invalid';
  await bootstrapAdmin(db, { secret, nome_completo: 'Administração de Equipes', email, password }, secret);
  await db.close(); db = null;
  server = spawn(process.execPath, ['backend/server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, HOST: '127.0.0.1', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { output = (output + String(chunk)).slice(-12000); });
  serverExit = new Promise(resolve => { server.once('exit', resolve); server.once('error', resolve); });
  let port;
  const deadline = Date.now() + 15000;
  while (!(port = output.match(/local iniciado na porta (\d+)/)?.[1])) {
    if (server.exitCode !== null || Date.now() > deadline) throw new Error('Servidor não iniciou para o teste de equipes.');
    await delay(50);
  }
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:' + port, viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#login-view').waitFor({ state: 'visible' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();
  await page.locator('#workspace-view').waitFor({ state: 'visible' });
  await page.locator('#nav-scores').click();
  await page.locator('#score-edition option').filter({hasText:'Rally das Equipes'}).waitFor({state:'attached'});
  await page.locator('#score-edition').selectOption(String(first.id));
  await page.getByLabel('Pontos',{exact:true}).fill('100');
  await page.getByLabel('Justificativa',{exact:true}).fill('Atividade sintética');
  await page.getByRole('button',{name:'Lançar pontos',exact:true}).click();
  await page.getByText(/1º.*100 pontos/).waitFor();
  await page.getByText('Corrigir lançamento',{exact:true}).click();
  await page.getByLabel('Pontuação correta (zero para estornar)').fill('40');
  await page.locator('#scores-panel').getByLabel('Motivo da correção').fill('Ajuste sintético');
  await page.getByRole('button',{name:'Registrar correção'}).click();
  await page.getByText(/1º.*40 pontos/).waitFor();
  await page.setViewportSize({width:390,height:844});
  await fits(page);
  assert.equal(await page.locator('#score-error').textContent(),'');
  await page.locator('#logout-button').click();
  await page.locator('#login-view').waitFor({state:'visible'});
  assert.equal(await page.locator('#score-content').textContent(),'');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('PASSOU: pontos imediatos, correção auditável, computador/celular e limpeza no logout.');
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(signal, () => {
  process.exitCode = code;
  cleanup().finally(() => process.exit(code));
});
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(cleanup);
