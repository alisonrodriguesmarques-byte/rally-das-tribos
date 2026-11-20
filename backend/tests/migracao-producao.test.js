const {test}=require('node:test');const assert=require('node:assert/strict');const knex=require('knex');
test('migrações aditivas preservam dados e senhas de uma instalação existente',async()=>{
 const db=knex({client:'better-sqlite3',connection:{filename:':memory:'},useNullAsDefault:true});
 try{
  await require('../src/database/migrations/001_esquema_inicial').up(db);await require('../src/database/migrations/002_tribos_relatorios_almas').up(db);
  await db('pessoas').insert({id:17,nome_completo:'Pessoa histórica'});
  await db('usuarios').insert({id:12,pessoa_id:17,email:'historico@example.test',senha_hash:'hash-original-preservado',papel:'admin'});
  await db('rallies').insert({id:9,nome:'Rally histórico',data_inicio:'2026-01-01',data_fim:'2026-03-01',status:'encerrado'});
  await db('tribos').insert({id:5,nome:'Judá',slug:'juda',ordem:1});await db('rally_tribos').insert({id:8,rally_id:9,tribo_id:5});
  await db('lancamentos').insert({id:23,rally_id:9,rally_tribo_id:8,pontos:1800,motivo:'Histórico',origem_tipo:'manual',data_referencia:'2026-02-01',criado_por:12});
  await db('relatorios_almas').insert({id:31,rally_id:9,rally_tribo_id:8,semana_inicio:'2026-02-02',semana_fim:'2026-02-08',dias_json:'[]',novas:4,afastadas:3,responsavel_id:12,responsavel_nome:'Pessoa histórica',atualizado_em:'2026-02-08'});
  const tables=['pessoas','usuarios','rallies','tribos','rally_tribos','lancamentos','relatorios_almas'];const before={};for(const t of tables)before[t]=await db(t).select('*');
  await require('../src/database/migrations/003_seguranca_google_arquivamento').up(db);await require('../src/database/migrations/004_notificacoes').up(db);
  for(const t of tables){const after=await db(t).select('*');for(let i=0;i<after.length;i++)for(const key of Object.keys(before[t][i]))assert.deepEqual(after[i][key],before[t][i][key],t+'.'+key);}
  assert.equal((await db('usuarios').first()).email_notificacoes,0);assert.equal((await db('usuarios').first()).auth_versao,0);assert.equal((await db('rallies').first()).arquivado_em,null);
 }finally{await db.destroy();}
});
