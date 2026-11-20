const db = require('../database/connection');
const pessoaRepo = require('../repositories/pessoaRepo');
const lancamentoRepo = require('../repositories/lancamentoRepo');
const usuarioRepo = require('../repositories/usuarioRepo');
const auditoria = require('../repositories/auditoriaRepo');
const tribosService = require('./tribosService');
const { naoEncontrado, conflito, proibido } = require('../utils/http');
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
    if (dados.ativo === false) {
      await protegerAdministrador(id, usuario, trx);
      await trx('usuarios').where({pessoa_id:id}).increment('auth_versao',1);
    }
    await pessoaRepo.atualizar(id, { ...dados, atualizado_em: agora() }, trx);
    const mudou = Object.fromEntries(Object.keys(dados).filter((k) => antes[k] !== dados[k]).map((k) => [k, antes[k]]));
    if (Object.keys(mudou).length) {
      await auditoria.registrar({ entidade: 'pessoas', entidadeId: id, acao: 'editar', usuarioId: usuario.id, antes: mudou, depois: dados }, trx);
    }
  });
  return pessoaRepo.obter(id);
}
 
async function obter(id, rallyId) {
  const pessoa = await pessoaRepo.obterIncluindoExcluidas(id);
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
 
async function protegerAdministrador(pessoaId, usuario, trx) {
  const alvo = await trx('usuarios').where({ pessoa_id: pessoaId }).first();
  if (!alvo) return;
  if (alvo.id === usuario.id) throw conflito('Você não pode excluir ou desativar sua própria conta.');
  if (alvo.papel === 'admin' && alvo.ativo) {
    // Serializa a proteção do último administrador em PostgreSQL.
    if (trx.client.config.client === 'pg') await trx('usuarios').where({ papel: 'admin' }).forUpdate().select('id');
    const admins = await trx('usuarios as u').join('pessoas as p','p.id','u.pessoa_id').where({'u.papel':'admin','u.ativo':true,'p.ativo':true}).whereNull('p.excluido_em').count({ n: '*' }).first();
    if (Number(admins.n) <= 1) throw conflito('Não é permitido excluir o último administrador ativo.');
  }
}

async function excluir(id, usuario) {
  if (!usuario?.admin) throw proibido('Apenas administradores podem excluir pessoas.');
  return db.transaction(async trx => {
    const antes = await pessoaRepo.obterIncluindoExcluidas(id, trx);
    if (!antes) throw naoEncontrado('Pessoa não encontrada.');
    if (antes.excluido_em) throw conflito('Esta pessoa já foi excluída.');
    await protegerAdministrador(id, usuario, trx);
    const em = agora();
    await pessoaRepo.atualizar(id, { ativo: false, excluido_em: em, atualizado_em: em }, trx);
    await trx('usuarios').where({ pessoa_id: id }).update({ ativo: false }).increment('auth_versao', 1);
    // Somente vínculos de rallies ainda abertos mudam. O histórico encerrado fica intacto.
    const ralliesAbertos = trx('rallies').whereNot({ status: 'encerrado' }).whereNull('arquivado_em').select('id');
    const tribosAbertas = trx('rally_tribos').whereIn('rally_id', ralliesAbertos).select('id');
    await trx('membros_tribo').where({ pessoa_id: id, status: 'ativo' }).whereIn('rally_tribo_id', tribosAbertas)
      .update({ status: 'inativo', saiu_em: em, motivo_saida: 'cadastro_excluido' });
    for (const campo of ['cabeca_pessoa_id', 'auxiliar_pessoa_id']) {
      await trx('rally_tribos').where({ [campo]: id }).whereIn('rally_id', trx('rallies').whereNot({ status: 'encerrado' }).whereNull('arquivado_em').select('id')).update({ [campo]: null });
    }
    await auditoria.registrar({ entidade: 'pessoas', entidadeId: id, acao: 'excluir', usuarioId: usuario.id,
      antes: { ativo: antes.ativo }, depois: { ativo: false, excluido_em: em, historico_preservado: true } }, trx);
    return { id: Number(id), excluido: true, historico_preservado: true };
  });
}
module.exports = { listar, criar, atualizar, obter, excluir };
