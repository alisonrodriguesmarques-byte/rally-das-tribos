const {test}=require('node:test');const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const path=require('node:path');
const entry=path.resolve(__dirname,'../../api/index.js');
function load(extra){return spawnSync(process.execPath,['-e',`const app=require(${JSON.stringify(entry)});if(typeof app!=='function')process.exit(2);`],{env:{...process.env,VERCEL:'1',JWT_SECRET:'segredo-apenas-de-teste',DB_SCHEMA:'rally',DB_CLIENT:'pg',DATABASE_URL:'',...extra},encoding:'utf8',timeout:10000});}
test('Vercel recusa conexão ausente e SQLite',()=>{
 assert.notEqual(load({}).status,0);
 const r=load({DB_CLIENT:'better-sqlite3',DB_FILE:':memory:'});assert.notEqual(r.status,0);assert.match(r.stderr,/SQLite não é permitido/);
});
test('Vercel exporta Express sem conectar ou migrar ao carregar',()=>{
 const r=load({DATABASE_URL:'postgresql://teste:teste@127.0.0.1:1/teste'});assert.equal(r.status,0,r.stderr);
});
