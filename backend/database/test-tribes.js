'use strict';

// Every mutation uses this run's explicitly provisioned synthetic database.
// The legacy test constructs its own old schema; no historical database is read.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyTestApiServer, loginTestAdmin, getTestDatabase } = require('./test-support');
const { Database } = require('./connection');
const { provisionSyntheticDatabase } = require('./synthetic');
const { migrate, validateMigrations } = require('./init');
const { TRIBOS_OFICIAIS } = require('../constants/tribosOficiais');
const RallyRepository = require('../repositories/rallyRepository');
const TriboRepository = require('../repositories/triboRepository');

const payload = (name, ids = [1, 2]) => ({
  nome: name, descricao: 'Fixture sintetica de selecao',
  data_inicio: '2026-11-01', data_fim: '2026-12-31', tribos_ids: ids
});

async function http(base, route, session, method = 'GET', body, csrf = true) {
  const headers = { Accept: 'application/json' };
  if (session) headers.Cookie = session.cookie;
  if (session && csrf) headers['X-CSRF-Token'] = session.csrfToken;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + route, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  return { status: response.status, body: await response.json() };
}

async function legacyFixture(callback) {
  const names = ['NODE_ENV', 'RALLY_SYNTHETIC_DIR', 'RALLY_TEST_DB_PATH'];
  const previous = names.map(name => process.env[name]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rally-legacy-tribes-'));
  let db;
  try {
    const created = await provisionSyntheticDatabase({ directory, mode: 'test' });
    process.env.NODE_ENV = 'test';
    process.env.RALLY_SYNTHETIC_DIR = directory;
    process.env.RALLY_TEST_DB_PATH = created.dbPath;
    db = new Database();
    await db.connect();
    const old = validateMigrations().filter(migration => Number(migration.name.slice(0, 3)) <= 9);
    assert.equal(old.length, 9, 'legacy fixture must actually begin before migration 010');
    await db.migrationTransaction(async () => {
      await db.run(`CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, migration_name TEXT UNIQUE NOT NULL,
        checksum TEXT NOT NULL, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
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

test('two selected tribes, legacy preservation and mutable membership', { concurrency: false }, async t => {
  const base = await verifyTestApiServer();
  const session = await loginTestAdmin(base);
  const db = getTestDatabase();
  await db.connect();
  const repo = new RallyRepository(db);
  const tribes = new TriboRepository(db);
  let selected;
  try {
    await t.test('catalog has the twelve official identities and requires authentication', async () => {
      assert.equal((await http(base, '/tribos/catalogo')).status, 401);
      const result = await http(base, '/tribos/catalogo', session);
      assert.equal(result.status, 200);
      assert.equal(result.body.data.length, 12);
      assert.deepEqual(result.body.data.map(item => item.nome).sort(), TRIBOS_OFICIAIS.map(item => item.nome).sort());
      assert.equal(new Set(result.body.data.map(item => item.id)).size, 12);
      assert(result.body.data.every(item => Number.isSafeInteger(item.id) && item.id > 0));
    });

    await t.test('invalid selections cannot create partial Rallys or opt into legacy rules', async () => {
      const before = await db.get('SELECT COUNT(*) AS count FROM rallies');
      const beforeTribes = await db.get('SELECT COUNT(*) AS count FROM tribos');
      for (const ids of [undefined, null, [], [1], [1, 2, 3], [1, 1], [1, 99999], ['1', 2], [0, 2], [1.5, 2]]) {
        const result = await http(base, '/rallies', session, 'POST', { ...payload('Invalid selection'), tribos_ids: ids });
        assert.equal(result.status, 400, 'invalid selection must be rejected before creation');
      }
      for (const legado of [true, 1, 0, false]) {
        assert.equal((await http(base, '/rallies', session, 'POST', { ...payload('Legacy bypass'), legado })).status, 400);
      }
      assert.deepEqual(await db.get('SELECT COUNT(*) AS count FROM rallies'), before);
      assert.deepEqual(await db.get('SELECT COUNT(*) AS count FROM tribos'), beforeTribes);
    });

    await t.test('new editions contain exactly the selected two catalog identities', async () => {
      const result = await http(base, '/rallies', session, 'POST', payload('Two selected tribes'));
      assert.equal(result.status, 201);
      selected = result.body.data;
      assert.equal(Number(selected.legado), 0);
      assert.equal(selected.tribos.length, 2);
      assert.deepEqual(selected.tribos.map(item => item.catalogo_id).sort((a, b) => a - b), [1, 2]);
      const other = await http(base, '/rallies', session, 'POST', payload('Another edition uses same catalog'));
      assert.equal(other.status, 201);
      assert(other.body.data.tribos.every(item => !selected.tribos.some(existing => existing.id === item.id)));
    });

    await t.test('selection replacement is atomic, preserves unchanged IDs and requires CSRF', async () => {
      const keep = selected.tribos.find(item => item.catalogo_id === 2).id;
      assert.equal((await http(base, '/rallies/' + selected.id + '/tribos', session, 'PUT', { tribos_ids: [2, 3] }, false)).status, 403);
      const changed = await http(base, '/rallies/' + selected.id + '/tribos', session, 'PUT', { tribos_ids: [2, 3] });
      assert.equal(changed.status, 200);
      const rows = await tribes.findByRally(selected.id);
      assert.equal(rows.find(item => item.catalogo_id === 2).id, keep);
      assert.deepEqual(rows.map(item => item.catalogo_id).sort((a, b) => a - b), [2, 3]);
      const before = await db.all('SELECT * FROM tribos WHERE rally_id = ? ORDER BY id', [selected.id]);
      assert.equal((await http(base, '/rallies/' + selected.id + '/tribos', session, 'PUT', { tribos_ids: [3, 3] })).status, 400);
      assert.deepEqual(await db.all('SELECT * FROM tribos WHERE rally_id = ? ORDER BY id', [selected.id]), before);
      assert.equal((await http(base, '/rallies/' + selected.id, session, 'PUT', { tribos_ids: [4, 5] })).status, 400);
    });

    await t.test('draft activity assignments prevent destructive replacement with a domain conflict', async () => {
      for (const kind of ['missoes', 'provas']) {
        const created = await http(base, '/rallies', session, 'POST', payload('Planning with ' + kind));
        assert.equal(created.status, 201);
        const edition = created.body.data;
        const target = edition.tribos.find(tribe => tribe.catalogo_id === 1);
        const availability = { abre_em: new Date().toISOString(), encerra_em: new Date(Date.now() + 3600000).toISOString() };
        const activity = { titulo: 'Draft assignment fixture', descricao: 'Synthetic activity',
          tribos_ids: [target.id], ...availability };
        if (kind === 'missoes') activity.pontos = 10;
        else Object.assign(activity, { tipo_prova: 'quiz', respondedor: 'participantes',
          questoes: [{ enunciado: 'Synthetic question', pontos: 10, alternativas: ['A', 'B'], correta: 0 }] });
        assert.equal((await http(base, '/atividades/' + kind + '/edicao/' + edition.id, session, 'POST', activity)).status, 200);
        const before = await tribes.findByRally(edition.id);
        const rejected = await http(base, '/rallies/' + edition.id + '/tribos', session, 'PUT', { tribos_ids: [2, 3] });
        assert.equal(rejected.status, 409, 'assigned activities must return a domain conflict instead of a SQL error');
        assert.match(rejected.body.error, /atividades/);
        assert.deepEqual(await tribes.findByRally(edition.id), before);
        const retained = await http(base, '/rallies/' + edition.id + '/tribos', session, 'PUT', { tribos_ids: [1, 3] });
        assert.equal(retained.status, 200, 'the unused participation can still be replaced');
        assert(retained.body.data.tribos.some(tribe => tribe.id === target.id));
        const assignments = await db.all('SELECT * FROM ' + (kind === 'missoes' ? 'missao_tribos' : 'prova_tribos') + ' WHERE tribo_id = ?', [target.id]);
        assert.equal(assignments.length, 1);
      }
      assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
    });

    await t.test('a historical membership prevents deleting its tribe during replacement', async () => {
      const rows = await tribes.findByRally(selected.id);
      const participant = await db.run("INSERT INTO participantes (nome_completo) VALUES ('Historical synthetic participant')");
      await db.run('INSERT INTO membros_tribo (tribo_id, participante_id, data_entrada, data_saida, ativo) VALUES (?, ?, ?, ?, 0)',
        [rows.find(item => item.catalogo_id === 2).id, participant.id, '2026-11-01', '2026-11-02']);
      const before = await db.all('SELECT * FROM tribos WHERE rally_id = ? ORDER BY id', [selected.id]);
      assert.equal((await http(base, '/rallies/' + selected.id + '/tribos', session, 'PUT', { tribos_ids: [3, 4] })).status, 409);
      assert.deepEqual(await db.all('SELECT * FROM tribos WHERE rally_id = ? ORDER BY id', [selected.id]), before);
      assert.equal((await http(base, '/rallies/' + selected.id + '/tribos', session, 'PUT', { tribos_ids: [2, 5] })).status, 200);
    });

    await t.test('starting freezes selected identities while retaining metadata editing', async () => {
      assert.equal((await http(base, '/rallies/' + selected.id + '/start', session, 'PATCH')).status, 200);
      const rows = await tribes.findByRally(selected.id);
      assert.equal((await http(base, '/rallies/' + selected.id + '/tribos', session, 'PUT', { tribos_ids: [3, 4] })).status, 409);
      assert.equal((await http(base, '/tribos', session, 'POST', { rally_id: selected.id, nome: 'Levi' })).status, 409);
      assert.equal((await http(base, '/tribos/' + rows[0].id, session, 'DELETE')).status, 409);
      assert.equal((await http(base, '/tribos/' + rows[0].id, session, 'PUT', { nome: 'Outra identidade' })).status, 409);
      const metadata = await http(base, '/tribos/' + rows[0].id, session, 'PUT', { descricao: 'Equipe em atividade', cor: '#123456' });
      assert.equal(metadata.status, 200);
      assert.equal(metadata.body.data.nome, rows[0].nome);
      await assert.rejects(db.run('DELETE FROM tribos WHERE id = ?', [rows[0].id]));
      await assert.rejects(db.run('UPDATE rallies SET id = ? WHERE id = ?', [selected.id + 100000, selected.id]));
      await assert.rejects(db.run('UPDATE tribos SET id = ? WHERE id = ?', [rows[0].id + 100000, rows[0].id]));
      await assert.rejects(db.run('UPDATE tribos SET catalogo_id = 4, nome = ? WHERE id = ?', ['Judá', rows[0].id]));
      await assert.rejects(db.run('INSERT INTO tribos (rally_id, catalogo_id, nome) VALUES (?, 4, ?)', [selected.id, 'Judá']));
      assert.equal((await tribes.findByRally(selected.id)).length, 2);
    });

    await t.test('active Rallys allow entering, leaving and transferring members without losing the old link', async () => {
      const [first, second] = await tribes.findByRally(selected.id);
      const participant = await db.run("INSERT INTO participantes (nome_completo) VALUES ('Movable synthetic participant')");
      const original = await db.run('INSERT INTO membros_tribo (tribo_id, participante_id, data_entrada, ativo) VALUES (?, ?, ?, 1)',
        [first.id, participant.id, '2026-11-03']);
      await assert.rejects(db.run('UPDATE membros_tribo SET id = ? WHERE id = ?', [original.id + 100000, original.id]));
      await assert.rejects(db.run('INSERT INTO membros_tribo (tribo_id, participante_id, data_entrada, ativo) VALUES (?, ?, ?, 1)',
        [second.id, participant.id, '2026-11-03']));
      await assert.rejects(db.run('UPDATE membros_tribo SET tribo_id = ? WHERE id = ?', [second.id, original.id]));
      await db.transaction(async () => {
        await db.run('UPDATE membros_tribo SET ativo = 0, data_saida = ? WHERE id = ?', ['2026-11-04', original.id]);
        await db.run('INSERT INTO membros_tribo (tribo_id, participante_id, data_entrada, ativo) VALUES (?, ?, ?, 1)',
          [second.id, participant.id, '2026-11-04']);
      });
      await assert.rejects(db.run('UPDATE membros_tribo SET ativo = 1, data_saida = NULL WHERE id = ?', [original.id]));
      await db.run('INSERT INTO membros_tribo (tribo_id, participante_id, data_entrada, data_saida, ativo) VALUES (?, ?, ?, ?, 0)',
        [first.id, participant.id, '2026-10-01', '2026-10-02']);
      const history = await db.all('SELECT * FROM membros_tribo WHERE participante_id = ? ORDER BY id', [participant.id]);
      assert.equal(history.length, 3);
      assert.equal(history[0].id, original.id);
      assert.equal(history[0].tribo_id, first.id);
      assert.equal(history[0].ativo, 0);
      assert.equal(history[0].data_saida, '2026-11-04');
      assert.equal(history.filter(item => item.ativo === 1).length, 1);
      assert.equal(history.find(item => item.ativo === 1).tribo_id, second.id);
      await assert.rejects(db.run(`INSERT OR REPLACE INTO membros_tribo
        (id, tribo_id, participante_id, data_entrada, data_saida, ativo) VALUES (?, ?, ?, ?, ?, 0)`,
      [original.id, first.id, participant.id, '2026-11-03', '2026-11-04']));
      assert.deepEqual(await db.all('SELECT * FROM membros_tribo WHERE participante_id = ? ORDER BY id', [participant.id]), history,
        'replacing an inactive link must not overwrite any historical record');
      assert.equal((await repo.findById(selected.id)).status, 'ativo');
      assert.deepEqual(await db.all('PRAGMA foreign_key_check'), []);
    });

    await t.test('creation failure after the first tribe rolls back the Rally and both participations', async () => {
      const before = await db.get('SELECT COUNT(*) AS count FROM rallies');
      const beforeTribes = await db.get('SELECT COUNT(*) AS count FROM tribos');
      const original = db.run.bind(db);
      const failure = new Error('Deliberate synthetic second tribe failure');
      let writes = 0;
      db.run = async (sql, params) => {
        if (/INSERT INTO tribos\s*\(/i.test(sql) && ++writes === 2) throw failure;
        return original(sql, params);
      };
      try { await assert.rejects(repo.create(payload('Atomic two tribe creation', [8, 9])), error => error === failure); }
      finally { db.run = original; }
      assert.equal(writes, 2, 'failure injection must reach the second participation');
      assert.deepEqual(await db.get('SELECT COUNT(*) AS count FROM rallies'), before);
      assert.deepEqual(await db.get('SELECT COUNT(*) AS count FROM tribos'), beforeTribes);
    });

    await t.test('selection and start serialize without producing a mixed or third tribe', async () => {
      const fresh = await repo.create(payload('Concurrent planning and start', [6, 7]));
      const outcomes = await Promise.allSettled([repo.start(fresh.id), repo.replaceSelection(fresh.id, [7, 8])]);
      assert.equal(outcomes[0].status, 'fulfilled');
      assert.equal(outcomes[1].status, 'rejected');
      assert.equal(outcomes[1].reason.status, 409);
      assert.equal((await repo.findById(fresh.id)).status, 'ativo');
      assert.deepEqual((await tribes.findByRally(fresh.id)).map(item => item.catalogo_id).sort((a, b) => a - b), [6, 7]);
    });

    await t.test('migration preserves old twelve-tribe editions, scores, members and their historical IDs', async () => {
      await legacyFixture(async oldDb => {
        const historical = await oldDb.run(`INSERT INTO rallies
          (nome, descricao, data_inicio, data_fim, status, data_criacao, data_atualizacao)
          VALUES ('Historical synthetic Rally', 'Preserved edition', '2025-01-01', '2025-03-31', 'arquivado', '2025-01-01', '2025-03-31')`);
        const ids = [];
        for (const official of TRIBOS_OFICIAIS) {
          const result = await oldDb.run(`INSERT INTO tribos
            (rally_id, nome, descricao, cor, data_criacao, data_atualizacao) VALUES (?, ?, ?, ?, '2025-01-01', '2025-03-31')`,
          [historical.id, official.nome, 'Historical description of ' + official.nome, official.cor]);
          ids.push(result.id);
        }
        const actor = await oldDb.run(`INSERT INTO usuarios (nome_completo, email, senha_hash, tipo_usuario)
          VALUES ('Historical synthetic actor', 'historical@example.invalid', 'not-a-real-hash', 'admin')`);
        const participant = await oldDb.run("INSERT INTO participantes (nome_completo) VALUES ('Historical synthetic member')");
        await oldDb.run('INSERT INTO membros_tribo (tribo_id, participante_id, data_entrada, data_saida, ativo) VALUES (?, ?, ?, ?, 0)',
          [ids[0], participant.id, '2025-01-01', '2025-03-31']);
        for (const tribeId of ids.slice(0, 2)) {
          const score = await oldDb.run(`INSERT INTO pontuacoes
            (rally_id, tribo_id, tipo_origem, descricao, pontos, tipo_pontuacao, criado_por)
            VALUES (?, ?, 'manual', 'Historical synthetic score', 12, 'manual', ?)`, [historical.id, tribeId, actor.id]);
          await oldDb.run(`INSERT INTO historico_pontuacoes
            (pontuacao_id, tribo_id, pontos_anterior, pontos_novo, tipo_alteracao, motivo, alterado_por)
            VALUES (?, ?, 0, 12, 'criacao', 'Historical synthetic decision', ?)`, [score.id, tribeId, actor.id]);
        }
        const rallySql = 'SELECT id, nome, descricao, data_inicio, data_fim, status, data_criacao, data_atualizacao FROM rallies ORDER BY id';
        const tribeSql = 'SELECT id, rally_id, nome, descricao, cor, data_criacao, data_atualizacao FROM tribos ORDER BY id';
        const before = { rallies: await oldDb.all(rallySql), tribos: await oldDb.all(tribeSql) };
        for (const table of ['participantes', 'membros_tribo', 'pontuacoes', 'historico_pontuacoes']) before[table] = await oldDb.all('SELECT * FROM ' + table + ' ORDER BY id');
        // New nullable correction references must not change any historical score values.
        before.pontuacoes = before.pontuacoes.map(row => ({ ...row, compensa_id: null, corrige_id: null }));
        const result = await migrate(oldDb, { silent: true });
        assert.deepEqual(result.applied, validateMigrations().filter(migration => Number(migration.name.slice(0, 3)) > 9).map(migration => migration.name),
          'the legacy fixture must apply only the reviewed migrations after schema 009');
        assert.deepEqual(await oldDb.all(rallySql), before.rallies);
        assert.deepEqual(await oldDb.all(tribeSql), before.tribos);
        for (const table of ['participantes', 'membros_tribo', 'pontuacoes', 'historico_pontuacoes']) assert.deepEqual(await oldDb.all('SELECT * FROM ' + table + ' ORDER BY id'), before[table]);
        const legacyRepo = new RallyRepository(oldDb);
        const legacyTribes = new TriboRepository(oldDb);
        const edition = await legacyRepo.findById(historical.id);
        assert.equal(Number(edition.legado), 1);
        assert.equal(edition.tribos.length, 12);
        const ranking = await legacyTribes.getRanking(historical.id);
        assert.equal(ranking.length, 12);
        assert.equal(ranking.filter(item => item.posicao === 1 && item.pontuacao_total === 12).length, 2);
        assert(ranking.some(item => item.posicao === 3 && item.pontuacao_total === 0));
        for (const operation of [
          () => legacyRepo.start(historical.id), () => legacyRepo.update(historical.id, { nome: 'Changed' }),
          () => legacyRepo.replaceSelection(historical.id, [1, 2]), () => legacyRepo.delete(historical.id),
          () => legacyTribes.update(ids[0], { descricao: 'Changed' })
        ]) await assert.rejects(operation);
        await assert.rejects(oldDb.run('UPDATE tribos SET nome = ? WHERE id = ?', ['Changed', ids[0]]));
        await assert.rejects(oldDb.run('DELETE FROM tribos WHERE id = ?', [ids[2]]));
        await assert.rejects(oldDb.run(`INSERT OR REPLACE INTO rallies
          (id, nome, data_inicio, data_fim, status, legado) VALUES (?, 'Replacement', '2026-11-01', '2026-12-31', 'planejamento', 0)`,
        [historical.id]));
        const rollback = new Error('Rollback new-context replacement probes');
        await assert.rejects(oldDb.transaction(async () => {
          const newParent = await oldDb.run(`INSERT INTO rallies
            (nome, data_inicio, data_fim, status, legado) VALUES ('New synthetic replacement context', '2026-11-01', '2026-12-31', 'planejamento', 0)`);
          const newTribe = await oldDb.run('INSERT INTO tribos (rally_id, catalogo_id, nome) VALUES (?, 1, ?)', [newParent.id, 'Rúben']);
          await assert.rejects(oldDb.run(`INSERT OR REPLACE INTO tribos
            (id, rally_id, catalogo_id, nome) VALUES (?, ?, 2, ?)`, [ids[2], newParent.id, 'Simeão']));
          const oldScore = before.pontuacoes[0];
          await assert.rejects(oldDb.run(`INSERT OR REPLACE INTO pontuacoes
            (id, rally_id, tribo_id, tipo_origem, descricao, pontos, tipo_pontuacao, criado_por)
            VALUES (?, ?, ?, 'manual', 'Attempted historical replacement', 99, 'manual', ?)`,
          [oldScore.id, newParent.id, newTribe.id, actor.id]));
          throw rollback;
        }), error => error === rollback);
        assert.deepEqual(await oldDb.all(rallySql), before.rallies);
        assert.deepEqual(await oldDb.all(tribeSql), before.tribos);
        assert.deepEqual(await oldDb.all('SELECT * FROM pontuacoes ORDER BY id'), before.pontuacoes);
        assert.deepEqual(await oldDb.all('SELECT * FROM historico_pontuacoes ORDER BY id'), before.historico_pontuacoes);
        assert.deepEqual(await oldDb.all('PRAGMA foreign_key_check'), []);
      });
    });
  } finally {
    await http(base, '/auth/logout', session, 'POST', {});
    await db.close();
  }
});
