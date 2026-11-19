// Executar uma vez no computador, ou como etapa controlada antes de publicar.
const config=require('../backend/src/config');
const db=require('../backend/src/database/connection');
(async()=>{
 try{
  if(config.banco.cliente!=='pg')throw new Error('Preparação da nuvem exige PostgreSQL.');
  if(config.banco.cliente==='pg')await db.raw('CREATE SCHEMA IF NOT EXISTS ??',[config.banco.schema]);
  await db.migrate.latest();await db.seed.run();console.log('Banco preparado sem apagar dados existentes.');
 }catch(e){console.error('Não foi possível preparar o banco. Confira conexão, certificado e variáveis de administrador.');process.exitCode=1;}
 finally{await db.destroy();}
})();
