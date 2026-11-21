const db = require('../database/connection');
const { inserir, agora } = require('../utils/db');
const { requisicaoInvalida, proibido, naoEncontrado } = require('../utils/http');
const auditoria = require('../repositories/auditoriaRepo');
function usuariosAtivos(trx=db) {
  return trx('usuarios as u').join('pessoas as p','p.id','u.pessoa_id').where({'u.ativo':true,'p.ativo':true}).whereNull('p.excluido_em');
}
const admins = async(trx=db) => (await usuariosAtivos(trx).where('u.papel','admin').select('u.id')).map(x=>x.id);
async function audiencia(rallyId, tribos=[], trx=db) {
  const all = await admins(trx);
  const rt = await trx('rally_tribos').where({rally_id:rallyId}).modify(q=>{if(tribos.length)q.whereIn('id',tribos);});
  const pessoas = new Set(rt.flatMap(t=>[t.cabeca_pessoa_id,t.auxiliar_pessoa_id]).filter(Boolean));
  if(rt.length)for(const m of await trx('membros_tribo').whereIn('rally_tribo_id',rt.map(t=>t.id)).where({status:'ativo'}))pessoas.add(m.pessoa_id);
  if(pessoas.size)all.push(...(await usuariosAtivos(trx).whereIn('u.pessoa_id',[...pessoas]).select('u.id')).map(u=>u.id));
  return [...new Set(all)];
}
async function lideres(rallyTriboId, autorId, trx=db) {
  const rt = await trx('rally_tribos').where({id:rallyTriboId}).first();
  const pessoas = [rt?.cabeca_pessoa_id,rt?.auxiliar_pessoa_id].filter(Boolean);
  const usuarios = pessoas.length ? await usuariosAtivos(trx).whereIn('u.pessoa_id',pessoas).select('u.id') : [];
  if(autorId && await usuariosAtivos(trx).where('u.id',autorId).first())usuarios.push({id:autorId});
  return [...new Set(usuarios.map(u=>u.id))];
}
async function criar(ids, {tipo,titulo,mensagem,destino='#/notificacoes'}, trx=db) {
  if(!ids.length)return;
  if(!/^#\/[a-z0-9/?=&_-]*$/i.test(destino))throw requisicaoInvalida('Destino inválido.');
  const users=await usuariosAtivos(trx).whereIn('u.id',[...new Set(ids)]).select('u.id','u.email_notificacoes','p.nome_completo','p.apelido');
  for(const u of users){
    const id=await inserir(trx,'notificacoes',{usuario_id:u.id,tipo,titulo,mensagem:`Olá 👋, ${u.apelido||u.nome_completo}! ${mensagem}`,destino,criado_em:agora()});

  }
}
async function listar(usuarioId, somenteNaoLidas=false) {
  const query=db('notificacoes').where({usuario_id:usuarioId}).orderBy('id','desc').limit(100);
  if(somenteNaoLidas)query.whereNull('lido_em');
  const [itens,total]=await Promise.all([query,db('notificacoes').where({usuario_id:usuarioId}).whereNull('lido_em').count({n:'*'}).first()]);
  return {itens,nao_lidas:Number(total.n)};
}
async function ler(usuarioId,id) {
  const row=await db('notificacoes').where({id,usuario_id:usuarioId}).first();if(!row)throw naoEncontrado('Notificação não encontrada.');
  await db('notificacoes').where({id,usuario_id:usuarioId}).whereNull('lido_em').update({lido_em:agora()});return {ok:true};
}
async function lerTodas(usuarioId){await db('notificacoes').where({usuario_id:usuarioId}).whereNull('lido_em').update({lido_em:agora()});return {ok:true};}
async function preferencias(usuarioId){
 const u=await db('usuarios').where({id:usuarioId}).first();
 const fila=u.papel==='admin'?Object.fromEntries((await db('notificacoes_email').select('status').count({n:'*'}).groupBy('status')).map(x=>[x.status,Number(x.n)])):undefined;
 return {email_notificacoes:Boolean(u.email_notificacoes),email_configurado:Boolean(!process.env.VERCEL&&require('./emailWorker').configuracao()),...(fila?{fila}:{} )};
}
async function atualizarPreferencias(usuarioId,dados){
  if(typeof dados.email_notificacoes!=='boolean')throw requisicaoInvalida('Informe se deseja receber e-mails.');
  await db.transaction(async trx=>{await trx('usuarios').where({id:usuarioId}).update({email_notificacoes:dados.email_notificacoes});
    await auditoria.registrar({entidade:'usuarios',entidadeId:usuarioId,acao:'preferencia_email',usuarioId,depois:{email_notificacoes:dados.email_notificacoes}},trx);
    if(!dados.email_notificacoes)await trx('notificacoes_email').whereIn('notificacao_id',trx('notificacoes').where({usuario_id:usuarioId}).select('id')).whereIn('status',['pendente','falhou']).update({status:'cancelado'});
  });return preferencias(usuarioId);
}
async function contar(usuarioId){return {nao_lidas:Number((await db('notificacoes').where({usuario_id:usuarioId}).whereNull('lido_em').count({n:'*'}).first()).n)};}
async function autorNome(id,trx=db){const row=await trx('usuarios as u').join('pessoas as p','p.id','u.pessoa_id').where('u.id',id).select('p.apelido','p.nome_completo').first();return row?.apelido||row?.nome_completo||'A coordenação';}
module.exports={autorNome,contar,usuariosAtivos,admins,audiencia,lideres,criar,listar,ler,lerTodas,preferencias,atualizarPreferencias};
