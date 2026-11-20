if(process.env.RALLY_TEST_POSTGRES!=='1'){process.env.DB_CLIENT='better-sqlite3';delete process.env.DATABASE_URL;}else if(!/^teste_[a-f0-9]+$/.test(process.env.DB_SCHEMA||'')||!['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname))throw new Error('Use PostgreSQL local de teste.');
process.env.DB_FILE=':memory:';
const {randomBytes}=require('crypto');
process.env.JWT_SECRET=randomBytes(32).toString('hex');process.env.ADMIN_PASSWORD=randomBytes(24).toString('hex');
process.env.APP_URL='http://localhost:3000';process.env.GOOGLE_CLIENT_ID='cliente-teste.apps.googleusercontent.com';process.env.GOOGLE_CLIENT_SECRET='segredo-apenas-teste';
const {test,before,after,mock}=require('node:test');const assert=require('node:assert/strict');const request=require('supertest');const jwt=require('jsonwebtoken');
const {OAuth2Client}=require('google-auth-library');const db=require('../src/database/connection');const auth=require('../src/services/authService');const google=require('../src/services/googleService');const {criarApp}=require('../src/app');const {JWT_ISSUER,JWT_AUDIENCE}=require('../src/middlewares/auth');
let app,admin,adminId,memberId,personId,memberPass=randomBytes(24).toString('hex');
before(async()=>{
 await db.migrate.latest();await db.seed.run();app=criarApp();admin=request.agent(app);
 assert.equal((await admin.post('/api/auth/login').send({email:'admin@rally.local',senha:process.env.ADMIN_PASSWORD})).status,200);
 adminId=(await db('usuarios').where({papel:'admin'}).first()).id;
 const [p]=await db('pessoas').insert({nome_completo:'Pessoa vinculada'}).returning('id');personId=p.id??p;
 memberId=(await auth.definirAcesso(personId,{email:'pessoa@teste.local',senha:memberPass},adminId)).id;
});
after(async()=>{mock.restoreAll();await db.destroy();});
test('Google de mesmo e-mail não recebe acesso automático; pedido não duplica notificações',async()=>{
 const identity={sub:'subject-admin-pendente',email:'admin@rally.local',nome:'Conta solicitante'};
 const first=await google.processarIdentidade(identity);assert.equal(first.status,'pendente');assert.equal(first.token,undefined);
 const row=await db('google_vinculos').where({google_sub:identity.sub}).first();assert.equal(row.usuario_id,null);
 await google.processarIdentidade(identity);
 assert.equal(Number((await db('notificacoes').where({tipo:'google_pendente',usuario_id:adminId}).count({n:'*'}).first()).n),1);
});
test('aprovação exige admin e conta existente; vínculo aprovado dá acesso e desconexão revoga sessão',async()=>{
 const [g]=await db('google_vinculos').where({google_sub:'subject-admin-pendente'});
 const member=request.agent(app);await member.post('/api/auth/login').send({email:'pessoa@teste.local',senha:memberPass});
 assert.equal((await member.post(`/api/google-vinculos/${g.id}/aprovar`).send({usuario_id:memberId})).status,403);
 await assert.rejects(google.aprovar(g.id,999999,adminId),/Conta indisponível/);
 assert.equal((await admin.post(`/api/google-vinculos/${g.id}/aprovar`).send({usuario_id:memberId})).status,200);
 const session=await google.processarIdentidade({sub:g.google_sub,email:g.email,nome:g.nome});assert.equal(session.usuario.id,memberId);
 assert.equal((await request(app).get('/api/auth/me').set('Authorization','Bearer '+session.token)).status,200);
 await google.desvincular(g.id,adminId);
 assert.equal((await request(app).get('/api/auth/me').set('Authorization','Bearer '+session.token)).status,401);
});
test('não permite vincular dois Googles à mesma conta e não troca usuário em pedido já avaliado',async()=>{
 const a=await google.processarIdentidade({sub:'subject-a',email:'a@teste.local',nome:'A'});
 const b=await google.processarIdentidade({sub:'subject-b',email:'b@teste.local',nome:'B'});
 await google.aprovar(a.vinculoId,memberId,adminId);
 await assert.rejects(google.aprovar(b.vinculoId,memberId,adminId),/já possui um vínculo/);
 await assert.rejects(google.aprovar(a.vinculoId,adminId,adminId,process.env.ADMIN_PASSWORD),/já foi avaliada/);
 await google.rejeitar(b.vinculoId,adminId);
 assert.equal((await google.processarIdentidade({sub:'subject-b',email:'b@teste.local',nome:'B'})).status,'rejeitado');
});
test('OAuth rejeita state, token forjado, nonce e e-mail não verificado antes de criar pedido',async()=>{
 const flow=await google.iniciar();const url=new URL(flow.url);const state=url.searchParams.get('state');const decoded=jwt.decode(flow.cookie);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(decoded.verifier.length>=43);
 const get=mock.method(OAuth2Client.prototype,'getToken',async()=>({tokens:{id_token:'token-mock'}}));
 let payload={sub:'subject-novo',email:'novo@teste.local',email_verified:true,name:'Novo',nonce:decoded.nonce};
 const verify=mock.method(OAuth2Client.prototype,'verifyIdToken',async()=>({getPayload:()=>payload}));
 try{
  await assert.rejects(google.concluir('code','state-forjado',flow.cookie),/inválida/);assert.equal(get.mock.callCount(),0);
  verify.mock.mockImplementation(async()=>{throw new Error('assinatura inválida');});await assert.rejects(google.concluir('code',state,flow.cookie),/assinatura inválida/);
  verify.mock.mockImplementation(async()=>({getPayload:()=>payload}));payload={...payload,nonce:'nonce-forjado'};await assert.rejects(google.concluir('code',state,flow.cookie),/não verificada/);
  payload={...payload,nonce:decoded.nonce,email_verified:false};await assert.rejects(google.concluir('code',state,flow.cookie),/não verificada/);
  assert.equal(await db('google_vinculos').where({google_sub:'subject-novo'}).first(),undefined);
  payload={...payload,email_verified:true};const result=await google.concluir('code',state,flow.cookie);assert.equal(result.status,'pendente');assert.equal(result.token,undefined);
 }finally{get.mock.restore();verify.mock.restore();}
});
test('mudança de senha revoga tokens antigos e auditoria não registra senhas ou hashes',async()=>{
 const session=await auth.login('pessoa@teste.local',memberPass);const next=randomBytes(24).toString('hex');
 await assert.rejects(auth.trocarSenha(memberId,memberPass,'curta'),/12 caracteres/);
 await auth.trocarSenha(memberId,memberPass,next);memberPass=next;
 assert.equal((await request(app).get('/api/auth/me').set('Authorization','Bearer '+session.token)).status,401);
 const audit=await db('auditoria').where({entidade:'usuarios',entidade_id:memberId,acao:'trocar_senha'}).first();assert.ok(audit);assert.ok(!audit.depois_json.includes(next));assert.ok(!audit.depois_json.includes('$2'));
});
test('JWT limita algoritmo/emissor e papel administrativo sempre vem do banco',async()=>{
 const user=await db('usuarios').where({id:memberId}).first();
 const token=jwt.sign({av:user.auth_versao,papel:'admin'},process.env.JWT_SECRET,{subject:String(memberId),issuer:JWT_ISSUER,audience:JWT_AUDIENCE,algorithm:'HS256'});
 assert.equal((await request(app).get('/api/pessoas').set('Authorization','Bearer '+token)).status,403);
 const wrong=jwt.sign({av:user.auth_versao},process.env.JWT_SECRET,{subject:String(memberId),issuer:'outro',audience:JWT_AUDIENCE,algorithm:'HS256'});
 assert.equal((await request(app).get('/api/auth/me').set('Authorization','Bearer '+wrong)).status,401);
});
test('último administrador e própria conta administrativa não podem perder acesso',async()=>{
 const p=(await db('usuarios').where({id:adminId}).first()).pessoa_id;
 await assert.rejects(auth.definirAcesso(p,{ativo:false},adminId),/próprio acesso/);
 await assert.rejects(auth.definirAcesso(p,{papel:'membro'}),/último administrador/);
});
test('vínculo administrativo exige senha do admin que aprova, sem alterar pedido quando falha',async()=>{
 const req=await google.processarIdentidade({sub:'subject-stepup',email:'stepup@teste.local',nome:'Admin Stepup'});
 await assert.rejects(google.aprovar(req.vinculoId,adminId,adminId),/própria senha/);
 await assert.rejects(google.aprovar(req.vinculoId,adminId,adminId,'senha-incorreta'),/própria senha/);
 assert.equal((await db('google_vinculos').where({id:req.vinculoId}).first()).status,'pendente');
 await google.aprovar(req.vinculoId,adminId,adminId,process.env.ADMIN_PASSWORD);
 assert.equal((await db('google_vinculos').where({id:req.vinculoId}).first()).status,'aprovado');
 const events=await db('auditoria').where({entidade:'google_vinculos',entidade_id:req.vinculoId});
 assert.ok(!JSON.stringify(events).includes(process.env.ADMIN_PASSWORD));
});
test('logout com token já revogado não derruba uma sessão nova',async()=>{
 const old=await auth.login('pessoa@teste.local',memberPass);
 assert.equal((await request(app).post('/api/auth/logout').set('Authorization','Bearer '+old.token)).status,200);
 const current=await auth.login('pessoa@teste.local',memberPass);
 await request(app).post('/api/auth/logout').set('Authorization','Bearer '+old.token);
 assert.equal((await request(app).get('/api/auth/me').set('Authorization','Bearer '+current.token)).status,200);
});
test('pedido rejeitado só volta a acessar após reavaliação explícita do administrador',async()=>{
 const a=await db('google_vinculos').where({google_sub:'subject-a'}).first();const b=await db('google_vinculos').where({google_sub:'subject-b'}).first();
 assert.equal((await google.processarIdentidade({sub:b.google_sub,email:b.email,nome:b.nome})).status,'rejeitado');
 await google.desvincular(a.id,adminId);await google.aprovar(b.id,memberId,adminId);
 assert.equal((await google.processarIdentidade({sub:b.google_sub,email:b.email,nome:b.nome})).status,'aprovado');
});
