// Executa as mesmas regras da API em schemas novos, sem apagar bancos existentes.
const {Client}=require('../backend/node_modules/pg');
const {spawnSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const path=require('node:path');
(async()=>{
 const url=process.env.TEST_DATABASE_URL;
 if(!url)throw new Error('Defina TEST_DATABASE_URL de um PostgreSQL local de teste.');
 if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))throw new Error('Use PostgreSQL local para os testes.');
 const client=new Client({connectionString:url,ssl:false});await client.connect();
 let failed=false;
 try{
  for(const file of ['api.test.js','almas.test.js','rally-tribos.test.js']){
   const schema='teste_'+randomBytes(8).toString('hex');
   await client.query(`CREATE SCHEMA "${schema}"`);
   try{
    const run=spawnSync(process.execPath,['--test',path.join(__dirname,'../backend/tests',file)],{stdio:'inherit',env:{...process.env,RALLY_TEST_POSTGRES:'1',DATABASE_URL:url,DB_CLIENT:'pg',DB_SCHEMA:schema,DB_SSL:'false'}});
    if(run.status!==0)failed=true;
   }finally{await client.query(`DROP SCHEMA "${schema}" CASCADE`);}
  }
 }finally{await client.end();}
 if(failed)process.exitCode=1;
})().catch(()=>{console.error('Falha no teste PostgreSQL. Verifique o serviço e TEST_DATABASE_URL.');process.exitCode=1;});
