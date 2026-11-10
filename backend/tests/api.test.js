process.env.DB_FILE = ':memory:';
const { randomBytes } = require('node:crypto');
const senhaAdmin = randomBytes(24).toString('hex');
const senhaCabeca = randomBytes(24).toString('hex');
process.env.ADMIN_PASSWORD = senhaAdmin;
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const db = require('../src/database/connection');
const { criarApp } = require('../src/app');
 
let app; let admin; let rally; let tribos;
const juda = () => tribos.find((t) => t.nome === 'Judá');
const benj = () => tribos.find((t) => t.nome === 'Benjamim');
 
after(() => db.destroy());

before(async () => {
  await db.migrate.latest();
  await db.seed.run();
  app = criarApp();
  admin = request.agent(app);
  const r = await admin.post('/api/auth/login').send({ email: 'admin@rally.local', senha: senhaAdmin });
  assert.equal(r.status, 200);
});
 
test('cria rally com 13 tribos', async () => {
  const r = await admin.post('/api/rallies').send({ nome: 'Rally 2026', data_inicio: '2026-10-01', data_fim: '2026-12-20', status: 'ativo' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  rally = r.body;
  tribos = (await admin.get(`/api/rallies/${rally.id}/tribos`)).body;
  assert.equal(tribos.length, 13);
});
 
test('cadastra pessoas, lideranca, membro e transferencia', async () => {
  const joao = (await admin.post('/api/pessoas').send({ nome_completo: 'João Silva' })).body;
  const pedro = (await admin.post('/api/pessoas').send({ nome_completo: 'Pedro' })).body;
  const r = await admin.patch(`/api/rally-tribos/${juda().id}`).send({ cabeca_pessoa_id: joao.id, auxiliar_pessoa_id: pedro.id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const alison = (await admin.post('/api/pessoas').send({ nome_completo: 'Alison', rally_tribo_id: juda().id })).body;
  const dup = await admin.post(`/api/rally-tribos/${benj().id}/membros`).send({ pessoa_id: alison.id });
  assert.equal(dup.status, 409);
  const perfil = (await admin.get(`/api/rally-tribos/${juda().id}`)).body;
  assert.equal(perfil.membros.length, 1);
  const t = await admin.post(`/api/membros/${perfil.membros[0].id}/transferir`).send({ rally_tribo_id: benj().id });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  const hist = (await admin.get(`/api/pessoas/${alison.id}?rally_id=${rally.id}`)).body;
  assert.equal(hist.tribos.length, 2);
  // acesso do cabeça
  const a = await admin.put(`/api/pessoas/${joao.id}/acesso`).send({ email: 'joao@x.com', senha: senhaCabeca });
  assert.equal(a.status, 200, JSON.stringify(a.body));
});
 
test('lançamento manual, edição com histórico, cancelamento e ranking', async () => {
  const l = await admin.post(`/api/rallies/${rally.id}/lancamentos`).send({ rally_tribo_id: juda().id, pontos: 2000, motivo: 'Dinâmica', data_referencia: '2026-10-03' });
  assert.equal(l.status, 201, JSON.stringify(l.body));
  await admin.post(`/api/rallies/${rally.id}/lancamentos`).send({ rally_tribo_id: benj().id, pontos: 1500, motivo: 'x', data_referencia: '2026-10-10' });
  const semMotivo = await admin.patch(`/api/lancamentos/${l.body.id}`).send({ pontos: 2500 });
  assert.equal(semMotivo.status, 400);
  await admin.patch(`/api/lancamentos/${l.body.id}`).send({ pontos: 2500, motivo_alteracao: 'erro de digitação' });
  const h = (await admin.get(`/api/lancamentos/${l.body.id}/historico`)).body;
  assert.deepEqual(h.historico.map((x) => x.acao), ['criacao', 'edicao']);
  assert.equal(h.historico[1].pontos_anteriores, 2000);
  let rank = (await admin.get(`/api/rallies/${rally.id}/ranking`)).body;
  assert.equal(rank[0].tribo, 'Judá'); assert.equal(rank[0].pontos, 2500);
  const x = (await admin.post(`/api/rallies/${rally.id}/lancamentos`).send({ rally_tribo_id: benj().id, pontos: 5000, motivo: 'errado' })).body;
  await admin.post(`/api/lancamentos/${x.id}/cancelar`).send({ motivo: 'lançado na tribo errada' });
  rank = (await admin.get(`/api/rallies/${rally.id}/ranking`)).body;
  assert.equal(rank.find((t) => t.tribo === 'Benjamim').pontos, 1500);
  const sem = (await admin.get(`/api/rallies/${rally.id}/ranking/semanas`)).body;
  const sj = sem.series.find((s) => s.tribo === 'Judá');
  assert.equal(sj.semanal[0], 2500);
  const dash = await admin.get(`/api/rallies/${rally.id}/dashboard`);
  assert.equal(dash.status, 200, JSON.stringify(dash.body));
});
 
test('missão por quantidade: entrega do cabeça, aprovação e rejeição', async () => {
  const m = await admin.post(`/api/rallies/${rally.id}/missoes`).send({ titulo: 'Convidados', data_inicio: '2026-10-05', tipo_pontuacao: 'quantidade', pontos: 500 });
  assert.equal(m.status, 201, JSON.stringify(m.body));
  const cabeca = request.agent(app);
  await cabeca.post('/api/auth/login').send({ email: 'joao@x.com', senha: senhaCabeca });
  const e = await cabeca.post(`/api/missoes/${m.body.id}/entregas`).send({ quantidade: 4 });
  assert.equal(e.status, 201, JSON.stringify(e.body));
  const proib = await cabeca.post(`/api/rallies/${rally.id}/lancamentos`).send({ rally_tribo_id: juda().id, pontos: 1, motivo: 'x' });
  assert.equal(proib.status, 403);
  const ap = await admin.post(`/api/entregas/${e.body.id}/aprovar`).send({});
  assert.equal(ap.body.pontos, 2000);
  let rank = (await admin.get(`/api/rallies/${rally.id}/ranking`)).body;
  assert.equal(rank.find((t) => t.tribo === 'Judá').pontos, 4500);
  await admin.post(`/api/entregas/${e.body.id}/rejeitar`).send({ motivo: 'sem evidência' });
  rank = (await admin.get(`/api/rallies/${rally.id}/ranking`)).body;
  assert.equal(rank.find((t) => t.tribo === 'Judá').pontos, 2500);
});
 
test('rally encerrado é somente leitura', async () => {
  await admin.patch(`/api/rallies/${rally.id}`).send({ status: 'encerrado' });
  const r = await admin.post(`/api/rallies/${rally.id}/lancamentos`).send({ rally_tribo_id: juda().id, pontos: 1, motivo: 'x' });
  assert.equal(r.status, 409);
  const csv = await admin.get(`/api/rallies/${rally.id}/exportar/lancamentos.csv`);
  assert.equal(csv.status, 200);
});
