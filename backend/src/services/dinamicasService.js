const db = require('../database/connection');
const dinamicaRepo = require('../repositories/dinamicaRepo');
const rallyService = require('./rallyService');
const tribosService = require('./tribosService');
const pontuacao = require('./pontuacaoService');
const { exigirLideranca } = require('./acessoService');
const { naoEncontrado, requisicaoInvalida, proibido } = require('../utils/http');
const { paraData, hoje } = require('../utils/datas');
 
const fmt = (d) => d && { ...d, data_encontro: paraData(d.data_encontro) };
 
async function listar(rallyId, ctx, filtros = {}) {
  const opcoes = { status: filtros.status, rallyTriboId: filtros.rally_tribo_id };
  if (!ctx.admin) {
    if (!ctx.rallyTriboId) return [];
    opcoes.rallyTriboId = ctx.rallyTriboId;
  }
  return (await dinamicaRepo.listar(rallyId, opcoes)).map(fmt);
}
 
async function obter(id) {
  const d = await dinamicaRepo.obter(id);
  if (!d) throw naoEncontrado('Dinâmica não encontrada.');
  return fmt(d);
}
 
async function criar(rallyId, dados) {
  await rallyService.exigirEditavel(rallyId);
  const rt = await tribosService.obterOuFalhar(dados.rally_tribo_id);
  if (rt.rally_id !== Number(rallyId)) throw requisicaoInvalida('Tribo de outro rally.');
  return dinamicaRepo.criar({ ...dados, rally_id: rallyId, responsavel_pessoa_id: dados.responsavel_pessoa_id ?? rt.cabeca_pessoa_id });
}
 
const CAMPOS_LIDERANCA = ['descricao', 'tema', 'evidencia_url', 'resultado'];
 
async function atualizar(id, dados, ctx) {
  const d = await obter(id);
  await rallyService.exigirEditavel(d.rally_id);
  if (!ctx.admin) {
    exigirLideranca(ctx, d.rally_tribo_id);
    if (Object.keys(dados).some((k) => !CAMPOS_LIDERANCA.includes(k))) throw proibido('Você só pode editar descrição, tema, evidência e resultado.');
  }
  if (Object.keys(dados).length) await dinamicaRepo.atualizar(id, dados);
  return obter(id);
}
 
/**
 * Muda o status. "realizada" gera (ou ajusta) o lançamento; sair de "realizada"
 * cancela o lançamento. Líderes só podem marcar como "enviada".
 */
async function alterarStatus(id, { status, pontos, resultado, observacao_admin: obs }, usuario, ctx) {
  const d = await obter(id);
  await rallyService.exigirEditavel(d.rally_id);
  if (!ctx.admin) {
    exigirLideranca(ctx, d.rally_tribo_id);
    if (status !== 'enviada') throw proibido('Líderes só podem marcar a dinâmica como enviada.');
  }
  return db.transaction(async (trx) => {
    const valor = pontos ?? d.pontos_previstos ?? 0;
    let lancamentoId = d.lancamento_id;
    if (status === 'realizada') {
      lancamentoId = await pontuacao.sincronizarLancamento(d.lancamento_id, valor ? {
        rally_id: d.rally_id,
        rally_tribo_id: d.rally_tribo_id,
        categoria_id: d.categoria_id || await pontuacao.categoriaPadrao('Dinâmica', trx),
        pessoa_id: d.responsavel_pessoa_id,
        pontos: valor,
        motivo: `Dinâmica: ${d.titulo}`,
        origem_tipo: 'dinamica',
        origem_id: d.id,
        data_referencia: d.data_encontro || hoje(),
        motivo_alteracao: 'Pontuação da dinâmica ajustada',
      } : null, usuario, trx);
    } else if (d.lancamento_id) {
      await pontuacao.sincronizarLancamento(d.lancamento_id, null, usuario, trx);
    }
    const dados = { status, lancamento_id: lancamentoId };
    if (resultado !== undefined) dados.resultado = resultado;
    if (obs !== undefined && ctx.admin) dados.observacao_admin = obs;
    await dinamicaRepo.atualizar(id, dados, trx);
    return fmt(await dinamicaRepo.obter(id, trx));
  });
}
 
module.exports = { listar, obter, criar, atualizar, alterarStatus };
