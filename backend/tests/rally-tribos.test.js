process.env.DB_FILE = ':memory:';
const { randomBytes } = require('node:crypto');
process.env.ADMIN_PASSWORD = randomBytes(24).toString('hex');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const db = require('../src/database/connection');
const { criarApp } = require('../src/app');
let app, admin, catalogo, anterior, originais;
const dados = (extra = {}) => ({ nome:'Rally com seleção', data_inicio:'2026-11-01', data_fim:'2026-12-31', ...extra });
const escolher = (...nomes) => catalogo.filter((t) => nomes.includes(t.nome)).map((t) => t.id);
let menor;
before(async () => {
  await db.migrate.latest(); await db.seed.run(); app=criarApp(); admin=request.agent(app);
  assert.equal((await admin.post('/api/auth/login').send({email:'admin@rally.local',senha:process.env.ADMIN_PASSWORD})).status,200);
  catalogo=(await admin.get('/api/tribos')).body;
  anterior=(await admin.post('/api/rallies').send(dados({nome:'Rally anterior', status:'ativo', tribos:catalogo.map((t)=>t.id)}))).body;
  originais=(await admin.get(`/api/rallies/${anterior.id}/tribos`)).body;
  for(const t of originais) {
    const p=(await admin.post('/api/pessoas').send({nome_completo:`Líder ${t.nome}`})).body;
    await admin.patch(`/api/rally-tribos/${t.id}`).send({cabeca_pessoa_id:p.id});
    await admin.post(`/api/rally-tribos/${t.id}/membros`).send({pessoa_id:p.id});
  }
});
after(()=>db.destroy());

test('catálogo completo está disponível para admin antes ou depois de criar rallies',async()=>{
  assert.equal(catalogo.length,13);
  assert.ok(catalogo.some((t)=>t.nome==='Manassés'));
  assert.ok(catalogo.some((t)=>t.nome==='Efraim'));
  assert.equal((await request(app).get('/api/tribos')).status,401);
});
test('criação rejeita ausência, seleção vazia, repetição, tipos inválidos e ids desconhecidos',async()=>{
  for(const tribos of [undefined,[],null,'todas',[catalogo[0].id,catalogo[0].id],[99999],[-1],[1.5],[true],[String(catalogo[0].id)],[catalogo[0].id,99999]]) {
    const body=dados({status:'ativo'});if(tribos!==undefined)body.tribos=tribos;
    const r=await admin.post('/api/rallies').send(body);
    assert.equal(r.status,400,JSON.stringify(tribos));
  }
  assert.equal((await db('rallies').count({n:'*'}).first()).n,1);
  assert.equal((await db('rallies').where({id:anterior.id}).first()).status,'ativo');
});
test('rally com duas tribos só inclui as selecionadas e copia seus vínculos',async()=>{
  const ids=escolher('Judá','Efraim');
  const r=await admin.post('/api/rallies').send(dados({tribos:ids,status:'planejado',copiar_lideres:true,copiar_participantes:true}));
  assert.equal(r.status,201,JSON.stringify(r.body));menor=r.body;
  const lista=(await admin.get(`/api/rallies/${menor.id}/tribos`)).body;
  assert.deepEqual(lista.map((t)=>t.nome),['Judá','Efraim']);
  for(const t of lista){
    const ant=await db('rally_tribos').where({rally_id:anterior.id,tribo_id:t.tribo_id}).first();
    assert.equal(t.cabeca_pessoa_id,ant.cabeca_pessoa_id);
    assert.equal((await db('membros_tribo').where({rally_tribo_id:t.id})).length,1);
  }
  assert.equal((await admin.get(`/api/rallies/${anterior.id}/tribos`)).body.length,13);
});
test('ranking, painel, CSV e relatórios consideram apenas as tribos participantes',async()=>{
  const ranking=await admin.get(`/api/rallies/${menor.id}/ranking`);
  assert.deepEqual(ranking.body.map((t)=>t.tribo),['Judá','Efraim']);
  const painel=await admin.get(`/api/rallies/${menor.id}/dashboard`);assert.equal(painel.body.totais.tribos,2);
  const almas=await admin.get(`/api/rallies/${menor.id}/relatorios-almas?semana_inicio=2026-11-09`);
  assert.deepEqual(almas.body.resumo.pendentes.map((t)=>t.nome),['Judá','Efraim']);
  const csv=await admin.get(`/api/rallies/${menor.id}/exportar/ranking.csv`);
  assert.equal(csv.status,200);assert.equal(csv.text.trim().split('\n').length,3);
});
test('seleção não depende das tribos do rally anterior e pode ter uma só tribo',async()=>{
  const r=await admin.post('/api/rallies').send(dados({tribos:escolher('Manassés'),copiar_lideres:false,copiar_participantes:false}));
  assert.equal(r.status,201);
  const lista=(await admin.get(`/api/rallies/${r.body.id}/tribos`)).body;
  assert.equal(lista.length,1);assert.equal(lista[0].nome,'Manassés');assert.equal(lista[0].cabeca_pessoa_id,null);
  assert.equal((await admin.get('/api/tribos')).body.length,13);
});
test('selecionar todas continua permitido explicitamente',async()=>{
  const r=await admin.post('/api/rallies').send(dados({tribos:catalogo.map((t)=>t.id),copiar_participantes:false}));
  assert.equal(r.status,201);assert.equal((await admin.get(`/api/rallies/${r.body.id}/tribos`)).body.length,13);
});
test('alteração de nome não modifica as tribos do rally existente',async()=>{
  const r=await admin.patch(`/api/rallies/${menor.id}`).send({nome:'Nome ajustado',tribos:catalogo.map((t)=>t.id)});
  assert.equal(r.status,200);assert.equal(r.body.nome,'Nome ajustado');
  assert.equal((await admin.get(`/api/rallies/${menor.id}/tribos`)).body.length,2);
});
