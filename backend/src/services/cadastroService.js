const db=require('../database/connection'),bcrypt=require('bcryptjs'),{randomBytes}=require('crypto');
const {inserir,agora}=require('../utils/db'),{requisicaoInvalida,conflito,naoEncontrado}=require('../utils/http');
const auth=require('./authService'),notificacoes=require('./notificacoesService'),auditoria=require('../repositories/auditoriaRepo');
async function solicitar(d){
 const nome=typeof d.nome==='string'?d.nome.trim():'',email=typeof d.email==='string'?d.email.trim().toLowerCase():'';
 if(!nome||nome.length>150||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw requisicaoInvalida('Informe nome e e-mail válidos.');auth.validarSenha(d.senha);
 const senha_hash=await bcrypt.hash(d.senha,12);
 await db.transaction(async trx=>{
  if(await trx('usuarios').whereRaw('LOWER(email)=?',[email]).first())return;
  const rows=await trx('cadastros_pendentes').insert({nome,email,senha_hash}).onConflict('email').ignore().returning('id');
  if(rows.length)await notificacoes.criar(await notificacoes.admins(trx),{tipo:'cadastro_pendente',titulo:'Novo cadastro para validar',mensagem:'Uma pessoa solicitou uma conta. Confira os dados antes de aprovar.',destino:'#/cadastros'},trx);
 });return {ok:true,mensagem:'Solicitação recebida. Aguarde a validação do administrador. Se já possui conta, use Entrar ou procure a coordenação.'};
}
async function listar(){return {pedidos:await db('cadastros_pendentes').select('id','nome','email','status','criado_em').orderBy('id','desc'),pessoas:await db('pessoas as p').leftJoin('usuarios as u','u.pessoa_id','p.id').whereNull('u.id').whereNull('p.excluido_em').where('p.ativo',true).select('p.id','p.nome_completo')};}
async function criarConta(trx,{email,nome,senha_hash,pessoa_id}){
 if(await trx('usuarios').whereRaw('LOWER(email)=?',[email]).first())throw conflito('Este e-mail já possui uma conta. Não será substituída.');
 let pid=pessoa_id;
 if(pid){if(!Number.isSafeInteger(pid)||!(await trx('pessoas').where({id:pid,ativo:true}).whereNull('excluido_em').first().forUpdate()))throw requisicaoInvalida('Pessoa indisponível.');if(await trx('usuarios').where({pessoa_id:pid}).first())throw conflito('A pessoa já possui conta.');}
 else pid=await inserir(trx,'pessoas',{nome_completo:nome});
 return inserir(trx,'usuarios',{pessoa_id:pid,email,senha_hash,papel:'membro',ativo:true});
}
async function aprovar(id,dados,ator){return db.transaction(async trx=>{
 const p=await trx('cadastros_pendentes').where({id}).first().forUpdate();if(!p)throw naoEncontrado();if(p.status!=='pendente')throw conflito('Solicitação já avaliada.');
 const uid=await criarConta(trx,{...p,pessoa_id:dados.pessoa_id});await trx('cadastros_pendentes').where({id}).update({status:'aprovado',senha_hash:null,usuario_id:uid,avaliado_por:ator,avaliado_em:agora()});
 await auditoria.registrar({entidade:'cadastros_pendentes',entidadeId:id,acao:'aprovar_cadastro',usuarioId:ator,depois:{usuario_id:uid}},trx);return {ok:true};
});}
async function rejeitar(id,ator){return db.transaction(async trx=>{const p=await trx('cadastros_pendentes').where({id}).first().forUpdate();if(!p)throw naoEncontrado();if(p.status!=='pendente')throw conflito('Solicitação já avaliada.');await trx('cadastros_pendentes').where({id}).update({status:'rejeitado',senha_hash:null,avaliado_por:ator,avaliado_em:agora()});await auditoria.registrar({entidade:'cadastros_pendentes',entidadeId:id,acao:'rejeitar_cadastro',usuarioId:ator},trx);return {ok:true};});}
async function criarGoogle(id,dados,ator){return db.transaction(async trx=>{
 const g=await trx('google_vinculos').where({id}).first().forUpdate();if(!g)throw naoEncontrado();if(g.status==='aprovado')throw conflito('Solicitação já avaliada.');
 const uid=await criarConta(trx,{email:g.email,nome:g.nome||g.email,pessoa_id:dados.pessoa_id,senha_hash:await bcrypt.hash(randomBytes(32).toString('hex'),12)});
 await trx('google_vinculos').where({id}).update({usuario_id:uid,status:'aprovado',aprovado_por:ator,atualizado_em:agora()});await auditoria.registrar({entidade:'google_vinculos',entidadeId:id,acao:'criar_conta_google',usuarioId:ator,depois:{usuario_id:uid}},trx);return {ok:true};
});}
module.exports={solicitar,listar,aprovar,rejeitar,criarGoogle};
