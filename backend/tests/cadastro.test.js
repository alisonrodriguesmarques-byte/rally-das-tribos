if(process.env.RALLY_TEST_POSTGRES!=='1'){process.env.DB_CLIENT='better-sqlite3';delete process.env.DATABASE_URL;}else if(!/^teste_[a-f0-9]+$/.test(process.env.DB_SCHEMA||'')||!['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname))throw Error('Use teste local.');
process.env.DB_FILE=':memory:';const {randomBytes}=require('crypto');process.env.ADMIN_PASSWORD=randomBytes(24).toString('hex');process.env.JWT_SECRET=randomBytes(32).toString('hex');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),request=require('supertest');const db=require('../src/database/connection');const cadastro=require('../src/services/cadastroService');let app,admin,uid;
const senha=randomBytes(20).toString('hex');
before(async()=>{await db.migrate.latest();await db.seed.run();app=require('../src/app').criarApp();admin=request.agent(app);await admin.post('/api/auth/login').send({email:'admin@rally.local',senha:process.env.ADMIN_PASSWORD});uid=(await db('usuarios').where({papel:'admin'}).first()).id;});after(()=>db.destroy());
test('cadastro público não cria conta nem libera dados antes da aprovação',async()=>{
 const r=await request(app).post('/api/auth/cadastro').send({nome:'Nova pessoa',email:'nova@example.test',senha,papel:'admin'});assert.equal(r.status,201);assert.ok(!JSON.stringify(r.body).includes('senha_hash'));
 assert.equal(await db('usuarios').where({email:'nova@example.test'}).first(),undefined);
 assert.equal((await request(app).post('/api/auth/login').send({email:'nova@example.test',senha})).status,401);
 assert.equal((await request(app).get('/api/cadastros')).status,401);
});
test('repetição não sobrescreve senha e apenas admin aprova cadastro como membro',async()=>{
 await cadastro.solicitar({nome:'Tentativa repetida',email:'nova@example.test',senha:'OutraSenhaPrivada123'});
 const pending=await db('cadastros_pendentes').where({email:'nova@example.test'}).first();
 assert.equal((await admin.post(`/api/cadastros/${pending.id}/aprovar`).send({papel:'admin'})).status,200);
 const u=await db('usuarios').where({email:'nova@example.test'}).first();assert.equal(u.papel,'membro');assert.equal((await db('cadastros_pendentes').where({id:pending.id}).first()).senha_hash,null);
 const member=request.agent(app);assert.equal((await member.post('/api/auth/login').send({email:'nova@example.test',senha})).status,200);
 assert.equal((await member.get('/api/cadastros')).status,403);assert.equal((await member.post('/api/cadastros/1/aprovar').send({})).status,403);
});
test('cadastro Google só é criado após validação e não substitui conta já existente',async()=>{
 await db('google_vinculos').insert({google_sub:'cadastro-sub',email:'google@example.test',nome:'Google novo'});const g=await db('google_vinculos').where({google_sub:'cadastro-sub'}).first();
 assert.equal(await db('usuarios').where({email:g.email}).first(),undefined);await cadastro.criarGoogle(g.id,{},uid);assert.equal((await db('usuarios').where({email:g.email}).first()).papel,'membro');assert.equal((await db('google_vinculos').where({id:g.id}).first()).status,'aprovado');
 await db('google_vinculos').insert({google_sub:'duplicado-sub',email:'admin@rally.local'});const d=await db('google_vinculos').where({google_sub:'duplicado-sub'}).first();await assert.rejects(cadastro.criarGoogle(d.id,{},uid),e=>e.status===409);
});
test('rejeição preserva pessoas existentes e não cria usuário',async()=>{
 await cadastro.solicitar({nome:'Rejeitado',email:'rejeitado@example.test',senha});const p=await db('cadastros_pendentes').where({email:'rejeitado@example.test'}).first();await cadastro.rejeitar(p.id,uid);assert.equal(await db('usuarios').where({email:p.email}).first(),undefined);assert.equal((await db('cadastros_pendentes').where({id:p.id}).first()).senha_hash,null);
});
test('preferências de e-mail e composição não fazem mais parte da API',async()=>{assert.equal((await admin.get('/api/notificacoes/preferencias')).status,404);assert.equal((await admin.post('/api/notificacoes/avisos').send({})).status,404);});
