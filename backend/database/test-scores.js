'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {verifyTestApiServer,loginTestAdmin,getTestDatabase}=require('./test-support');
const {ScoreService}=require('../services/scoreService');
test('immediate ranking and immutable score corrections',async t=>{
 const base=await verifyTestApiServer(),session=await loginTestAdmin(base),db=getTestDatabase();await db.connect();
 async function call(route,method='GET',body,auth=true,csrf=true){const headers={'Content-Type':'application/json'};if(auth)headers.Cookie=session.cookie;if(auth&&csrf)headers['X-CSRF-Token']=session.csrfToken;const r=await fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:(await r.json()).data};}
 let rally,entry;
 const key=()=>crypto.randomUUID();
 try{
 await t.test('anonymous access and missing CSRF are rejected',async()=>{
 assert.equal((await call('/pontuacoes/1','GET',undefined,false)).status,401);
 const r=await call('/rallies','POST',{nome:'Score fixture',data_inicio:'2026-11-01',data_fim:'2026-12-31',tribos_ids:[1,2]});assert.equal(r.status,201);rally=r.data;
 assert.equal((await call('/pontuacoes/'+rally.id,'POST',{},true,false)).status,403);
 assert.equal((await call('/pontuacoes/'+rally.id,'POST',{tribo_id:rally.tribos[0].id,pontos:100,justificativa:'Fixture',request_key:key()})).status,409);
 assert.equal((await call('/rallies/'+rally.id+'/start','PATCH')).status,200);
 });
 await t.test('new points immediately change the ranking and retries never duplicate',async()=>{
 const body={tribo_id:rally.tribos[0].id,pontos:100,justificativa:'Atividade sintetica',request_key:key()};
 const [a,b]=await Promise.all([call('/pontuacoes/'+rally.id,'POST',body),call('/pontuacoes/'+rally.id,'POST',body)]);assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.data.id,b.data.id);entry=a.data.id;
 const view=await call('/pontuacoes/'+rally.id);assert.equal(view.data.ranking[0].pontuacao_total,100);assert.equal(view.data.lancamentos.length,1);
 assert.equal((await call('/pontuacoes/'+rally.id,'POST',{...body,pontos:101})).status,409);
 });
 await t.test('invalid values and cross-edition tribes do not create entries',async()=>{
 for(const pontos of [-1,0,1.5,'10',1000001])assert.equal((await call('/pontuacoes/'+rally.id,'POST',{tribo_id:rally.tribos[0].id,pontos,justificativa:'Invalid fixture',request_key:key()})).status,400);
 assert.equal((await call('/pontuacoes/'+rally.id,'POST',{tribo_id:99999,pontos:10,justificativa:'Unknown tribe',request_key:key()})).status,404);
 assert.equal((await call('/pontuacoes/'+rally.id)).data.lancamentos.length,1);
 });
 await t.test('audit failure rolls back compensation and replacement together',async()=>{
 const service=new ScoreService(db),run=db.run.bind(db);db.run=async(sql,p)=>{if(/INSERT INTO historico_pontuacoes/.test(sql))throw new Error('Synthetic audit failure');return run(sql,p);};
 try{await assert.rejects(service.mutate(session.user.id,rally.id,{pontos:40,justificativa:'Rollback fixture',request_key:key()},entry),/Synthetic audit failure/);}finally{db.run=run;}
 assert.equal((await call('/pontuacoes/'+rally.id)).data.lancamentos.length,1);
 });
 await t.test('correction preserves the original and changes net points exactly once',async()=>{
 const body={pontos:40,justificativa:'Correcao sintetica',request_key:key()};const fixed=await call(`/pontuacoes/${rally.id}/${entry}/corrigir`,'POST',body);assert.equal(fixed.status,200);
 assert.equal((await call(`/pontuacoes/${rally.id}/${entry}/corrigir`,'POST',body)).data.id,fixed.data.id);
 const view=(await call('/pontuacoes/'+rally.id)).data;assert.equal(view.ranking[0].pontuacao_total,40);assert.equal(view.lancamentos.length,3);assert.equal(view.lancamentos.find(p=>p.id===entry).pontos,100);assert(view.lancamentos.some(p=>p.corrige_id===entry&&p.pontos===40));
 await assert.rejects(db.run('DELETE FROM pontuacoes WHERE id=?',[entry]));await assert.rejects(db.run('UPDATE pontuacoes SET pontos=5 WHERE id=?',[entry]));
 const zero=await call(`/pontuacoes/${rally.id}/${fixed.data.id}/corrigir`,'POST',{pontos:0,justificativa:'Estorno sintetico',request_key:key()});assert.equal(zero.status,200);
 assert((await call('/pontuacoes/'+rally.id)).data.ranking.every(r=>r.pontuacao_total===0));
 });
 await t.test('closed results stay readable and reject new points',async()=>{
 assert.equal((await call('/rallies/'+rally.id+'/encerrar','PATCH')).status,200);
 assert.equal((await call('/pontuacoes/'+rally.id,'POST',{tribo_id:rally.tribos[0].id,pontos:20,justificativa:'Closed',request_key:key()})).status,409);
 assert.equal((await call('/pontuacoes/'+rally.id)).status,200);
 });
 }finally{await db.close();}
});
