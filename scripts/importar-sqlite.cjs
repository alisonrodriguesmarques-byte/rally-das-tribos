// Executar localmente, com o aplicativo parado e uma cópia do SQLite.
const path=require('node:path');
const Sqlite=require('../backend/node_modules/better-sqlite3');
const config=require('../backend/src/config');
const db=require('../backend/src/database/connection');
const tables=['pessoas','usuarios','rallies','tribos','rally_tribos','membros_tribo','categorias','lancamentos','lancamentos_historico','auditoria','missoes','missao_tribos','missao_entregas','dinamicas','provas','prova_tribos','questoes','alternativas','respostas_aceitas','tentativas','respostas','prova_resultados','encontros','presencas','relatorios_almas','google_vinculos','notificacoes','notificacoes_email'];
(async()=>{
 let source;
 try{
  if(config.banco.cliente!=='pg'||!process.argv[2])throw new Error('Use DATABASE_URL PostgreSQL e informe o caminho de uma cópia SQLite.');
  source=new Sqlite(path.resolve(process.argv[2]),{readonly:true,fileMustExist:true});
  if(source.pragma('integrity_check',{simple:true})!=='ok'||source.pragma('foreign_key_check').length)throw new Error('SQLite precisa passar pela verificação de integridade.');
  if(!source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='relatorios_almas'").get())throw new Error('Atualize o SQLite na versão atual do aplicativo antes de importar.');
  await db.raw('CREATE SCHEMA IF NOT EXISTS ??',[config.banco.schema]);
  await db.migrate.latest();
  let total=0;
  await db.transaction(async trx=>{
   // Recusa misturar dados, inclusive administrador criado por primeiro deploy.
   for(const table of tables)if(await trx(table).first())throw new Error('Destino precisa estar vazio. Importação cancelada sem substituir dados.');
   for(const table of tables){
    const columns=await trx(table).columnInfo();
    const existe=source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    const origem=existe?source.prepare(`SELECT * FROM "${table}"`).all():[];
    const rows=origem.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,columns[k]?.type==='boolean'&&v!==null?Boolean(v):v])));
    for(let i=0;i<rows.length;i+=50)await trx(table).insert(rows.slice(i,i+50));
    if(Number((await trx(table).count({n:'*'}).first()).n)!==rows.length)throw new Error('Contagem divergente. Importação cancelada.');
    if(columns.id){
     const max=Number((await trx(table).max({n:'id'}).first()).n)||0;
     await trx.raw('SELECT setval(pg_get_serial_sequence(?, ?), ?, ?)',[`${config.banco.schema}.${table}`,'id',max||1,max>0]);
    }
    total+=rows.length;
   }
  });
  console.log(`Importação concluída: ${total} registros. Contagens e chaves estrangeiras verificadas. As senhas existentes foram preservadas.`);
 }catch(err){console.error(err.message.startsWith('Destino')||err.message.startsWith('Use ')||err.message.startsWith('SQLite')||err.message.startsWith('Atualize')?err.message:'Falha na importação. A transação foi revertida; confira versão, conexão e integridade do banco.');process.exitCode=1;}
 finally{if(source)source.close();await db.destroy();}
})();
