const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database/connection');
const usuarioRepo = require('../repositories/usuarioRepo');
const pessoaRepo = require('../repositories/pessoaRepo');
const auditoria = require('../repositories/auditoriaRepo');
const { JWT_ISSUER, JWT_AUDIENCE } = require('../middlewares/auth');
const { naoAutenticado, requisicaoInvalida, conflito, naoEncontrado } = require('../utils/http');
const { agora } = require('../utils/db');
const HASH_FALSO = bcrypt.hashSync('comparacao-interna-sem-conta-para-login', 12);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function emitirSessao(usuarioId) {
  const usuario=await usuarioRepo.porId(usuarioId);
  const pessoa=usuario?.pessoa_id?await pessoaRepo.obter(usuario.pessoa_id):null;
  if(!usuario?.ativo||!pessoa||!pessoa.ativo||pessoa.excluido_em)throw naoAutenticado('Acesso indisponível. Fale com a coordenação.');
  await usuarioRepo.atualizar(usuario.id,{ultimo_login:agora()});
  const token=jwt.sign({av:Number(usuario.auth_versao||0)},config.jwtSecret,{algorithm:'HS256',subject:String(usuario.id),issuer:JWT_ISSUER,audience:JWT_AUDIENCE,expiresIn:'12h'});
  return {token,usuario:await perfil(usuario.id)};
}
async function login(email, senha) {
  const valorEmail=String(email||'').trim().toLowerCase();const valorSenha=String(senha||'');
  if(valorEmail.length>254||valorSenha.length>1024)throw naoAutenticado('E-mail ou senha incorretos.');
  const usuario=await usuarioRepo.porEmail(valorEmail);
  const correta=await bcrypt.compare(valorSenha,usuario?.senha_hash||HASH_FALSO);
  if(!usuario||!usuario.ativo||!correta)throw naoAutenticado('E-mail ou senha incorretos.');
  try { return await emitirSessao(usuario.id); } catch (err) { if(err.status===401)throw naoAutenticado('E-mail ou senha incorretos.');throw err; }
}
async function perfil(usuarioId) {
  const u=await usuarioRepo.porId(usuarioId);if(!u)throw naoAutenticado();
  const pessoa=u.pessoa_id?await pessoaRepo.obter(u.pessoa_id):null;
  return {id:u.id,email:u.email,papel:u.papel,admin:u.papel==='admin',pessoa_id:u.pessoa_id,nome:pessoa?pessoa.apelido||pessoa.nome_completo:u.email};
}
function validarSenha(senha) {
  if(typeof senha!=='string'||senha.length<12||Buffer.byteLength(senha,'utf8')>72)throw requisicaoInvalida('A senha precisa ter pelo menos 12 caracteres e no máximo 72 bytes.');
}
async function revogarSessoes(usuarioId,trx=db,versaoEsperada){const q=trx('usuarios').where({id:usuarioId});if(Number.isSafeInteger(versaoEsperada))q.where({auth_versao:versaoEsperada});await q.increment('auth_versao',1);}
async function trocarSenha(usuarioId,senhaAtual,novaSenha){
 const u=await usuarioRepo.porId(usuarioId);if(!u||!(await bcrypt.compare(String(senhaAtual||''),u.senha_hash)))throw requisicaoInvalida('Senha atual incorreta.');
 validarSenha(novaSenha);
 await db.transaction(async trx=>{await usuarioRepo.atualizar(usuarioId,{senha_hash:await bcrypt.hash(novaSenha,12)},trx);await revogarSessoes(usuarioId,trx);await auditoria.registrar({entidade:'usuarios',entidadeId:usuarioId,acao:'trocar_senha',usuarioId,antes:null,depois:{senha_alterada:true}},trx);});
}
async function definirAcesso(pessoaId,{email,senha,papel,ativo},atorId){
 const pessoa=await pessoaRepo.obter(pessoaId);if(!pessoa||pessoa.excluido_em)throw naoEncontrado('Pessoa não encontrada.');
 if(papel!==undefined&&!['admin','membro'].includes(papel))throw requisicaoInvalida('Papel inválido.');
 if(ativo!==undefined&&typeof ativo!=='boolean')throw requisicaoInvalida('Ativo deve ser verdadeiro ou falso.');
 const endereco=email===undefined?undefined:String(email).trim().toLowerCase();
 if(endereco!==undefined&&(!EMAIL.test(endereco)||endereco.length>254))throw requisicaoInvalida('Informe um e-mail válido.');
 return db.transaction(async trx=>{
  // Serializa mudanças dos administradores e impede remover o último acesso administrativo.
  await trx('usuarios').where({papel:'admin',ativo:true}).select('id').forUpdate();
  const admins=await trx('usuarios as u').join('pessoas as p','p.id','u.pessoa_id').where({'u.papel':'admin','u.ativo':true,'p.ativo':true}).whereNull('p.excluido_em').select('u.id');
  const existente=await usuarioRepo.porPessoa(pessoaId,trx);
  if(endereco){const dono=await usuarioRepo.porEmail(endereco,trx);if(dono&&dono.id!==existente?.id)throw conflito('Este e-mail já está em uso.');}
  if(existente&&(ativo===false||(papel&&papel!=='admin'))){
   if(Number(atorId)===existente.id)throw conflito('Você não pode desativar ou remover seu próprio acesso administrativo.');
   if(existente.papel==='admin'&&existente.ativo&&admins.length<=1)throw conflito('O último administrador ativo deve ser preservado.');
  }
  if(!existente){
   if(!endereco)throw requisicaoInvalida('Informe o e-mail.');validarSenha(senha);
   await usuarioRepo.criar({pessoa_id:pessoaId,email:endereco,senha_hash:await bcrypt.hash(senha,12),papel:papel||'membro',ativo:ativo===undefined?true:ativo},trx);
  }else{
   const dados={};if(endereco!==undefined)dados.email=endereco;if(papel)dados.papel=papel;if(ativo!==undefined)dados.ativo=ativo;
   if(senha){validarSenha(senha);dados.senha_hash=await bcrypt.hash(senha,12);}
   if(Object.keys(dados).length){await usuarioRepo.atualizar(existente.id,dados,trx);await revogarSessoes(existente.id,trx);}
  }
  const u=await usuarioRepo.porPessoa(pessoaId,trx);await auditoria.registrar({entidade:'usuarios',entidadeId:u.id,acao:existente?'alterar_acesso':'criar_acesso',usuarioId:atorId||u.id,antes:null,depois:{campos_alterados:[...(endereco!==undefined?['email']:[]),...(senha?['senha']:[]),...(papel?['papel']:[]),...(ativo!==undefined?['ativo']:[])]}},trx);return {id:u.id,email:u.email,papel:u.papel,ativo:u.ativo};
 });
}
module.exports={login,perfil,trocarSenha,definirAcesso,emitirSessao,revogarSessoes,validarSenha};
