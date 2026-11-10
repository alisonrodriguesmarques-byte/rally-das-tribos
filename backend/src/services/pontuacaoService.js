const db = require('../database/connection');
const lancamentoRepo = require('../repositories/lancamentoRepo');
const triboRepo = require('../repositories/triboRepo');
const categoriaRepo = require('../repositories/categoriaRepo');
const rallyService = require('./rallyService');
const { naoEncontrado, requisicaoInvalida, conflito } = require('../utils/http');
const { agora } = require('../utils/db');
const { hoje, paraData } = require('../utils/datas');
 
/**
 * Único ponto de entrada para criar/editar/cancelar pontos.
 * Toda operação grava uma linha em lancamentos_historico na mesma transação.
 */
async function criarLancamento(dados, usuario, trx = null) {
  const executar = async (t) => {
    await rallyService.exigirEditavel(dados.rally_id, t);
    const rt = await triboRepo.obter(dados.rally_tribo_id, t);
    if (!rt || rt.rally_id !== Number(dados.rally_id)) throw requisicaoInvalida('Tribo inválida para este rally.');
    if (!Number.isInteger(dados.pontos)) throw requisicaoInvalida('Pontos devem ser um número inteiro.');
    const id = await lancamentoRepo.criar({
      rally_id: dados.rally_id,
      rally_tribo_id: dados.rally_tribo_id,
      categoria_id: dados.categoria_id || null,
      pessoa_id: dados.pessoa_id || null,
      pontos: dados.pontos,
      motivo: dados.motivo,
      origem_tipo: dados.origem_tipo || 'manual',
      origem_id: dados.origem_id || null,
      data_referencia: dados.data_referencia || hoje(),
      criado_por: usuario.id,
      criado_em: agora(),
    }, t);
    await lancamentoRepo.registrarHistorico({
      lancamento_id: id, acao: 'criacao', pontos_novos: dados.pontos, motivo: dados.motivo, usuario_id: usuario.id, em: agora(),
    }, t);
    return id;
  };
  return trx ? executar(trx) : db.transaction(executar);
}
 
async function editarLancamento(id, dados, usuario, trx = null) {
  const executar = async (t) => {
    const atual = await lancamentoRepo.obter(id, t);
    if (!atual) throw naoEncontrado('Lançamento não encontrado.');
    if (atual.status !== 'ativo') throw conflito('Lançamento cancelado não pode ser editado.');
    await rallyService.exigirEditavel(atual.rally_id, t);
    const { motivo_alteracao: motivoAlteracao, ...campos } = dados;
    if (!motivoAlteracao) throw requisicaoInvalida('Informe o motivo da alteração.');
    await lancamentoRepo.atualizar(id, campos, t);
    await lancamentoRepo.registrarHistorico({
      lancamento_id: id,
      acao: 'edicao',
      pontos_anteriores: atual.pontos,
      pontos_novos: campos.pontos ?? atual.pontos,
      motivo: motivoAlteracao,
      usuario_id: usuario.id,
      em: agora(),
    }, t);
  };
  return trx ? executar(trx) : db.transaction(executar);
}
 
async function cancelarLancamento(id, motivo, usuario, trx = null) {
  const executar = async (t) => {
    const atual = await lancamentoRepo.obter(id, t);
    if (!atual) throw naoEncontrado('Lançamento não encontrado.');
    if (atual.status === 'cancelado') return;
    await rallyService.exigirEditavel(atual.rally_id, t);
    if (!motivo) throw requisicaoInvalida('Informe o motivo do cancelamento.');
    await lancamentoRepo.atualizar(id, {
      status: 'cancelado', cancelado_por: usuario.id, cancelado_em: agora(), motivo_cancelamento: motivo,
    }, t);
    await lancamentoRepo.registrarHistorico({
      lancamento_id: id, acao: 'cancelamento', pontos_anteriores: atual.pontos, pontos_novos: 0, motivo, usuario_id: usuario.id, em: agora(),
    }, t);
  };
  return trx ? executar(trx) : db.transaction(executar);
}
 
/**
 * Mantém um lançamento automático sincronizado com sua origem:
 * cria, ajusta o valor (com histórico) ou cancela, conforme necessário.
 */
async function sincronizarLancamento(lancamentoId, dados, usuario, trx) {
  const atual = lancamentoId ? await lancamentoRepo.obter(lancamentoId, trx) : null;
  if (dados === null) {
    if (atual && atual.status === 'ativo') await cancelarLancamento(atual.id, 'Origem desfeita ou recalculada', usuario, trx);
    return atual ? atual.id : null;
  }
  if (atual && atual.status === 'ativo') {
    if (atual.pontos !== dados.pontos) {
      await editarLancamento(atual.id, { pontos: dados.pontos, motivo: dados.motivo, motivo_alteracao: dados.motivo_alteracao || 'Recálculo automático' }, usuario, trx);
    }
    return atual.id;
  }
  return criarLancamento(dados, usuario, trx);
}
 
/** Calcula pontos de uma entrega conforme o tipo de pontuação da missão. */
function calcularPontosMissao(missao, entrega) {
  const pontos = Number(missao.pontos) || 0;
  const qtd = Number(entrega.quantidade) || 0;
  switch (missao.tipo_pontuacao) {
    case 'fixa':
      return pontos;
    case 'quantidade': {
      const limite = missao.limite_por_tribo ? Number(missao.limite_por_tribo) : Infinity;
      return Math.min(qtd, limite) * pontos;
    }
    case 'meta':
      return qtd >= (Number(missao.meta_quantidade) || 0) ? pontos : 0;
    case 'manual':
      return Number(entrega.pontos_manual) || 0;
    default:
      return 0;
  }
}
 
async function categoriaPadrao(nome, trx = db) {
  const c = await categoriaRepo.porNome(nome, trx);
  return c ? c.id : null;
}
 
async function listar(rallyId, filtros) {
  const lista = await lancamentoRepo.listar(rallyId, filtros);
  return lista.map((l) => ({ ...l, data_referencia: paraData(l.data_referencia) }));
}
 
module.exports = {
  criarLancamento, editarLancamento, cancelarLancamento, sincronizarLancamento,
  calcularPontosMissao, categoriaPadrao, listar, historico: lancamentoRepo.historico,
};
