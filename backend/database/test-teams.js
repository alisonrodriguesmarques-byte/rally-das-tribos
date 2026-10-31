'use strict';

// The runner provisions this suite's server and credentials. Every SQL probe
// below operates only on fresh synthetic fixtures created by these tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyTestApiServer, loginTestAdmin, getTestDatabase } = require('./test-support');
const { Database } = require('./connection');
const { migrate, validateMigrations } = require('./init');
const { provisionSyntheticDatabase } = require('./synthetic');
const { bootstrapAdmin } = require('../services/bootstrapService');
const { TeamService } = require('../services/teamService');
const { TRIBOS_OFICIAIS } = require('../constants/tribosOficiais');

async function http(base, route, session, method = 'GET', body, csrf = true) {
  const headers = { Accept: 'application/json' };
  if (session) headers.Cookie = session.cookie;
  if (session && csrf) headers['X-CSRF-Token'] = session.csrfToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

function expect(result, expected) {
  assert.equal(result.status, expected, 'HTTP response must reflect the team operation');
  if (expected < 400) assert.equal(result.body.success, true);
  return result.body.data;
}

const rallyInput = (name, ids = [1, 2]) => ({ nome: name, descricao: 'Synthetic team fixture',
  data_inicio: '2026-11-01', data_fim: '2026-12-31', tribos_ids: ids });
const motive = 'Synthetic membership decision';

async function legacyFixture(callback) {
  const names = ['NODE_ENV', 'RALLY_SYNTHETIC_DIR', 'RALLY_TEST_DB_PATH'];
  const previous = names.map(name => process.env[name]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-teams-legacy-'));
  let db;
  try {
    const provisioned = await provisionSyntheticDatabase({ directory, mode: 'test' });
    process.env.NODE_ENV = 'test';
    process.env.RALLY_SYNTHETIC_DIR = directory;
    process.env.RALLY_TEST_DB_PATH = provisioned.dbPath;
    db = new Database();
    await db.connect();
    const old = validateMigrations().filter(migration => Number(migration.name.slice(0, 3)) <= 9);
    assert.equal(old.length, 9);
    await db.migrationTransaction(async () => {
      await db.run(`CREATE TABLE schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL, checksum TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
      for (const migration of old) {
        await db.exec(migration.sql);
        await db.run('INSERT INTO schema_migrations (migration_name, checksum) VALUES (?, ?)', [migration.name, migration.checksum]);
      }
    });
    await callback(db);
  } finally {
    if (db) await db.close();
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('team management, people reuse and historical membership periods', { concurrency: false }, async t => {
  const base = await verifyTestApiServer();
  const session = await loginTestAdmin(base);
  const db = getTestDatabase();
  await db.connect();
  const service = new TeamService(db);
  const first = expect(await http(base, '/rallies', session, 'POST', rallyInput('Team fixture A')), 201);
  const second = expect(await http(base, '/rallies', session, 'POST', rallyInput('Team fixture B', [3, 4])), 201);
  const [tribeA, tribeB] = first.tribos;
  const people = [];
  const add = (person, role = 'participante', tribe = tribeA.id, date = '2026-11-01', rally = first.id) =>
    http(base, `/equipes/${rally}/membros`, session, 'POST', {
      tribo_id: tribe, participante_id: person.id, papel: role, data_entrada: date, motivo: motive
    });
  let member;
  try {
    await t.test('team routes require administrator authorization and mutation CSRF', async () => {
      for (const [route, method, body] of [
        ['/participantes', 'GET'], ['/participantes', 'POST', { nome_completo: 'Anonymous synthetic' }],
        [`/equipes/${first.id}`, 'GET'], [`/equipes/${first.id}/membros`, 'POST', {}],
        [`/equipes/${first.id}/membros/1/saida`, 'POST', {}],
        [`/equipes/${first.id}/membros/1/transferencia`, 'POST', {}],
        [`/equipes/${first.id}/membros/1/papel`, 'POST', {}]
      ]) expect(await http(base, route, null, method, body), 401);
      expect(await http(base, '/participantes', session, 'POST', { nome_completo: 'CSRF synthetic' }, false), 403);
      expect(await http(base, `/equipes/${first.id}/membros`, session, 'POST', {}, false), 403);
      const password = crypto.randomBytes(24).toString('hex');
      const account = expect(await http(base, '/admin/users', session, 'POST', {
        nome_completo: 'Restricted synthetic user', email: crypto.randomUUID() + '@example.invalid', password, tipo_usuario: 'participante'
      }), 201);
      expect(await http(base, `/admin/users/${account.id}/approval`, session, 'PATCH', { aprovacao: 'aprovado', motivo: motive }), 200);
      const login = await http(base, '/auth/login', null, 'POST', { email: account.email, password });
      expect(login, 200);
      const restricted = { cookie: login.headers.get('set-cookie').split(';')[0], csrfToken: login.body.data.csrfToken };
      for (const [route, method, body] of [
        ['/participantes', 'GET'], ['/participantes', 'POST', { nome_completo: 'Forbidden' }],
        [`/equipes/${first.id}`, 'GET'], [`/equipes/${first.id}/membros`, 'POST', {}]
      ]) expect(await http(base, route, restricted, method, body), 403);
      expect(await http(base, '/auth/logout', restricted, 'POST', {}), 200);
    });

    await t.test('global people use only minimal fields and homonyms stay separate', async () => {
      for (const [name, nickname] of [['Team Person Alice', 'Alice'], ['Team Person Bob', null], ['Team Person Carla', 'Carla'],
        ['Team Person Homonym', null], ['Team Person Homonym', null]]) {
        const person = expect(await http(base, '/participantes', session, 'POST', { nome_completo: name, nome_apelido: nickname }), 201);
        assert.equal(person.nome_completo, name);
        assert.equal(person.nome_apelido, nickname);
        for (const field of ['usuario_id', 'foto_url', 'email', 'senha_hash']) assert.equal(person[field], undefined);
        people.push(person);
      }
      assert.notEqual(people[3].id, people[4].id, 'a name is not a unique person identifier');
      const found = expect(await http(base, '/participantes?q=' + encodeURIComponent('Team Person Homonym'), session), 200);
      assert.equal(found.length, 2);
      assert.deepEqual(found.map(person => person.id).sort((a, b) => a - b), [people[3].id, people[4].id]);
      const search = expect(await http(base, '/participantes?q=' + encodeURIComponent("' OR 1=1 --"), session), 200);
      assert.deepEqual(search, []);
      const edited = expect(await http(base, `/participantes/${people[2].id}`, session, 'PUT', { nome_apelido: 'C', motivo: motive }), 200);
      assert.equal(edited.nome_apelido, 'C');
      expect(await http(base, `/participantes/${people[2].id}`, session, 'PUT', { nome_apelido: 'No reason' }), 400);
    });

    await t.test('invalid people, dates, identifiers and roles leave no partial records', async () => {
      const before = await db.get('SELECT COUNT(*) AS count FROM participantes');
      for (const body of [{}, { nome_completo: '' }, { nome_completo: 17 }, { nome_completo: 'x'.repeat(121) },
        { nome_completo: 'Synthetic', nome_apelido: 'x'.repeat(81) }]) {
        expect(await http(base, '/participantes', session, 'POST', body), 400);
      }
      assert.deepEqual(await db.get('SELECT COUNT(*) AS count FROM participantes'), before);
      const links = await db.get('SELECT COUNT(*) AS count FROM membros_tribo');
      for (const date of ['', 'tomorrow', '2026-02-30', '2026-13-01', '2026-1-01', '2026-11-01T00:00:00Z']) {
        expect(await add(people[0], 'participante', tribeA.id, date), 400);
      }
      expect(await add(people[0], 'admin'), 400);
      expect(await add({ id: 999999 }), 404);
      const invalidId = await add({ id: '1' });
      assert([400, 404].includes(invalidId.status));
      assert.deepEqual(await db.get('SELECT COUNT(*) AS count FROM membros_tribo'), links);
    });

    await t.test('one global person can participate in different editions without duplication', async () => {
      member = expect(await add(people[0]), 201);
      assert.equal(member.participante_id, people[0].id);
      const another = expect(await add(people[0], 'participante', second.tribos[0].id, '2026-11-01', second.id), 201);
      assert.equal(another.participante_id, people[0].id);
      assert.notEqual(another.id, member.id);
      assert.equal((await db.get('SELECT COUNT(*) AS count FROM participantes WHERE id = ?', [people[0].id])).count, 1);
      const team = expect(await http(base, `/equipes/${first.id}`, session), 200);
      assert.equal(team.rally.id, first.id);
      assert.equal(team.tribos.length, 2);
      assert(team.tribos.find(tribe => tribe.id === tribeA.id).membros.some(link => link.id === member.id));
      assert(team.historico.some(link => link.id === member.id));
    });

    await t.test('concurrent duplicate allocation creates only one active membership', async () => {
      const outcomes = await Promise.all([add(people[1], 'participante', tribeA.id), add(people[1], 'participante', tribeB.id)]);
      assert.deepEqual(outcomes.map(result => result.status).sort(), [201, 409]);
      const links = await db.all(`SELECT mt.* FROM membros_tribo mt JOIN tribos t ON t.id = mt.tribo_id
        WHERE mt.participante_id = ? AND t.rally_id = ? AND mt.ativo = 1`, [people[1].id, first.id]);
      assert.equal(links.length, 1);
    });

    await t.test('leadership positions allow one head and one auxiliary per team', async () => {
      const head = expect(await add(people[3], 'lider'), 201);
      const auxiliary = expect(await add(people[4], 'auxiliar'), 201);
      expect(await add(people[2], 'lider'), 409);
      expect(await add(people[2], 'auxiliar'), 409);
      const before = await db.all('SELECT * FROM membros_tribo ORDER BY id');
      expect(await http(base, `/equipes/${first.id}/membros/${member.id}/papel`, session, 'POST', {
        papel: 'lider', data: '2026-11-02', motivo: motive
      }), 409);
      assert.deepEqual(await db.all('SELECT * FROM membros_tribo ORDER BY id'), before);
      expect(await http(base, `/equipes/${first.id}/membros/${head.id}/saida`, session, 'POST', { data_saida: '2026-11-02', motivo: motive }), 200);
      const replacement = expect(await add(people[2], 'lider', tribeA.id, '2026-11-02'), 201);
      assert.equal(replacement.papel, 'lider');
      assert.equal((await db.get('SELECT ativo FROM membros_tribo WHERE id = ?', [head.id])).ativo, 0);
      assert.equal((await db.get('SELECT ativo FROM membros_tribo WHERE id = ?', [auxiliary.id])).ativo, 1);
    });

    await t.test('active editions allow transfer and role changes as new historical periods', async () => {
      expect(await http(base, `/rallies/${first.id}/start`, session, 'PATCH'), 200);
      const transferred = expect(await http(base, `/equipes/${first.id}/membros/${member.id}/transferencia`, session, 'POST', {
        tribo_destino_id: tribeB.id, papel: 'participante', data: '2026-11-03', motivo: motive
      }), 200);
      assert.equal(transferred.anterior.id, member.id);
      assert.equal(transferred.anterior.ativo, 0);
      assert.equal(transferred.anterior.tribo_id, tribeA.id);
      assert.equal(transferred.anterior.data_saida, '2026-11-03');
      assert.notEqual(transferred.atual.id, member.id);
      assert.equal(transferred.atual.tribo_id, tribeB.id);
      const changed = expect(await http(base, `/equipes/${first.id}/membros/${transferred.atual.id}/papel`, session, 'POST', {
        papel: 'lider', data: '2026-11-04', motivo: motive
      }), 200);
      assert.equal(changed.anterior.id, transferred.atual.id);
      assert.equal(changed.anterior.papel, 'participante');
      assert.equal(changed.anterior.ativo, 0);
      assert.equal(changed.atual.papel, 'lider');
      assert.equal(changed.atual.ativo, 1);
      assert.notEqual(changed.atual.id, changed.anterior.id);
      const team = expect(await http(base, `/equipes/${first.id}`, session), 200);
      const aliceHistory = team.historico.filter(link => link.participante_id === people[0].id);
      assert.equal(aliceHistory.length, 3);
      assert.equal(aliceHistory.filter(link => link.ativo === 1).length, 1);
      assert.equal(team.tribos.reduce((total, tribe) => total + tribe.membros.filter(link => link.participante_id === people[0].id).length, 0), 1);
      member = changed.atual;
    });

    await t.test('cross-edition IDs, stale retries and invalid closing dates cannot alter history', async () => {
      const before = await db.all('SELECT * FROM membros_tribo ORDER BY id');
      const cross = await http(base, `/equipes/${second.id}/membros/${member.id}/saida`, session, 'POST', { data_saida: '2026-11-05', motivo: motive });
      assert([404, 409].includes(cross.status));
      const destination = await http(base, `/equipes/${first.id}/membros/${member.id}/transferencia`, session, 'POST', {
        tribo_destino_id: second.tribos[0].id, papel: 'participante', data: '2026-11-05', motivo: motive
      });
      assert([404, 409].includes(destination.status));
      expect(await http(base, `/equipes/${first.id}/membros/${member.id}/saida`, session, 'POST', { data_saida: '2026-11-03', motivo: motive }), 400);
      expect(await http(base, `/equipes/${first.id}/membros/${member.id}/saida`, session, 'POST', { data_saida: '2026-11-05' }), 400);
      assert.deepEqual(await db.all('SELECT * FROM membros_tribo ORDER BY id'), before);
      const ended = expect(await http(base, `/equipes/${first.id}/membros/${member.id}/saida`, session, 'POST', { data_saida: '2026-11-05', motivo: motive }), 200);
      assert.equal(ended.ativo, 0);
      expect(await http(base, `/equipes/${first.id}/membros/${member.id}/saida`, session, 'POST', { data_saida: '2026-11-05', motivo: motive }), 409);
      expect(await http(base, `/equipes/${first.id}/membros/${member.id}/papel`, session, 'POST', { papel: 'auxiliar', data: '2026-11-06', motivo: motive }), 409);
      expect(await add(people[0], 'participante', tribeA.id, '2026-11-02'), 409);
      const returning = expect(await add(people[0], 'participante', tribeA.id, '2026-11-05'), 201);
      assert.notEqual(returning.id, member.id, 'a same-day return opens a new period instead of reactivating history');
      member = returning;
    });

    await t.test('audit failure rolls back a transfer after closing the old link', async () => {
      const before = await db.all('SELECT * FROM membros_tribo ORDER BY id');
      const audits = await db.all('SELECT * FROM team_audit ORDER BY id');
      const original = db.run.bind(db);
      const failure = new Error('Synthetic team audit failure');
      let reachedAudit = false;
      db.run = async (sql, params) => {
        if (/INSERT INTO team_audit/i.test(sql)) { reachedAudit = true; throw failure; }
        return original(sql, params);
      };
      try {
        await assert.rejects(service.transferMember(session.user.id, first.id, member.id, {
          tribo_destino_id: tribeB.id, papel: 'participante', data: '2026-11-06', motivo: motive
        }), error => error === failure);
      } finally { db.run = original; }
      assert.equal(reachedAudit, true, 'the transfer must reach its audit write');
      assert.deepEqual(await db.all('SELECT * FROM membros_tribo ORDER BY id'), before);
      assert.deepEqual(await db.all('SELECT * FROM team_audit ORDER BY id'), audits);
    });

    await t.test('closed editions remain readable and reject further people movements', async () => {
      expect(await http(base, `/rallies/${first.id}/encerrar`, session, 'PATCH'), 200);
      const before = await db.all('SELECT * FROM membros_tribo ORDER BY id');
      const team = expect(await http(base, `/equipes/${first.id}`, session), 200);
      assert.equal(team.rally.status, 'encerrado');
      assert(team.historico.length > 3);
      expect(await add(people[2]), 409);
      expect(await http(base, `/equipes/${first.id}/membros/${member.id}/saida`, session, 'POST', { data_saida: '2026-11-07', motivo: motive }), 409);
      expect(await http(base, `/participantes/${people[0].id}`, session, 'PUT', { nome_completo: 'Changed historical identity', motivo: motive }), 409);
      assert.deepEqual(await db.all('SELECT * FROM membros_tribo ORDER BY id'), before);
    });

    await t.test('team audit is append-only, links actors and periods and excludes credentials', async () => {
      const audit = await db.all('SELECT * FROM team_audit ORDER BY id');
      assert(audit.length > 8);
      assert(audit.every(row => row.actor_id === session.user.id && Number.isSafeInteger(row.created_at)));
      assert(audit.some(row => row.membro_anterior_id && row.membro_novo_id));
      const firstEvent = audit[0];
      await assert.rejects(db.run('UPDATE team_audit SET detail = ? WHERE id = ?', ['changed', firstEvent.id]));
      await assert.rejects(db.run('DELETE FROM team_audit WHERE id = ?', [firstEvent.id]));
      assert.deepEqual(await db.all('SELECT * FROM team_audit ORDER BY id'), audit);
      const serialized = JSON.stringify(audit);
      assert.equal(serialized.includes(session.cookie.slice('rally_session='.length)), false);
      assert.equal(serialized.includes(process.env.RALLY_TEST_ADMIN_PASSWORD), false);
      const deactivated = await db.run(`INSERT INTO usuarios (nome_completo,email,senha_hash,tipo_usuario,status,aprovacao)
        VALUES ('Inactive synthetic actor', ?, 'not-a-hash', 'admin', 'inativo', 'aprovado')`, [crypto.randomUUID() + '@example.invalid']);
      await assert.rejects(service.createParticipant(deactivated.id, { nome_completo: 'Should not be created' }), error => error.status === 403);
    });

    await t.test('legacy teams retain old people, periods and leadership without automatic conversion', async () => {
      await legacyFixture(async oldDb => {
        const historical = await oldDb.run(`INSERT INTO rallies (nome,data_inicio,data_fim,status)
          VALUES ('Legacy synthetic teams','2025-01-01','2025-03-31','arquivado')`);
        const tribeIds = [];
        for (const tribe of TRIBOS_OFICIAIS) {
          const row = await oldDb.run('INSERT INTO tribos (rally_id,nome,cor) VALUES (?,?,?)', [historical.id, tribe.nome, tribe.cor]);
          tribeIds.push(row.id);
        }
        for (const [index, role] of ['lider', 'lider', 'auxiliar', 'auxiliar'].entries()) {
          const person = await oldDb.run('INSERT INTO participantes (nome_completo) VALUES (?)', ['Legacy synthetic person ' + index]);
          await oldDb.run(`INSERT INTO membros_tribo (tribo_id,participante_id,papel,data_entrada,ativo)
            VALUES (?,?,?,'2025-01-01',1)`, [tribeIds[0], person.id, role]);
        }
        const beforePeople = await oldDb.all('SELECT * FROM participantes ORDER BY id');
        const beforeLinks = await oldDb.all('SELECT * FROM membros_tribo ORDER BY id');
        await migrate(oldDb, { silent: true });
        const secret = crypto.randomBytes(32).toString('hex');
        const admin = await bootstrapAdmin(oldDb, { secret, nome_completo: 'Synthetic legacy observer',
          email: 'observer@example.invalid', password: crypto.randomBytes(24).toString('hex') }, secret);
        const legacy = new TeamService(oldDb);
        const view = await legacy.getTeams(admin.id, historical.id);
        assert.equal(Number(view.rally.legado), 1);
        assert.equal(view.tribos.length, 12);
        assert.equal(view.historico.length, 4);
        assert.equal(view.historico.filter(period => period.papel === 'lider').length, 2);
        await assert.rejects(legacy.addMember(admin.id, historical.id, {
          tribo_id: tribeIds[1], participante_id: beforePeople[0].id, papel: 'participante', data_entrada: '2025-02-01', motivo: motive
        }), error => error.status === 409);
        await assert.rejects(legacy.endMembership(admin.id, historical.id, beforeLinks[0].id, {
          data_saida: '2025-03-01', motivo: motive
        }), error => error.status === 409);
        await assert.rejects(legacy.updateParticipant(admin.id, beforePeople[0].id, {
          nome_apelido: 'Changed', motivo: motive
        }), error => error.status === 409);
        assert.deepEqual(await oldDb.all('SELECT * FROM participantes ORDER BY id'), beforePeople);
        assert.deepEqual(await oldDb.all('SELECT * FROM membros_tribo ORDER BY id'), beforeLinks);
        assert.deepEqual(await oldDb.all('PRAGMA foreign_key_check'), []);
      });
    });
  } finally {
    await http(base, '/auth/logout', session, 'POST', {});
    await db.close();
  }
});
