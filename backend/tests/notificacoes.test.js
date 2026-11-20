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
});
test('avisos exigem admin e validam vínculo rally/tribo',async()=>{
 await assert.rejects(service.criarAviso({titulo:'Teste',mensagem:'Texto'},leader),e=>e.status===403);
 await assert.rejects(service.criarAviso({titulo:'Teste',mensagem:'Texto',alvo:'tribo',rally_id:rally,rally_tribo_id:999999},admin),e=>e.status===400);
 const r=await service.criarAviso({titulo:'Aviso <script>',mensagem:'Mensagem importante',alvo:'tribo',rally_id:rally,rally_tribo_id:rtA},admin);assert.equal(r.destinatarios,4);
});
test('e-mail só entra na fila com consentimento e nunca contém corpo privado; envio não se repete',async()=>{
 await service.atualizarPreferencias(leader.id,{email_notificacoes:true});
 await service.criar([leader.id,other.id],{tipo:'aviso',titulo:'SEGREDO',mensagem:'CONTAGEM PRIVADA 9999'});
 const sent=[];const transport={sendMail:async mail=>sent.push(mail)};
 const config={from:'Rally <avisos@teste.local>',url:'https://rally.example/#/notificacoes'};
 await worker.processarFila({transport,config});await worker.processarFila({transport,config});
 assert.equal(sent.length,1);assert.equal(sent[0].to,'lider@teste.local');
 assert.ok(!sent[0].text.includes('CONTAGEM')&&!sent[0].subject.includes('SEGREDO'));
 await service.criar([leader.id],{tipo:'aviso',titulo:'Outro',mensagem:'Texto'});await service.atualizarPreferencias(leader.id,{email_notificacoes:false});
 await worker.processarFila({transport,config});assert.equal(sent.length,1);
});
test('falha de provedor é registrada sem segredo e pode ser tentada novamente',async()=>{
 await service.atualizarPreferencias(aux.id,{email_notificacoes:true});
 await service.criar([aux.id],{tipo:'aviso',titulo:'Teste',mensagem:'Texto'});
 const config={from:'avisos@teste.local',url:'https://rally.example/#/notificacoes'};
 await worker.processarFila({config,transport:{sendMail:async()=>{throw Error('SMTP_PASS_NAO_PODE_VAZAR');}}});
 const row=await db('notificacoes_email').where({status:'falhou'}).first();assert.ok(row);assert.equal(row.tentativas,1);assert.ok(!row.ultimo_erro.includes('NAO_PODE'));
 await db('notificacoes_email').where({id:row.id}).update({proxima_em:new Date(Date.now()-1000).toISOString()});
 let sent=0;await worker.processarFila({config,transport:{sendMail:async()=>{sent++;}}});assert.equal(sent,1);
});
test('Resend usa HTTPS e chave de idempotência fixa sem enviar a mensagem privada',async()=>{
 const requests=[];const mailer=worker.criarTransport({provider:'resend',apiKey:'chave-falsa'},async(url,args)=>{requests.push({url,args});return {ok:true};});
 await mailer.sendMail({from:'a@teste.local',to:'b@teste.local',subject:'Aviso importante',text:'Entre na conta',messageId:'<rally-notificacao-123@rally.example>'});
 assert.equal(requests[0].url,'https://api.resend.com/emails');assert.equal(requests[0].args.headers['Idempotency-Key'],'rally-notificacao-123');assert.equal(JSON.parse(requests[0].args.body).text,'Entre na conta');
});

test('dois consumidores concorrentes não enviam a mesma linha simultaneamente',async()=>{
 await service.criar([aux.id],{tipo:'aviso',titulo:'Concorrência',mensagem:'Texto'});
 let sent=0;const transport={sendMail:async()=>{sent++;await new Promise(r=>setTimeout(r,20));}};
 const config={from:'avisos@teste.local',url:'https://rally.example/#/notificacoes'};
 await Promise.all([worker.processarFila({config,transport}),worker.processarFila({config,transport})]);assert.equal(sent,1);
});
test('configuração recusa origem com credenciais e permanece desligada por padrão',()=>{
 const keys=['NOTIFICATIONS_EMAIL_ENABLED','MAIL_FROM','RESEND_API_KEY','APP_URL','SMTP_HOST'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  delete process.env.NOTIFICATIONS_EMAIL_ENABLED;assert.equal(worker.configuracao(),null);
  process.env.NOTIFICATIONS_EMAIL_ENABLED='true';process.env.MAIL_FROM='avisos@teste.local';process.env.RESEND_API_KEY='chave-falsa';process.env.APP_URL='https://segredo@rally.example';assert.equal(worker.configuracao(),null);
  process.env.APP_URL='https://rally.example';assert.equal(worker.configuracao().provider,'resend');
 }finally{for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('contador do sino retorna apenas a quantidade própria sem baixar mensagens',async()=>{
 const u=await db('usuarios').where({papel:'admin'}).first();
 const lista=await service.listar(u.id);
 assert.deepEqual(await service.contar(u.id),{nao_lidas:lista.nao_lidas});
});
