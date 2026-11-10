const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database/connection');
const usuarioRepo = require('../repositories/usuarioRepo');
const pessoaRepo = require('../repositories/pessoaRepo');
const { naoAutenticado, requisicaoInvalida, conflito, naoEncontrado } = require('../utils/http');
const { agora } = require('../utils/db');
 
async function login(email, senha) {
  const usuario = await usuarioRepo.porEmail(String(email || '').trim());
  if (!usuario || !usuario.ativo || !(await bcrypt.compare(String(senha || ''), usuario.senha_hash))) {
    throw naoAutenticado('E-mail ou senha incorretos.');
  }
  await usuarioRepo.atualizar(usuario.id, { ultimo_login: agora() });
  const token = jwt.sign({ sub: usuario.id, papel: usuario.papel }, config.jwtSecret, { expiresIn: config.jwtExpiracao });
  return { token, usuario: await perfil(usuario.id) };
}
 
async function perfil(usuarioId) {
  const u = await usuarioRepo.porId(usuarioId);
  const pessoa = u.pessoa_id ? await pessoaRepo.obter(u.pessoa_id) : null;
  return {
    id: u.id,
    email: u.email,
    papel: u.papel,
    admin: u.papel === 'admin',
    pessoa_id: u.pessoa_id,
    nome: pessoa ? pessoa.apelido || pessoa.nome_completo : u.email,
  };
}
 
function validarSenha(senha) {
  if (!senha || String(senha).length < 6) throw requisicaoInvalida('A senha precisa ter pelo menos 6 caracteres.');
}
 
async function trocarSenha(usuarioId, senhaAtual, novaSenha) {
  const u = await usuarioRepo.porId(usuarioId);
  if (!(await bcrypt.compare(String(senhaAtual || ''), u.senha_hash))) throw requisicaoInvalida('Senha atual incorreta.');
  validarSenha(novaSenha);
  await usuarioRepo.atualizar(usuarioId, { senha_hash: await bcrypt.hash(novaSenha, 10) });
}
 
/** Cria ou atualiza o login de uma pessoa (somente admin). */
async function definirAcesso(pessoaId, { email, senha, papel, ativo }) {
  const pessoa = await pessoaRepo.obter(pessoaId);
  if (!pessoa) throw naoEncontrado('Pessoa não encontrada.');
  const existente = await usuarioRepo.porPessoa(pessoaId);
  return db.transaction(async (trx) => {
    if (email) {
      const dono = await usuarioRepo.porEmail(email, trx);
      if (dono && dono.id !== existente?.id) throw conflito('Este e-mail já está em uso.');
    }
    if (!existente) {
      if (!email) throw requisicaoInvalida('Informe o e-mail.');
      validarSenha(senha);
      await usuarioRepo.criar({
        pessoa_id: pessoaId, email: email.trim(), senha_hash: await bcrypt.hash(senha, 10), papel: papel || 'membro',
      }, trx);
    } else {
      const dados = {};
      if (email) dados.email = email.trim();
      if (papel) dados.papel = papel;
      if (ativo !== undefined) dados.ativo = ativo;
      if (senha) {
        validarSenha(senha);
        dados.senha_hash = await bcrypt.hash(senha, 10);
      }
      if (Object.keys(dados).length) await usuarioRepo.atualizar(existente.id, dados, trx);
    }
    const u = await usuarioRepo.porPessoa(pessoaId, trx);
    return { id: u.id, email: u.email, papel: u.papel, ativo: u.ativo };
  });
}
 
module.exports = { login, perfil, trocarSenha, definirAcesso };
