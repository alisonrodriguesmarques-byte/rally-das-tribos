'use strict';

// Optional browser integration test. Every record and credential belongs to a
// disposable synthetic database created by this process.
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

  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-activities-ui-'));
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
  const head = await member('lider', 'Cabeça sintético', false);
  const participant = await member('participante', 'Participante sintético', true);
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

  await login(adminPage, email, password);
  await openEdition(adminPage, 'missions', rally);
  const association = adminPage.locator('#missions-content > details').filter({ hasText: 'Associar conta a uma pessoa da equipe' });
  await association.locator('summary').click();
  await association.getByRole('button', { name: 'Carregar pessoas e contas aprovadas' }).click();
  await association.getByLabel('Pessoa cadastrada', { exact: true }).selectOption(String(head.person.id));
  await association.getByLabel('Conta aprovada', { exact: true }).selectOption(String(head.user.id));
  await association.getByLabel('Motivo da associação').fill('Confirmação explícita de identidade sintética');
  await association.getByRole('button', { name: 'Confirmar associação' }).click();
  await association.getByRole('button', { name: 'Carregar pessoas e contas aprovadas' }).waitFor();
  assert.equal(await adminPage.locator('#missions-error').textContent(), '');

  const missionEditor = adminPage.locator('#missions-content > details').filter({ hasText: 'Criar missão' });
  await missionEditor.locator('summary').click();
  await missionEditor.getByLabel('Título', { exact: true }).fill('Missão pelo navegador');
  await missionEditor.getByLabel('Descrição', { exact: true }).fill('Relatar uma atividade sintética.');
  await missionEditor.getByLabel(otherTribe.nome, { exact: true }).uncheck();
  await missionEditor.getByRole('button', { name: 'Salvar rascunho' }).click();
  const mission = adminPage.locator('#missions-content article').filter({ hasText: 'Missão pelo navegador' });
  await mission.getByRole('button', { name: 'Editar rascunho', exact: true }).click();
  await mission.locator('summary').click();
  await mission.getByLabel('Descrição', { exact: true }).fill('Descrição revisada pelo navegador.');
  await mission.getByRole('button', { name: 'Salvar rascunho' }).click();
  await mission.getByRole('button', { name: 'Publicar missão', exact: true }).click();
  await mission.getByRole('button', { name: 'Encerrar missão', exact: true }).waitFor();

  await login(headPage, head.email, password);
  await openEdition(headPage, 'missions', rally);
  await headPage.getByLabel('Comprovação ou relato da entrega').fill('Entrega sintética <script>throw new Error("Não executar")</script>');
  await headPage.getByRole('button', { name: 'Enviar entrega' }).click();
  await headPage.getByText(/Entrega #\d+: Pendente/).waitFor();
  assert.equal(await headPage.getByRole('button', { name: 'Enviar entrega' }).count(), 0);
  await headPage.setViewportSize({ width: 390, height: 844 });
  await fits(headPage);

  await openEdition(adminPage, 'missions', rally);
  await mission.getByLabel('Motivo da decisão').fill('Atividade cumprida e conferida');
  await mission.getByRole('button', { name: 'Registrar decisão' }).click();
  await mission.getByText(/Entrega #\d+: Aprovada/).waitFor();

  await openEdition(adminPage, 'exams', rally);
  const examEditor = adminPage.locator('#exams-content > details').filter({ hasText: 'Criar prova objetiva' });
  await examEditor.locator('summary').click();
  await examEditor.getByLabel('Título', { exact: true }).fill('Quiz pelo navegador');
  await examEditor.getByLabel('Descrição', { exact: true }).fill('Uma questão objetiva sintética.');
  await examEditor.getByLabel(otherTribe.nome, { exact: true }).uncheck();
  await examEditor.getByLabel('Enunciado', { exact: true }).fill('Selecione a segunda alternativa.');
  await examEditor.getByLabel('Alternativas (uma por linha, de 2 a 6)').fill('Primeira\nSegunda\nTerceira');
  await examEditor.getByLabel('Alternativa correta', { exact: true }).selectOption('1');
  await examEditor.getByRole('button', { name: 'Salvar rascunho' }).click();
  const exam = adminPage.locator('#exams-content article').filter({ hasText: 'Quiz pelo navegador' });
  await exam.getByRole('button', { name: 'Editar prova', exact: true }).click();
  await exam.locator('summary').click();
  assert.equal(await exam.getByLabel('Alternativa correta', { exact: true }).inputValue(), '1');
  await exam.getByLabel('Pontos da questão', { exact: true }).fill('20');
  await exam.getByRole('button', { name: 'Salvar rascunho' }).click();
  await exam.getByRole('button', { name: 'Publicar prova', exact: true }).click();
  await exam.getByRole('button', { name: 'Encerrar prova', exact: true }).waitFor();

  await login(participantPage, participant.email, password);
  await openEdition(participantPage, 'missions', rally);
  assert.equal(await participantPage.getByRole('button', { name: 'Enviar entrega' }).count(), 0);
  assert.equal(await participantPage.getByText('Entrega sintética <script>', { exact: false }).count(), 0);
  await openEdition(participantPage, 'exams', rally);
  const listing = await (await contexts[2].request.get('/api/atividades/provas/edicao/' + rally.id)).json();
  assert(!JSON.stringify(listing).includes('resposta_correta'));
  assert.equal(await participantPage.getByText('Selecione a segunda alternativa.', { exact: true }).count(), 0);
  await participantPage.getByRole('button', { name: 'Iniciar tentativa única' }).click();
  await participantPage.getByLabel('Sua resposta', { exact: true }).selectOption('1');
  await participantPage.setViewportSize({ width: 390, height: 844 });
  await fits(participantPage);
  await participantPage.getByRole('button', { name: 'Finalizar respostas', exact: true }).click();
  await participantPage.getByText('Respostas registradas: 20 pontos. O ranking já considera o resultado.', { exact: true }).waitFor();
  await openEdition(participantPage, 'exams', rally);
  await participantPage.getByText(/Resultado da tentativa #\d+: 20 pontos/).waitFor();
  assert.equal(await participantPage.getByRole('button', { name: 'Iniciar tentativa única' }).count(), 0);

  await adminPage.locator('#nav-scores').click();
  await adminPage.locator('#score-edition option').filter({ hasText: rally.nome }).waitFor({ state: 'attached' });
  await adminPage.locator('#score-edition').selectOption(String(rally.id));
  await adminPage.getByText(/1º.*220 pontos/).waitFor();
  for (const page of [adminPage, headPage, participantPage]) {
    await page.locator('#logout-button').click();
    await page.locator('#login-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#missions-content').textContent(), '');
    assert.equal(await page.locator('#exams-content').textContent(), '');
  }
  assert.deepEqual(errors, []);
  console.log('PASSOU: associação de conta, criação/edição/publicação, entrega, aprovação, quiz automático, ranking, celular e logout.');
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(signal, () => {
  process.exitCode = code;
  cleanup().finally(() => process.exit(code));
});
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(cleanup);
