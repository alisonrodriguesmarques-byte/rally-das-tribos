if(process.env.RALLY_TEST_POSTGRES!=='1'){process.env.DB_CLIENT='better-sqlite3';delete process.env.DATABASE_URL;}else if(!/^teste_[a-f0-9]+$/.test(process.env.DB_SCHEMA||'')||!['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname))throw new Error('Use banco local descartável.');
process.env.DB_FILE=':memory:';
const {randomBytes}=require('crypto');process.env.ADMIN_PASSWORD=randomBytes(24).toString('hex');process.env.JWT_SECRET=randomBytes(32).toString('hex');
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const db=require('../src/database/connection'),{inserir}=require('../src/utils/db');
const service=require('../src/services/notificacoesService'),worker=require('../src/services/emailWorker');
let admin,rally,rtA,rtB,leader,aux,member,other,outsider;
async function user(nome){const pid=await inserir(db,'pessoas',{nome_completo:nome});const id=await inserir(db,'usuarios',{pessoa_id:pid,email:nome+'@teste.local',senha_hash:'sem-login',papel:'membro'});return {id,pid,admin:false};}
before(async()=>{
 await db.migrate.latest();await db.seed.run();admin=await db('usuarios').where({papel:'admin'}).first();admin.admin=true;
 [leader,aux,member,other,outsider]=await Promise.all(['lider','auxiliar','participante','outra','fora'].map(user));
 rally=await inserir(db,'rallies',{nome:'Rally notificações',data_inicio:'2026-11-01',data_fim:'2026-12-31',status:'ativo'});
 const tribos=await db('tribos').orderBy('id');
 rtA=await inserir(db,'rally_tribos',{rally_id:rally,tribo_id:tribos[0].id,cabeca_pessoa_id:leader.pid,auxiliar_pessoa_id:aux.pid});
 rtB=await inserir(db,'rally_tribos',{rally_id:rally,tribo_id:tribos[1].id,cabeca_pessoa_id:other.pid});
 await inserir(db,'membros_tribo',{rally_tribo_id:rtA,pessoa_id:member.pid});
});
after(()=>db.destroy());
test('missão restrita avisa admin e usuários da tribo certa, sem pontuação',async()=>{
 const id=await require('../src/services/missoesService').criar(rally,{titulo:'Missão privada',data_inicio:'2026-11-01',tipo_pontuacao:'fixa',pontos:500,tribos:[rtA]},admin);
 const rows=await db('notificacoes').where({tipo:'missao_criada'});
 assert.deepEqual(rows.map(x=>x.usuario_id).sort((a,b)=>a-b),[admin.id,leader.id,aux.id,member.id].sort((a,b)=>a-b));
 assert.ok(rows.every(x=>x.destino===`#/missoes/${id}?rally_id=${rally}`&&!x.mensagem.includes('500')));
 assert.equal(Number((await db('notificacoes_email').count({n:'*'}).first()).n),0);
});
test('somente o dono pode ler e desativação da conta impede novos avisos',async()=>{
 const row=await db('notificacoes').where({usuario_id:leader.id}).first();
 await assert.rejects(service.ler(other.id,row.id),e=>e.status===404);
 await service.ler(leader.id,row.id);assert.ok((await db('notificacoes').where({id:row.id}).first()).lido_em);
 await db('usuarios').where({id:outsider.id}).update({ativo:false});
 await service.criar([outsider.id],{tipo:'aviso',titulo:'A',mensagem:'B'});
 assert.equal((await service.listar(outsider.id)).itens.length,0);
});
test('envio de relatório avisa admin; devolução avisa autor e líderes somente da mesma tribo',async()=>{
 const ctx={admin:false,rallyTriboId:rtA,funcao:'cabeca'};
 const rel=await require('../src/services/relatoriosAlmasService').salvar(rally,{semana_inicio:'2026-11-09',acao:'enviar',dias:['segunda','quarta','quinta','sexta','sabado'].map(dia=>({dia,novas:2,afastadas:1}))},ctx,leader);
 assert.deepEqual((await db('notificacoes').where({tipo:'relatorio_enviado'})).map(x=>x.usuario_id),[admin.id]);
 await require('../src/services/relatoriosAlmasService').avaliar(rel.id,{acao:'devolver',motivo:'Confira a semana'},admin);
 const recipients=(await db('notificacoes').where({tipo:'relatorio_devolvido'})).map(x=>x.usuario_id).sort((a,b)=>a-b);
 assert.deepEqual(recipients,[leader.id,aux.id].sort((a,b)=>a-b));
 const notice=await db('notificacoes').where({tipo:'relatorio_devolvido',usuario_id:leader.id}).first();assert.ok(notice.mensagem.includes('Administrador devolveu seu relatório.\nMotivo: Confira a semana'));assert.ok(notice.mensagem.startsWith('Olá 👋, lider!'));
});
test('novos eventos são pessoais e não geram mais e-mails',async()=>{
 await db('usuarios').where({id:leader.id}).update({email_notificacoes:true});
 const before=Number((await db('notificacoes_email').count({n:'*'}).first()).n);
 await service.criar([leader.id],{tipo:'teste',titulo:'Atualização',mensagem:'Administrador publicou uma missão.'});
 const item=(await service.listar(leader.id)).itens[0];assert.ok(item.mensagem.startsWith('Olá 👋, lider!'));assert.ok(item.mensagem.includes('Administrador publicou'));
 assert.equal(Number((await db('notificacoes_email').count({n:'*'}).first()).n),before);
 assert.equal((await worker.processarFila({transport:{sendMail:()=>{throw Error('Não deveria enviar');}}})).processadas,0);
});
test('contador do sino não expõe as mensagens',async()=>{const r=await service.contar(leader.id);assert.deepEqual(Object.keys(r),['nao_lidas']);});
test('7 dias removem avisos lidos/não lidos e fila antiga, preservando recentes e dados do rally',async()=>{
 const now=new Date(),ms=86400000;
 const old=await inserir(db,'notificacoes',{usuario_id:leader.id,tipo:'teste',titulo:'Antiga',mensagem:'A',destino:'#/notificacoes',criado_em:new Date(now.getTime()-8*ms).toISOString()});
 const edge=await inserir(db,'notificacoes',{usuario_id:aux.id,tipo:'teste',titulo:'Limite',mensagem:'B',destino:'#/notificacoes',criado_em:new Date(now.getTime()-7*ms).toISOString(),lido_em:now.toISOString()});
 const recent=await inserir(db,'notificacoes',{usuario_id:leader.id,tipo:'teste',titulo:'Recente',mensagem:'C',destino:'#/notificacoes',criado_em:new Date(now.getTime()-6*ms).toISOString()});
 await inserir(db,'notificacoes_email',{notificacao_id:old,status:'enviado'});
 const rallies=await db('rallies').select('*');const reports=await db('relatorios_almas').select('*');
 await service.limparExpiradas(now);
 assert.equal(await db('notificacoes').where({id:old}).first(),undefined);assert.equal(await db('notificacoes').where({id:edge}).first(),undefined);assert.ok(await db('notificacoes').where({id:recent}).first());assert.equal(await db('notificacoes_email').where({notificacao_id:old}).first(),undefined);
 assert.deepEqual(await db('rallies').select('*'),rallies);assert.deepEqual(await db('relatorios_almas').select('*'),reports);
});
test('exclusão manual só permite apagar avisos próprios e atualiza o contador',async()=>{
 const own=await inserir(db,'notificacoes',{usuario_id:leader.id,tipo:'teste',titulo:'Meu',mensagem:'Texto',destino:'#/notificacoes'});
 const count=(await service.contar(leader.id)).nao_lidas;
 await assert.rejects(service.excluir(other.id,own),e=>e.status===404);assert.ok(await db('notificacoes').where({id:own}).first());
 await service.excluir(leader.id,own);assert.equal(await db('notificacoes').where({id:own}).first(),undefined);assert.equal((await service.contar(leader.id)).nao_lidas,count-1);
});
