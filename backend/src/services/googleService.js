const {OAuth2Client}=require('google-auth-library');
const bcrypt=require('bcryptjs');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const jwt=require('jsonwebtoken');
const config=require('../config');
const db=require('../database/connection');
const auth=require('./authService');
const auditoria=require('../repositories/auditoriaRepo');
const {HttpError,requisicaoInvalida,naoEncontrado,conflito,proibido}=require('../utils/http');
const {agora}=require('../utils/db');
const STATE_COOKIE='rally_google_state';
function configuracao(){
 const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET,appUrl=process.env.APP_URL;
 if(!clientId||!clientSecret||!appUrl||!config.jwtSecret)throw new HttpError(503,'Login Google ainda não configurado. Use seu e-mail e senha.');
 let url;try{url=new URL(appUrl);}catch{throw new HttpError(503,'APP_URL inválida.');}
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(config.env!=='production'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new HttpError(503,'APP_URL deve ser a origem HTTPS do aplicativo.');
 return {clientId,clientSecret,origin:url.origin,redirectUri:url.origin+'/api/auth/google/callback'};
}
function disponivel(){try{configuracao();return true;}catch{return false;}}
function cliente(){const c=configuracao();return new OAuth2Client(c.clientId,c.clientSecret,c.redirectUri);}
function comparar(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);}
async function iniciar(){
 const oauth=cliente();const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 const challenge=createHash('sha256').update(verifier).digest('base64url');
 const cookie=jwt.sign({state,nonce,verifier},config.jwtSecret,{algorithm:'HS256',issuer:'rally-google-flow',audience:'rally-google-callback',expiresIn:'10m'});
 return {cookie,url:oauth.generateAuthUrl({scope:['openid','email','profile'],state,nonce,code_challenge:challenge,code_challenge_method:'S256',access_type:'online',prompt:'select_account'})};
}
async function identidadeGoogle(code,state,cookie){
 let flow;try{flow=jwt.verify(cookie,config.jwtSecret,{algorithms:['HS256'],issuer:'rally-google-flow',audience:'rally-google-callback'});}catch{throw requisicaoInvalida('Tentativa Google expirada. Tente novamente.');}
 if(!comparar(flow.state,state)||typeof code!=='string'||!code||code.length>4096)throw requisicaoInvalida('Tentativa Google inválida.');
 const c=configuracao(),oauth=cliente();const {tokens}=await oauth.getToken({code,codeVerifier:flow.verifier,redirect_uri:c.redirectUri});
 if(!tokens.id_token)throw requisicaoInvalida('Identificação Google ausente.');
 const ticket=await oauth.verifyIdToken({idToken:tokens.id_token,audience:c.clientId});const p=ticket.getPayload();
 if(!p||p.email_verified!==true||!comparar(p.nonce,flow.nonce)||typeof p.sub!=='string'||!p.sub||p.sub.length>255||typeof p.email!=='string'||p.email.length>254)throw requisicaoInvalida('Conta Google não verificada.');
 return {sub:p.sub,email:p.email.toLowerCase(),nome:String(p.name||p.email).slice(0,200)};
}
async function processarIdentidade(identity){
 // Somente identidade já validada pela biblioteca Google chega aqui.
 const data=await db.transaction(async trx=>{
  const rows=await trx('google_vinculos').insert({google_sub:identity.sub,email:identity.email,nome:identity.nome,status:'pendente',criado_em:agora(),atualizado_em:agora()}).onConflict('google_sub').ignore().returning('id');
  const novo=rows.length>0;
  const vinculo=await trx('google_vinculos').where({google_sub:identity.sub}).first();
  if(novo){
   const notificacoes=require('./notificacoesService');
   await notificacoes.criar(await notificacoes.admins(trx),{tipo:'google_pendente',titulo:'Solicitação de acesso Google',mensagem:'Uma conta Google aguarda aprovação e vínculo.',destino:'#/google-vinculos'},trx);
  }
  return {vinculo,novo};
 });
 const {vinculo,novo}=data;
 if(vinculo.status==='aprovado'&&vinculo.usuario_id){const sessao=await auth.emitirSessao(vinculo.usuario_id);return {status:'aprovado',...sessao};}
 return {status:vinculo.status==='rejeitado'?'rejeitado':'pendente',novoPedido:novo,vinculoId:vinculo.id};
}
async function concluir(code,state,cookie){return processarIdentidade(await identidadeGoogle(code,state,cookie));}
async function listar(){
 const vinculos=await db('google_vinculos as g').leftJoin('usuarios as u','u.id','g.usuario_id').leftJoin('pessoas as p','p.id','u.pessoa_id').select('g.id','g.email','g.nome','g.status','g.usuario_id','g.criado_em','g.atualizado_em','u.email as conta_email','p.nome_completo as pessoa_nome').orderBy('g.criado_em','desc');
 const contas=await db('usuarios as u').join('pessoas as p','p.id','u.pessoa_id').where({'u.ativo':true,'p.ativo':true}).whereNull('p.excluido_em').select('u.id','u.email','u.papel','p.nome_completo').orderBy('p.nome_completo');return {vinculos,contas};
}
async function aprovar(id,usuarioId,atorId,senhaAdminAtual){
 if(!Number.isSafeInteger(usuarioId)||usuarioId<1)throw requisicaoInvalida('Selecione uma conta existente.');
 return db.transaction(async trx=>{
  const conta=await trx('usuarios as u').join('pessoas as p','p.id','u.pessoa_id').where({'u.id':usuarioId,'u.ativo':true,'p.ativo':true}).whereNull('p.excluido_em').select('u.id','u.papel').first().forUpdate();
  if(!conta)throw requisicaoInvalida('Conta indisponível. Crie ou ative a conta da pessoa antes de vincular.');
  if(conta.papel==='admin'){
   const ator=await trx('usuarios').where({id:atorId,papel:'admin',ativo:true}).first();
   if(!ator||typeof senhaAdminAtual!=='string'||senhaAdminAtual.length>1024||!await bcrypt.compare(senhaAdminAtual,ator.senha_hash))throw proibido('Para vincular uma conta administrativa, confirme sua própria senha atual de administrador.');
  }
  const g=await trx('google_vinculos').where({id}).first().forUpdate();if(!g)throw naoEncontrado();
  if(g.status==='aprovado')throw conflito('Esta solicitação já foi avaliada.');
  if(await trx('google_vinculos').where({usuario_id:usuarioId}).whereNot({id}).first())throw conflito('Esta conta já possui um vínculo Google. Desvincule antes de substituir.');
  await trx('google_vinculos').where({id}).update({usuario_id:usuarioId,status:'aprovado',aprovado_por:atorId,atualizado_em:agora()});
  await auth.revogarSessoes(usuarioId,trx);
  await auditoria.registrar({entidade:'google_vinculos',entidadeId:id,acao:'aprovar_google',usuarioId:atorId,antes:{status:g.status},depois:{status:'aprovado',usuario_id:usuarioId}},trx);
  return {ok:true};
 });
}
async function rejeitar(id,atorId){return db.transaction(async trx=>{
 const g=await trx('google_vinculos').where({id}).first().forUpdate();if(!g)throw naoEncontrado();if(g.status!=='pendente')throw conflito('Esta solicitação já foi avaliada.');
 await trx('google_vinculos').where({id}).update({status:'rejeitado',usuario_id:null,aprovado_por:atorId,atualizado_em:agora()});
 await auditoria.registrar({entidade:'google_vinculos',entidadeId:id,acao:'rejeitar_google',usuarioId:atorId,antes:{status:g.status},depois:{status:'rejeitado'}},trx);return {ok:true};
});}
async function desvincular(id,atorId){return db.transaction(async trx=>{
 const g=await trx('google_vinculos').where({id}).first().forUpdate();if(!g)throw naoEncontrado();if(g.status!=='aprovado')throw conflito('Esta conta não está vinculada.');
 await trx('google_vinculos').where({id}).update({status:'pendente',usuario_id:null,aprovado_por:atorId,atualizado_em:agora()});
 if(g.usuario_id)await auth.revogarSessoes(g.usuario_id,trx);
 await auditoria.registrar({entidade:'google_vinculos',entidadeId:id,acao:'desvincular_google',usuarioId:atorId,antes:{status:g.status,usuario_id:g.usuario_id},depois:{status:'pendente'}},trx);return {ok:true};
});}
module.exports={STATE_COOKIE,configuracao,disponivel,iniciar,concluir,listar,aprovar,rejeitar,desvincular,processarIdentidade,identidadeGoogle};
