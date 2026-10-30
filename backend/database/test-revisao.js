/**
 * Regressao da API para criacao e ciclo de vida do Rally.
 * Exige servidor explicitamente vinculado ao banco descartavel.
 */
const assert = require('assert');
const { verifyTestApiServer } = require('./test-support');
const { TRIBOS_OFICIAIS } = require('../constants/tribosOficiais');
let BASE_URL;

async function request(route, method = 'GET', body = undefined) {
  const response = await fetch(BASE_URL + route, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data;
  try { data = await response.json(); } catch (error) { data = null; }
  return { status: response.status, data };
}

function assertStatus(result, expected, label) {
  assert.strictEqual(result.status, expected, label + ' HTTP');
  assert(result.data && typeof result.data === 'object', label + ' JSON');
}

async function persistedStatus(id, expected) {
  const result = await request('/rallies/' + id);
  assertStatus(result, 200, 'Leitura persistida do Rally');
  assert.strictEqual(result.data.data.status, expected, 'status persistido');
}

async function testRevisao() {
  BASE_URL = await verifyTestApiServer();
  const now = Date.now();
  const payload = {
    nome: 'Rally de Revisao ' + now,
    descricao: 'Rally ficticio para regressao da API',
    data_inicio: '2026-11-01',
    data_fim: '2026-12-31'
  };

  const activeCreation = await request('/rallies', 'POST', { ...payload, nome: payload.nome + ' ativo', status: 'ativo' });
  assertStatus(activeCreation, 400, 'Criacao direta como ativo deve ser recusada');
  assert.strictEqual(activeCreation.data.success, false);

  const created = await request('/rallies', 'POST', payload);
  assertStatus(created, 201, 'Criacao do Rally');
  assert.strictEqual(created.data.success, true);
  assert(created.data.data && created.data.data.id, 'resposta da criacao deve conter Rally');
  const rally = created.data.data;
  assert.strictEqual(rally.status, 'planejamento');
  assert.strictEqual(rally.tribos.length, 12, 'devem ser criadas exatamente 12 tribos');
  assert.deepStrictEqual(
    rally.tribos.map((tribo) => tribo.nome).sort(),
    TRIBOS_OFICIAIS.map((tribo) => tribo.nome).sort(),
    'devem ser as 12 tribos oficiais'
  );
  await persistedStatus(rally.id, 'planejamento');

  const tribes = await request('/tribos/rally/' + rally.id);
  assertStatus(tribes, 200, 'Listagem de tribos');
  assert.strictEqual(tribes.data.total, 12);
  const ranking = await request('/tribos/ranking/' + rally.id);
  assertStatus(ranking, 200, 'Ranking inicial');
  assert.strictEqual(ranking.data.total, 12);
  assert(ranking.data.data.every((tribo) => tribo.pontuacao_total === 0), 'ranking sem lancamentos deve manter zero pontos');

  const started = await request('/rallies/' + rally.id + '/start', 'PATCH');
  assertStatus(started, 200, 'Inicio explicito');
  assert.strictEqual(started.data.data.status, 'ativo');
  await persistedStatus(rally.id, 'ativo');
  const repeatedStart = await request('/rallies/' + rally.id + '/start', 'PATCH');
  assertStatus(repeatedStart, 400, 'Inicio repetido');
  await persistedStatus(rally.id, 'ativo');

  const blockedDelete = await request('/rallies/' + rally.id, 'DELETE');
  assertStatus(blockedDelete, 400, 'Exclusao com tribos relacionadas');
  await persistedStatus(rally.id, 'ativo');

  const rallies = await request('/rallies');
  assertStatus(rallies, 200, 'Listagem de Rallys');
  assert(rallies.data.data.some((item) => item.id === rally.id), 'Rally deve continuar persistido e listado');
  console.log('test:review passou: planejamento, 12 tribos oficiais, ranking zero, inicio explicito, transicao repetida e persistencia.');
}

testRevisao().catch((error) => {
  console.error('Falha em test:review:', error);
  process.exitCode = 1;
});
