const db = require('../database/connection');
const pessoaRepo = require('../repositories/pessoaRepo');
const lancamentoRepo = require('../repositories/lancamentoRepo');
const usuarioRepo = require('../repositories/usuarioRepo');
const auditoria = require('../repositories/auditoriaRepo');
const tribosService = require('./tribosService');
const { naoEncontrado } = require('../utils/http');
const { agora } = require('../utils/db');
 
const listar = (filtros) => pessoaRepo.listar(filtros);
 
async function criar(dados, usuario) {
  const { rally_tribo_id: rallyTriboId, ...campos } = dados;
  return db.transaction(async (trx) => {
    const id = await pessoaRepo.criar(campos, trx);
    await auditoria.registrar({ entidade: 'pessoas', entidadeId: id, acao: 'criar', usuarioId: usuario.id, depois: campos }, trx);
    if (rallyTriboId) await tribosService.adicionarMembro(rallyTriboId, id, usuario, trx);
    return pessoaRepo.obter(id, trx);
  });
}
 
async function atualizar(id, dados, usuario) {
  const antes = await pessoaRepo.obter(id);
  if (!antes) throw naoEncontrado('Pessoa não encontrada.');
  await db.transaction(async (trx) => {
    await pessoaRepo.atualizar(id, { ...dados, atualizado_em: agora() }, trx);
    const mudou = Object.fromEntries(Object.keys(dados).filter((k) => antes[k] !== dados[k]).map((k) => [k, antes[k]]));
    if (Object.keys(mudou).length) {
      await auditoria.registrar({ entidade: 'pessoas', entidadeId: id, acao: 'editar', usuarioId: usuario.id, antes: mudou, depois: dados }, trx);
    }
  });
  return pessoaRepo.obter(id);
}
 
async function obter(id, rallyId) {
  const pessoa = await pessoaRepo.obter(id);
  if (!pessoa) throw naoEncontrado('Pessoa não encontrada.');
  const usuario = await usuarioRepo.porPessoa(id);
  const [tribos, liderancas, alteracoes, tentativas] = await Promise.all([
    pessoaRepo.historicoTribos(id),
    pessoaRepo.liderancas(id),
    auditoria.listar('pessoas', [id]),
    db('tentativas as tt')
      .join('provas as p', 'p.id', 'tt.prova_id')
      .select('tt.id', 'tt.status', 'tt.pontos_obtidos', 'tt.finalizada_em', 'p.titulo', 'p.rally_id')
      .where('tt.pessoa_id', id)
      .orderBy('tt.id', 'desc'),
  ]);
  const lancamentos = rallyId ? await lancamentoRepo.listar(rallyId, { pessoa_id: id }) : [];
  return {
    ...pessoa,
    acesso: usuario ? { email: usuario.email, papel: usuario.papel, ativo: usuario.ativo } : null,
    tribos,
    liderancas,
    alteracoes,
    tentativas: rallyId ? tentativas.filter((t) => t.rally_id === Number(rallyId)) : tentativas,
    lancamentos,
  };
}
 
module.exports = { listar, criar, atualizar, obter };
