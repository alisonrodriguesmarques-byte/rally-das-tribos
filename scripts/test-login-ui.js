'use strict';

// Optional browser integration suite. Uses the environment's Playwright and
// Chromium; no production account or preexisting database is ever selected.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { provisionSyntheticDatabase } = require('../backend/database/synthetic');
const { Database } = require('../backend/database/connection');
const { migrate, validateMigrations } = require('../backend/database/init');
const { TRIBOS_OFICIAIS } = require('../backend/constants/tribosOficiais');
const { bootstrapAdmin } = require('../backend/services/bootstrapService');

let server;
let browser;
let db;
let directory;
let serverExit;
let stopping = false;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function cleanup() {
    if (browser) { await browser.close(); browser = null; }
    if (server && server.exitCode === null && !stopping) {
        stopping = true;
        server.kill('SIGTERM');
        const timer = setTimeout(() => server.kill('SIGKILL'), 5000);
        await serverExit;
        clearTimeout(timer);
    }
    if (db) { await db.close(); db = null; }
    if (directory) { fs.rmSync(directory, { recursive: true, force: true }); directory = null; }
}

async function login(page, email, password) {
    await page.locator('#login-view').waitFor({ state: 'visible' });
    await page.locator('#login-email').fill(email);
    await page.locator('#login-password').fill(password);
    await page.locator('#login-submit').click();
}

async function assertFits(page) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true,
        'interface must fit the viewport without horizontal page scrolling');
}

async function main() {
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { throw new Error('Teste opcional requer Playwright e Chromium instalados no ambiente.'); }
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-login-ui-'));
    fs.chmodSync(directory, 0o700);
    const fixture = await provisionSyntheticDatabase({ directory, mode: 'test' });
    process.env.NODE_ENV = 'test';
    process.env.RALLY_SYNTHETIC_DIR = directory;
    process.env.RALLY_TEST_DB_PATH = fixture.dbPath;
    db = new Database(fixture.dbPath);
    await db.connect();
    // Build only a new synthetic fixture with the exact reviewed pre-010 schema.
    // Its twelve historical tribes must survive the new migration unchanged.
    const prefix = validateMigrations().slice(0, 9);
    await db.migrationTransaction(async () => {
        await db.run('CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration_name TEXT UNIQUE NOT NULL, checksum TEXT NOT NULL, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)');
        for (const entry of prefix) {
            await db.exec(entry.sql);
            await db.run('INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)', [entry.name, entry.checksum]);
        }
        const legacy = await db.run("INSERT INTO rallies (nome, descricao, data_inicio, data_fim, status) VALUES (?, ?, ?, ?, 'encerrado')", ['Rally histórico sintético', 'Fixture anterior à seleção de duas tribos.', '2025-01-01', '2025-03-31']);
        for (const tribe of TRIBOS_OFICIAIS) await db.run('INSERT INTO tribos (rally_id, nome, cor) VALUES (?, ?, ?)', [legacy.id, tribe.nome, tribe.cor]);
    });
    await migrate(db, { silent: true });
    const password = crypto.randomBytes(24).toString('base64url');
    const memberPassword = crypto.randomBytes(24).toString('base64url');
    const secret = crypto.randomBytes(32).toString('hex');
    const adminEmail = 'admin-ui@example.invalid';
    const memberEmail = 'participante-ui@example.invalid';
    await bootstrapAdmin(db, {
        secret, nome_completo: 'Administração da Arena', email: adminEmail, password
    }, secret);
    await db.close();
    db = null;
    let output = '';
    server = spawn(process.execPath, ['backend/server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', chunk => { output = (output + String(chunk)).slice(-12000); });
    server.stderr.on('data', chunk => { output = (output + String(chunk)).slice(-12000); });
    serverExit = new Promise(resolve => { server.once('exit', resolve); server.once('error', resolve); });
    let port;
    const deadline = Date.now() + 15000;
    while (!(port = output.match(/local iniciado na porta (\d+)/)?.[1])) {
        if (server.exitCode !== null || Date.now() > deadline) throw new Error('Servidor não iniciou para o teste de interface.');
        await delay(50);
    }
    const baseURL = 'http://127.0.0.1:' + port;
    const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, baseURL });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    const artifactDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-ui-artifacts-'));
    await page.goto('/');
    await page.locator('#login-view').waitFor({ state: 'visible' });
    await assertFits(page);
    await page.screenshot({ path: path.join(artifactDirectory, 'login-desktop.png'), fullPage: true });
    await login(page, adminEmail, 'credencial incorreta somente para teste');
    await page.locator('#login-error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#login-password').inputValue(), '');
    await login(page, adminEmail, password);
    await page.locator('#workspace-view').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.getElementById('stat-rallies').textContent === '1');
    const cookie = (await context.cookies()).find(entry => entry.name === 'rally_session');
    assert(cookie && cookie.httpOnly && cookie.sameSite === 'Strict', 'browser session cookie must be HttpOnly and SameSite Strict');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await page.screenshot({ path: path.join(artifactDirectory, 'dashboard-desktop.png'), fullPage: true });
    await page.reload();
    await page.locator('#workspace-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#session-name').textContent(), 'Administração da Arena');
    await page.locator('#nav-rallies').click();
    await page.waitForFunction(() => document.getElementById('rally-tribe-a').options.length === 13);
    const historicCard = page.locator('.rally-edition').filter({ hasText: 'Rally histórico sintético' });
    await historicCard.getByRole('button', { name: 'Consultar edição', exact: true }).click();
    await page.locator('#rally-detail-title').filter({ hasText: 'Rally histórico sintético' }).waitFor();
    assert.equal(await page.locator('#rally-detail .rally-tribe').count(), 12, 'historical edition must preserve twelve tribes');
    assert.equal(await page.locator('#rally-detail #edit-rally-tribes-form').count(), 0);
    assert.equal(await page.locator('#rally-detail .rally-actions').count(), 0, 'historical edition is consultation only');
    await page.locator('#new-rally-button').click();
    await page.locator('#rally-name').fill('Rally das Duas Tribos');
    await page.locator('#rally-description').fill('Nova edição sintética, duas equipes e uma jornada.');
    await page.locator('#rally-start-date').fill('2026-11-01');
    await page.locator('#rally-end-date').fill('2026-12-31');
    await page.locator('#rally-tribe-a').selectOption('4');
    assert.equal(await page.locator('#rally-tribe-b option[value="4"]').isDisabled(), true, 'same tribe cannot be chosen twice');
    await page.locator('#rally-tribe-b').selectOption('11');
    await page.screenshot({ path: path.join(artifactDirectory, 'rally-create-desktop.png'), fullPage: true });
    await page.locator('#create-rally-submit').click();
    await page.locator('#rally-detail-title').filter({ hasText: 'Rally das Duas Tribos' }).waitFor();
    assert.equal(await page.locator('#rally-detail .rally-tribe').count(), 2);
    assert.deepEqual((await page.locator('#rally-detail .rally-tribe h3').allTextContents()).sort(), ['Judá', 'José'].sort());
    await page.locator('#edit-rally-tribe-a').selectOption('3');
    await page.locator('#edit-rally-tribe-b').selectOption('12');
    await page.getByRole('button', { name: 'Salvar escolha das tribos', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('#rally-detail .rally-tribe h3')].map(node => node.textContent).sort().join(',') === 'Benjamim,Levi');
    await page.locator('#rally-detail').getByRole('button', { name: 'Iniciar Rally', exact: true }).click();
    await page.locator('#rally-action-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#rally-action-description').textContent(), /integrantes poderão mudar com histórico/i);
    await page.locator('#rally-action-confirm').click();
    await page.locator('#rally-detail .tag.active').waitFor();
    assert.equal(await page.locator('#edit-rally-tribes-form').count(), 0, 'chosen tribes cannot be changed after start');
    assert.match(await page.locator('#rally-detail').textContent(), /integrantes poderão mudar com histórico/i);
    await page.screenshot({ path: path.join(artifactDirectory, 'rally-active-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFits(page);
    await page.screenshot({ path: path.join(artifactDirectory, 'rally-active-mobile.png'), fullPage: true });
    for (const [label, tag] of [['Encerrar Rally', 'closed'], ['Arquivar edição', 'archived']]) {
        await page.locator('#rally-detail').getByRole('button', { name: label, exact: true }).click();
        await page.locator('#rally-action-dialog').waitFor({ state: 'visible' });
        await page.locator('#rally-action-confirm').click();
        await page.locator('#rally-detail .tag.' + tag).waitFor();
    }
    await historicCard.getByRole('button', { name: 'Consultar edição', exact: true }).click();
    await page.locator('#rally-detail-title').filter({ hasText: 'Rally histórico sintético' }).waitFor();
    assert.equal(await page.locator('#rally-detail .rally-tribe').count(), 12, 'new competition actions must not change the old edition');
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.locator('#nav-users').click();
    await page.locator('#new-user-name').fill('Participante <b>seguro</b>');
    await page.locator('#new-user-email').fill(memberEmail);
    await page.locator('#new-user-password').fill(memberPassword);
    await page.locator('#new-user-confirm').fill(memberPassword);
    await page.locator('#create-user-submit').click();
    await page.locator('#create-user-feedback').waitFor({ state: 'visible' });
    const card = page.locator('.user-item').filter({ hasText: memberEmail });
    await card.waitFor({ state: 'visible' });
    assert.equal(await card.locator('h3').textContent(), 'Participante <b>seguro</b>');
    assert.equal(await card.locator('h3 b').count(), 0, 'user-controlled display text must not be interpreted as HTML');
    assert.equal(await page.locator('#new-user-password').inputValue(), '');
    const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 }, baseURL });
    const memberPage = await memberContext.newPage();
    memberPage.on('pageerror', error => pageErrors.push(error.message));
    await memberPage.goto('/');
    await login(memberPage, memberEmail, memberPassword);
    await memberPage.locator('#login-error').waitFor({ state: 'visible' });
    assert.equal(await memberPage.locator('#workspace-view').isVisible(), false, 'pending account cannot enter');
    await card.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await page.locator('#decision-dialog').waitFor({ state: 'visible' });
    await page.locator('#decision-reason').fill('Cadastro sintético aprovado para o teste de interface.');
    await page.locator('#decision-confirm').click();
    await card.locator('.tag.approved').waitFor({ state: 'visible' });
    await assertFits(page);
    await page.screenshot({ path: path.join(artifactDirectory, 'accounts-desktop.png'), fullPage: true });
    const memberRequests = [];
    memberPage.on('request', request => { if (request.url().startsWith(baseURL + '/api/')) memberRequests.push(new URL(request.url()).pathname); });
    await login(memberPage, memberEmail, memberPassword);
    await memberPage.locator('#restricted-profile').waitFor({ state: 'visible' });
    assert.equal(await memberPage.locator('#nav-users').isVisible(), false);
    assert.equal(await memberPage.locator('#nav-rallies').isVisible(), false);
    await assertFits(memberPage);
    assert(memberRequests.every(route => !route.startsWith('/api/admin/') && !route.startsWith('/api/rallies')),
        'nonadministrator interface must not request administrative data');
    assert.equal((await memberContext.request.get(baseURL + '/api/rallies')).status(), 403);
    await memberPage.screenshot({ path: path.join(artifactDirectory, 'member-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await assertFits(page);
    await page.screenshot({ path: path.join(artifactDirectory, 'accounts-mobile.png'), fullPage: true });
    await card.getByRole('button', { name: 'Desativar acesso', exact: true }).click();
    await page.locator('#decision-dialog').waitFor({ state: 'visible' });
    await page.locator('#decision-reason').fill('Encerramento do acesso sintético para testar a revogação.');
    await page.locator('#decision-confirm').click();
    await card.locator('.tag.inactive').waitFor({ state: 'visible' });
    await memberPage.reload();
    await memberPage.locator('#login-view').waitFor({ state: 'visible' });
    assert.equal(await memberPage.locator('#session-name').textContent(), '', 'revoked member session must clear private UI');
    let releaseLogout;
    let logoutCommitted;
    const logoutRelease = new Promise(resolve => { releaseLogout = resolve; });
    const logoutReady = new Promise(resolve => { logoutCommitted = resolve; });
    let sessionRefreshDuringLogout = 0;
    page.on('request', request => {
        if (new URL(request.url()).pathname === '/api/auth/session') sessionRefreshDuringLogout++;
    });
    // Delay only delivery of the real logout response, keeping its actual
    // server-side revocation. Tab restoration must not resurrect private UI.
    await page.route('**/api/auth/logout', async route => {
        const response = await route.fetch();
        logoutCommitted();
        await logoutRelease;
        await route.fulfill({ response });
    });
    await page.locator('#logout-button').click();
    await logoutReady;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    assert.equal(sessionRefreshDuringLogout, 0, 'tab restoration must not race an active logout');
    releaseLogout();
    await page.locator('#login-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#users-list').textContent(), '');
    assert.equal(await page.locator('#rallies-list').textContent(), '');
    assert.equal(await page.locator('#rally-detail').textContent(), '');
    assert.equal(await page.locator('#rally-editions-list').textContent(), '');
    assert.equal(await page.locator('#rally-action-description').textContent(), '');
    assert.equal(await page.locator('#session-name').textContent(), '');
    assert.equal(await page.locator('#new-user-password').inputValue(), '');
    assert.equal(await page.locator('#decision-description').textContent(), '');
    assert.equal(await page.locator('#decision-reason').inputValue(), '');
    assert.equal((await page.locator('body').textContent()).includes(memberEmail), false);
    await page.reload();
    await page.locator('#login-view').waitFor({ state: 'visible' });
    await assertFits(page);
    await page.screenshot({ path: path.join(artifactDirectory, 'login-mobile.png'), fullPage: true });
    assert.equal(pageErrors.length, 0, 'browser must not report uncaught frontend errors');
    console.log('PASSOU: interface desktop/celular, duas tribos distintas, revisão antes do início, escolha congelada e distinção dos integrantes, legado de doze preservado, ciclo de Rally, login/aprovação/revogação/logout e limpeza de dados.');
    console.log('Capturas sintéticas: ' + artifactDirectory);
}

main().catch(error => {
    console.error('Falha no teste de interface: ' + error.message);
    process.exitCode = 1;
}).finally(cleanup);
