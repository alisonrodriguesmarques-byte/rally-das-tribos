'use strict';

// Responsive and recovery browser checks use only an owned, disposable synthetic database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { provisionSyntheticDatabase } = require('../backend/database/synthetic');
const { Database } = require('../backend/database/connection');
const { migrate } = require('../backend/database/init');
const { bootstrapAdmin } = require('../backend/services/bootstrapService');
const { AuthService } = require('../backend/services/authService');
const { TeamService } = require('../backend/services/teamService');
const { ActivitySupport } = require('../backend/services/activitySupport');
const RallyRepository = require('../backend/repositories/rallyRepository');

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

async function login(page, email, password) {
  await page.goto('/');
  await page.locator('#login-view').waitFor({ state: 'visible' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.locator('#login-submit').click();
  await page.locator('#workspace-view').waitFor({ state: 'visible' });
}

async function openEdition(page, kind, edition) {
  await page.locator('#nav-' + kind).click();
  await page.locator('#' + kind + '-edition option').filter({ hasText: edition.nome }).waitFor({ state: 'attached' });
  await page.locator('#' + kind + '-edition').selectOption(String(edition.id));
  await page.locator('#' + kind + '-content').getByText('Nenhuma atividade disponível para esta edição.', { exact: true }).or(
    page.locator('#' + kind + '-content article').first()
  ).first().waitFor();
}

async function fits(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'activity screen must fit the viewport');
}

async function main() {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { throw new Error('Teste opcional requer Playwright e Chromium instalados no ambiente.'); }

  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-responsive-ui-'));
  fs.chmodSync(directory, 0o700);
  const fixture = await provisionSyntheticDatabase({ directory, mode: 'test' });
  Object.assign(process.env, { NODE_ENV: 'test', RALLY_SYNTHETIC_DIR: directory, RALLY_TEST_DB_PATH: fixture.dbPath });
  db = new Database();
  await db.connect();
  await migrate(db, { silent: true });
  const password = crypto.randomBytes(24).toString('base64url');
  const secret = crypto.randomBytes(32).toString('hex');
  const email = 'admin-activities-ui@example.invalid';
  const admin = await bootstrapAdmin(db, { secret, nome_completo: 'Administração sintética', email, password }, secret);
  const repository = new RallyRepository(db);
  const rally = await repository.create({ nome: 'Rally das Atividades', data_inicio: '2026-01-01', data_fim: '2027-12-31', tribos_ids: [1, 2] });
  await repository.start(rally.id);
  const [tribe, otherTribe] = rally.tribos;
  const auth = new AuthService(db), teams = new TeamService(db), activities = new ActivitySupport(db);
  async function member(role, name, associate) {
    const address = role + '-ui@example.invalid';
    const user = await auth.createUser(admin.id, { nome_completo: name, email: address, password, tipo_usuario: role });
    await auth.reviewUser(admin.id, user.id, 'aprovado', 'Fixture sintética');
    const person = await teams.createParticipant(admin.id, { nome_completo: name });
    await teams.addMember(admin.id, rally.id, { tribo_id: tribe.id, participante_id: person.id, papel: role, data_entrada: '2026-01-01', motivo: 'Fixture sintética' });
    if (associate) await activities.linkAccount(admin.id, { participante_id: person.id, usuario_id: user.id, motivo: 'Fixture sintética' });
    return { user, person, email: address, name };
  }
  const head = await member('lider', 'Cabeça sintético', true);
  const participant = await member('participante', 'Participante sintético', true);
  const { MissionService } = require('../backend/services/missionService');
  const { ExamService } = require('../backend/services/examService');
  const { ScoreService } = require('../backend/services/scoreService');
  const availability = { abre_em: new Date(Date.now() - 60000).toISOString(), encerra_em: new Date(Date.now() + 3600000).toISOString() };
  const missions = new MissionService(db), exams = new ExamService(db);
  const mission = await missions.save(admin.id, rally.id, { titulo: 'Missão de responsividade ' + 'A'.repeat(100), descricao: 'Relato sintético para revisão do layout.', pontos: 200, tribos_ids: [tribe.id], ...availability });
  await missions.publish(admin.id, mission.id);
  const proof = await exams.save(admin.id, rally.id, { titulo: 'Quiz de responsividade', tipo_prova: 'quiz', respondedor: 'participantes', tribos_ids: [tribe.id], questoes: [{ enunciado: 'Questão sintética de layout', pontos: 10, alternativas: ['Uma alternativa sintética', 'Outra alternativa sintética'], correta: 0 }], ...availability });
  await exams.publish(admin.id, proof.id);
  await new ScoreService(db).mutate(admin.id, rally.id, { tribo_id: tribe.id, pontos: 100, justificativa: 'Pontos sintéticos para teste de responsividade.', request_key: crypto.randomUUID() });
  await db.close(); db = null;

  server = spawn(process.execPath, ['backend/server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { output = (output + String(chunk)).slice(-12000); });
  serverExit = new Promise(resolve => { server.once('exit', resolve); server.once('error', resolve); });
  let port;
  const deadline = Date.now() + 15000;
  while (!(port = output.match(/local iniciado na porta (\d+)/)?.[1])) {
    if (server.exitCode !== null || Date.now() > deadline) throw new Error('Servidor não iniciou para o teste de atividades.');
    await delay(50);
  }
  const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const baseURL = 'http://127.0.0.1:' + port;
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL, viewport: { width: 1440, height: 960 } })));
  const [adminPage, headPage, participantPage] = await Promise.all(contexts.map(c => c.newPage()));
  const errors = [];
  for (const page of [adminPage, headPage, participantPage]) page.on('pageerror', error => errors.push(error.message));

  const artifacts=fs.mkdtempSync(path.join(os.tmpdir(), 'rally-arena-ui-artifacts-'));
  fs.chmodSync(artifacts, 0o700);
  await login(adminPage, email, password);
  for (const width of [320, 390, 768, 1440]) {
    await adminPage.setViewportSize({ width, height: 900 });
    for (const kind of ['dashboard', 'rallies', 'teams', 'missions', 'exams', 'scores', 'users']) {
      await adminPage.locator('#nav-' + kind).click();
      await adminPage.waitForLoadState('networkidle');
      if (['missions', 'exams'].includes(kind)) {
        await adminPage.locator('#' + kind + '-edition').selectOption(String(rally.id));
        await adminPage.waitForLoadState('networkidle');
        const editor = adminPage.locator('#' + kind + '-content > details').first();
        await editor.locator('summary').click();
      } else if (kind === 'scores') {
        await adminPage.locator('#score-edition').selectOption(String(rally.id));
        await adminPage.getByText(/1º.*100 pontos/).waitFor();
      } else if (kind === 'teams') {
        await adminPage.locator('#team-rally-select').selectOption(String(rally.id));
        await adminPage.locator('#teams-content').waitFor({ state: 'visible' });
      } else if (kind === 'rallies') {
        if (!await adminPage.locator('#create-rally-card').isVisible()) await adminPage.locator('#new-rally-button').click();
        await adminPage.locator('#create-rally-card').waitFor({ state: 'visible' });
      }
      await assertLayout(adminPage, width, kind);
      if ([320,1440].includes(width)&&['exams','scores'].includes(kind)) await adminPage.screenshot({path:path.join(artifacts,'arena-'+kind+'-'+width+'.png'),fullPage:true});
    }
  }

  // A failed request must give a visible, focused error and a working retry.
  await adminPage.route('**/api/atividades/edicoes', route => route.abort('failed'));
  await adminPage.locator('#nav-missions').click();
  await adminPage.locator('#missions-error').waitFor({ state: 'visible' });
  assert.equal(await adminPage.evaluate(() => document.activeElement.id), 'missions-error');
  await adminPage.getByText('Edições indisponíveis', { exact: true }).waitFor();
  await adminPage.unroute('**/api/atividades/edicoes');
  await adminPage.locator('#refresh-missions').click();
  await adminPage.locator('#missions-edition option').filter({ hasText: rally.nome }).waitFor({ state: 'attached' });
  assert.equal(await adminPage.locator('#missions-error').textContent(), '');

  // Navigation while a response is delayed cannot overwrite the new page.
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await adminPage.route('**/api/atividades/edicoes', async route => { await gate; await route.continue(); });
  await adminPage.locator('#nav-exams').click();
  assert.equal(await adminPage.locator('#exams-edition').isDisabled(), true);
  await adminPage.getByText('Buscando suas edições do Rally…', { exact: true }).waitFor();
  await adminPage.locator('#nav-scores').click();
  release();
  await adminPage.waitForLoadState('networkidle');
  await adminPage.unroute('**/api/atividades/edicoes');
  assert.equal(await adminPage.locator('#scores-panel').isVisible(), true);
  assert.equal(await adminPage.locator('#exams-panel').isVisible(), false);
  await adminPage.locator('#nav-exams').click();
  await adminPage.locator('#exams-edition option').filter({ hasText: rally.nome }).waitFor({ state: 'attached' });
  assert.equal(await adminPage.locator('#exams-edition').isDisabled(), false);

  // A narrower reading area also models a 200% browser zoom on a desktop.
  await adminPage.setViewportSize({ width: 640, height: 900 });
  await adminPage.locator('#exams-edition').selectOption(String(rally.id));
  await adminPage.waitForLoadState('networkidle');
  await assertLayout(adminPage, 640, 'zoomed exams');

  await login(participantPage, participant.email, password);
  await participantPage.setViewportSize({ width: 320, height: 700 });
  await openEdition(participantPage, 'exams', rally);
  await participantPage.getByRole('button', { name: 'Iniciar tentativa única' }).click();
  await participantPage.getByLabel('Sua resposta', { exact: true }).waitFor();
  await assertLayout(participantPage, 320, 'participant attempt');
  await adminPage.locator('#logout-button').click();
  await adminPage.locator('#login-view').waitFor({ state: 'visible' });
  await adminPage.setViewportSize({ width: 320, height: 700 });
  await assertLayout(adminPage, 320, 'login');
  await adminPage.screenshot({path:path.join(artifacts,'arena-login-320.png'),fullPage:true});
  assert.equal(await adminPage.locator('#missions-content').textContent(), '');
  assert.equal(await adminPage.locator('#exams-content').textContent(), '');
  assert.equal(await adminPage.locator('#score-content').textContent(), '');
  assert.deepEqual(errors, []);
  console.log('PASSOU: Arena Turquesa em 320/390/768/1440 px, campos acessíveis, alvos de toque, formulários, tentativa, falha de rede, recuperação e navegação durante carregamento.');
  console.log('Capturas sintéticas: '+artifacts);
}

async function assertLayout(page, width, name) {
  await fits(page);
  const issues = await page.evaluate(mobile => {
    const errors = [];
    for (const control of document.querySelectorAll('input,select,textarea,button')) {
      const box = control.getBoundingClientRect();
      if (!box.width || !box.height || getComputedStyle(control).visibility === 'hidden') continue;
      if (box.right > innerWidth + 1 || box.left < -1) errors.push('Controle fora da tela: ' + control.id);
      if (control.matches('input,select,textarea')) {
        if (!control.labels?.length && !control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby')) errors.push('Campo sem rótulo: ' + control.id);
        if (mobile && parseFloat(getComputedStyle(control).fontSize) < 16) errors.push('Campo com fonte menor que 16px: ' + control.id);
      } else if (mobile && box.height < 43) errors.push('Botão com alvo pequeno: ' + control.id);
    }
    return errors;
  }, width <= 800);
  assert.deepEqual(issues, [], name + ' em ' + width + 'px');
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(signal, () => {
  process.exitCode = code;
  cleanup().finally(() => process.exit(code));
});
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(cleanup);
