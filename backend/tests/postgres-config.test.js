const {test}=require('node:test');
const assert=require('node:assert/strict');
const {postgresConfig}=require('../src/database/postgres-config');
const banco={url:'postgresql://user:example@db.example.test:5432/postgres?sslmode=require',schema:'rally'};
test('PostgreSQL usa TLS verificado, schema privado e pool pequeno',()=>{
 const c=postgresConfig(banco);assert.equal(c.connection.ssl.rejectUnauthorized,true);
 assert.ok(!c.connection.connectionString.includes('sslmode'));assert.deepEqual(c.searchPath,['rally']);
 assert.equal(c.migrations.schemaName,'rally');assert.equal(c.pool.max,5);
});
test('PostgreSQL exige conexão e schema seguro',()=>{
 assert.throws(()=>postgresConfig({...banco,url:''}),/DATABASE_URL/);
 for(const schema of ['public','rally;drop','RALLY'])assert.throws(()=>postgresConfig({...banco,schema}),/DB_SCHEMA/);
});
test('datas PostgreSQL preservam formato sem fuso',()=>{
 assert.equal(require('pg').types.getTypeParser(1082)('2026-11-19'),'2026-11-19');
});

test('não aceita desativar TLS para banco remoto',()=>{
 const old=process.env.DB_SSL;process.env.DB_SSL='false';
 try{assert.throws(()=>postgresConfig(banco),/apenas em banco local/);}finally{if(old===undefined)delete process.env.DB_SSL;else process.env.DB_SSL=old;}
});
test('URL inválida não revela seu conteúdo no erro',()=>{
 assert.throws(()=>postgresConfig({...banco,url:'conexao-invalida'}),err=>!err.message.includes('conexao-invalida')&&/DATABASE_URL inválida/.test(err.message));
});
