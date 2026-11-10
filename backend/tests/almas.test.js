process.env.DB_FILE = ':memory:';
const { randomBytes } = require('node:crypto');
process.env.ADMIN_PASSWORD = randomBytes(20).toString('hex');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/database/connection');
const { criarApp } = require('../src/app');
const migration = require('../src/database/migrations/002_tribos_relatorios_almas');
let app, admin, rally, tribos, cabeca, auxiliar, participante, outro;
const inicio = '2026-11-09';
const dias = () => ['segunda', 'quarta', 'quinta', 'sexta', 'sabado'].map((dia, i) => ({ dia, novas: i + 1, afastadas: 2 }));
const root = () => `/api/rallies/${rally.id}/relatorios-almas`;
let relatorio;
async function pessoa(nome, email) {
  const p = await admin.post('/api/pessoas').send({ nome_completo: nome });
  const senha = randomBytes(20).toString('hex');
  await admin.put(`/api/pessoas/${p.body.id}/acesso`).send({ email, senha });
  const agente = request.agent(app);
  assert.equal((await agente.post('/api/auth/login').send({ email, senha })).status, 200);
  return { id: p.body.id, agente };
}
before(async () => {
  await db.migrate.latest(); await db.seed.run(); app = criarApp(); admin = request.agent(app);
  await admin.post('/api/auth/login').send({ email: 'admin@rally.local', senha: process.env.ADMIN_PASSWORD });
  const catalogo = (await admin.get('/api/tribos')).body;
  rally = (await admin.post('/api/rallies').send({ tribos: catalogo.map((t) => t.id), nome: 'Rally semanal', data_inicio: '2026-11-01', data_fim: '2026-12-31', status: 'ativo' })).body;
  tribos = (await admin.get(`/api/rallies/${rally.id}/tribos`)).body;
  const a = await pessoa('Cabeça teste', 'cabeca@teste.local');
  const b = await pessoa('Auxiliar teste', 'auxiliar@teste.local');
  const c = await pessoa('Participante teste', 'participante@teste.local');
  const d = await pessoa('Outro cabeça', 'outro@teste.local');
  await admin.patch(`/api/rally-tribos/${tribos[0].id}`).send({ cabeca_pessoa_id: a.id, auxiliar_pessoa_id: b.id });
  await admin.post(`/api/rally-tribos/${tribos[0].id}/membros`).send({ pessoa_id: c.id });
  await admin.patch(`/api/rally-tribos/${tribos[1].id}`).send({ cabeca_pessoa_id: d.id });
  cabeca = a.agente; auxiliar = b.agente; participante = c.agente; outro = d.agente;
});
after(() => db.destroy());

test('catálogo inclui Manassés, Efraim e Levi e não inclui José', () => {
  assert.equal(tribos.length, 13);
  for (const nome of ['Manassés', 'Efraim', 'Levi']) assert.ok(tribos.some((t) => t.nome === nome));
  assert.ok(!tribos.some((t) => t.nome === 'José'));
});
test('ranking, extratos, gráficos e exportações são exclusivos do admin', async () => {
  await admin.post(`/api/rallies/${rally.id}/lancamentos`).send({ rally_tribo_id: tribos[0].id, pontos: 2879, motivo: 'Pontuação reservada' });
  for (const usuario of [cabeca, auxiliar, participante, outro]) {
    for (const path of ['ranking', 'ranking/semanas', 'pontos-por-categoria', 'lancamentos', 'dashboard', 'exportar/ranking.csv', 'exportar/lancamentos.csv']) {
      assert.equal((await usuario.get(`/api/rallies/${rally.id}/${path}`)).status, 403, path);
    }
    const lista = await usuario.get(`/api/rallies/${rally.id}/tribos`);
    const perfil = await usuario.get(`/api/rally-tribos/${tribos[0].id}`);
    assert.equal(lista.status, 200); assert.equal(perfil.status, 200);
    for (const body of [lista.body, perfil.body]) {
      const s = JSON.stringify(body);
      assert.ok(!s.includes('2879')); assert.ok(!/"(?:pontos|posicao|por_categoria|historico)"/.test(s));
    }
  }
  assert.equal((await admin.get(`/api/rallies/${rally.id}/ranking`)).body[0].pontos, 2879);
});
test('missões e entregas não revelam os pontos aos líderes', async () => {
  const m = (await admin.post(`/api/rallies/${rally.id}/missoes`).send({ titulo: 'Missão privada', data_inicio: '2026-11-01', tipo_pontuacao: 'quantidade', pontos: 731 })).body;
  const e = await cabeca.post(`/api/missoes/${m.id}/entregas`).send({ quantidade: 2 });
  await admin.post(`/api/entregas/${e.body.id}/aprovar`).send({});
  for (const path of [`/api/missoes/${m.id}`, `/api/rallies/${rally.id}/missoes`]) {
    const resposta = await auxiliar.get(path); assert.equal(resposta.status, 200);
    assert.ok(!/"(?:pontos|pontos_lancados|pontos_manual|lancamento_id)"/.test(JSON.stringify(resposta.body)));
  }
});
test('módulos de provas e dinâmicas foram desativados na API', async () => {
  for (const user of [admin, cabeca]) for (const path of [`/api/rallies/${rally.id}/provas`, `/api/rallies/${rally.id}/dinamicas`, '/api/tentativas/1', '/api/provas/1', '/api/dinamicas/1/status']) {
    const r = path.endsWith('/status') ? await user.post(path).send({ status: 'realizada' }) : await user.get(path);
    assert.equal(r.status, 404, path);
  }
});
test('rascunho totaliza os cinco dias e não entra no resumo enviado', async () => {
  const r = await cabeca.post(root()).send({ semana_inicio: inicio, acao: 'rascunho', dias: dias(), novas: 9999, responsavel_nome: 'Falso' });
  assert.equal(r.status, 200, JSON.stringify(r.body)); relatorio = r.body;
  assert.equal(r.body.novas, 15); assert.equal(r.body.afastadas, 10); assert.equal(r.body.total, 25); assert.equal(r.body.responsavel_nome, 'Cabeça teste');
  const lista = await admin.get(`${root()}?semana_inicio=${inicio}`);
  assert.equal(lista.body.resumo.total, 0); assert.equal(lista.body.resumo.pendentes.length, 13);
});
test('auxiliar pode enviar; não pode substituir os dados de outra tribo', async () => {
  const r = await auxiliar.post(root()).send({ semana_inicio: inicio, acao: 'enviar', dias: dias(), rally_tribo_id: tribos[1].id });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.id, relatorio.id); assert.equal(r.body.rally_tribo_id, tribos[0].id); assert.equal(r.body.responsavel_nome, 'Auxiliar teste');
  const lista = await admin.get(`${root()}?semana_inicio=${inicio}`);
  assert.equal(lista.body.resumo.total, 25); assert.equal(lista.body.resumo.enviados, 1); assert.equal(lista.body.resumo.pendentes.length, 12);
  assert.equal((await outro.get(`${root()}?semana_inicio=${inicio}`)).body.relatorios.length, 0);
  assert.equal((await participante.get(`${root()}?semana_inicio=${inicio}`)).status, 403);
  assert.equal((await participante.post(root()).send({ semana_inicio: inicio, acao: 'enviar', dias: dias() })).status, 403);
});
test('envio duplicado e edição de enviado são bloqueados sem duplicar pontos', async () => {
  const antes = await db('lancamentos').count({ n: '*' }).first();
  assert.equal((await cabeca.post(root()).send({ semana_inicio: inicio, acao: 'enviar', dias: dias() })).status, 409);
  assert.equal((await auxiliar.post(root()).send({ semana_inicio: inicio, acao: 'rascunho', dias: dias() })).status, 409);
  assert.equal((await db('relatorios_almas').count({ n: '*' }).first()).n, 1);
  assert.deepEqual(await db('lancamentos').count({ n: '*' }).first(), antes);
});
test('admin exporta o consolidado e líder não pode exportar as outras tribos', async () => {
  const txt = await admin.get(`${root()}/exportar?semana_inicio=${inicio}`);
  assert.equal(txt.status, 200); assert.match(txt.text, /RELATÓRIO SEMANAL DE ALMAS/); assert.match(txt.text, /TOTAL GERAL: 25/); assert.match(txt.text, /Segunda-feira/);
  assert.equal((await admin.get(`${root()}/exportar?semana_inicio=${inicio}&formato=csv`)).status, 200);
  assert.equal((await cabeca.get(`${root()}/exportar?semana_inicio=${inicio}`)).status, 403);
});
test('admin confere, devolve com motivo e líder corrige sem duplicar relatório', async () => {
  const url = `/api/relatorios-almas/${relatorio.id}/avaliar`;
  assert.equal((await auxiliar.post(url).send({ acao: 'conferir' })).status, 403);
  assert.equal((await admin.post(url).send({ acao: 'conferir' })).status, 200);
  assert.equal((await admin.post(url).send({ acao: 'devolver' })).status, 400);
  assert.equal((await admin.post(url).send({ acao: 'devolver', motivo: 'Confira a segunda-feira' })).status, 200);
  const corrigido = dias(); corrigido[0].novas = 10;
  const r = await cabeca.post(root()).send({ semana_inicio: inicio, acao: 'enviar', dias: corrigido });
  assert.equal(r.status, 200); assert.equal(r.body.id, relatorio.id); assert.equal(r.body.total, 34);
  assert.equal((await admin.get(`${root()}?semana_inicio=${inicio}`)).body.resumo.total, 34);
});
test('relatório rejeita datas inválidas, dias repetidos, frações, negativos e tipos errados', async () => {
  for (const mod of [
    { semana_inicio: '2026-11-10' }, { semana_inicio: '2026-02-30' }, { semana_inicio: '2025-11-10' },
    { dias: dias().slice(1) }, { dias: [...dias().slice(0, 4), dias()[0]] },
    ...[-1, 1.5, '2', null, true, 1000001].map((novas) => ({ dias: dias().map((d, i) => i ? d : { ...d, novas }) })),
  ]) {
    const r = await cabeca.post(root()).send({ semana_inicio: '2026-11-16', acao: 'rascunho', dias: dias(), ...mod });
    assert.equal(r.status, 400, JSON.stringify(mod));
  }
});
test('rally encerrado preserva consulta e bloqueia envio e avaliação', async () => {
  await admin.patch(`/api/rallies/${rally.id}`).send({ status: 'encerrado' });
  assert.equal((await cabeca.get(`${root()}?semana_inicio=${inicio}`)).status, 200);
  assert.equal((await cabeca.post(root()).send({ semana_inicio: '2026-11-16', acao: 'enviar', dias: dias() })).status, 409);
  assert.equal((await admin.post(`/api/relatorios-almas/${relatorio.id}/avaliar`).send({ acao: 'conferir' })).status, 409);
});
test('migração de José conserva vínculos, pontos e membros e cria Efraim', async () => {
  const knex = require('knex')({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  try {
    await require('../src/database/migrations/001_esquema_inicial').up(knex);
    const nomes = ['Rúben','Simeão','Levi','Judá','Dã','Naftali','Gade','Aser','Issacar','Zebulom','José','Benjamim'];
    for (const [i,nome] of nomes.entries()) await knex('tribos').insert({ nome, slug: i === 10 ? 'jose' : i === 11 ? 'benjamim' : `tribo${i}`, ordem: i + 1 });
    await knex('pessoas').insert({ nome_completo: 'Líder histórico' });
    await knex('usuarios').insert({ pessoa_id:1, email:'historico@teste.local', senha_hash:'sem-acesso', papel:'admin' });
    await knex('rallies').insert({ nome: 'Anterior', data_inicio:'2026-01-01', data_fim:'2026-12-31' });
    for (const t of await knex('tribos')) await knex('rally_tribos').insert({ rally_id:1, tribo_id:t.id, cabeca_pessoa_id:t.id === 11 ? 1 : null });
    await knex('membros_tribo').insert({ rally_tribo_id:11, pessoa_id:1 });
    await knex('lancamentos').insert({ rally_id:1, rally_tribo_id:11, pontos:543, criado_por:1, motivo:'Histórico', data_referencia:'2026-01-01', origem_tipo:'manual' });
    await migration.up(knex);
    assert.equal((await knex('tribos').where({ id:11 }).first()).nome,'Manassés');
    assert.equal((await knex('rally_tribos').where({ id:11 }).first()).cabeca_pessoa_id,1);
    assert.equal((await knex('membros_tribo').where({ rally_tribo_id:11 }).first()).pessoa_id,1);
    assert.equal((await knex('lancamentos').first()).pontos,543);
    assert.equal((await knex('rally_tribos').count({ n:'*' }).first()).n,13);
  } finally { await knex.destroy(); }
});
