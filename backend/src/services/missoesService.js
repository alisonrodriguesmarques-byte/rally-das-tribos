const db = require('../database/connection');
const missaoRepo = require('../repositories/missaoRepo');
const rallyService = require('./rallyService');
const pontuacao = require('./pontuacaoService');
const tribosService = require('./tribosService');
const { exigirLideranca } = require('./acessoService');
const { naoEncontrado, conflito, requisicaoInvalida, proibido } = require('../utils/http');
const { agora } = require('../utils/db');
const { paraData, hoje } = require('../utils/datas');
 
const fmt = (m) => ({ ...m, data_inicio: paraData(m.data_inicio), data_limite: paraData(m.data_limite) });
 
async function listar(rallyId, ctx, filtros = {}) {
  const opcoes = { status: filtros.status };
  if (!ctx.admin) {
    if (!ctx.rallyTriboId) return [];
    opcoes.rallyTriboId = ctx.rallyTriboId;
    opcoes.status = filtros.status || ['aberta', 'encerrada'];
  }
  const [missoes, contagens] = await Promise.all([missaoRepo.listar(rallyId, opcoes), missaoRepo.contagemEntregas(rallyId)]);
  const minhas = !ctx.admin
    ? await missaoRepo.entregas({ 'e.rally_tribo_id': ctx.rallyTriboId, 'm.rally_id': rallyId })
    : [];
  return missoes.map((m) => {
    const c = Object.fromEntries(contagens.filter((x) => x.missao_id === m.id).map((x) => [x.status, Number(x.n)]));
    return {
      ...fmt(m),
      entregas: { enviada: c.enviada || 0, aprovada: c.aprovada || 0, rejeitada: c.rejeitada || 0 },
      minhas_entregas: minhas.filter((e) => e.missao_id === m.id),
    };
  });
}
 
async function obter(id, ctx) {
  const m = await missaoRepo.obter(id);
  if (!m) throw naoEncontrado('Missão não encontrada.');
  const tribos = await missaoRepo.tribosDaMissao(id);
  if (!ctx.admin && !m.todas_tribos && !tribos.includes(ctx.rallyTriboId)) throw proibido();
  const filtro = { 'e.missao_id': id };
  if (!ctx.admin) filtro['e.rally_tribo_id'] = ctx.rallyTriboId || 0;
  return { ...fmt(m), tribos, entregas: await missaoRepo.entregas(filtro) };
}
 
function validarConfig(d) {
  if (['fixa', 'quantidade', 'meta'].includes(d.tipo_pontuacao) && !d.pontos) {
    throw requisicaoInvalida('Informe os pontos da missão.', { pontos: 'Obrigatório para este tipo.' });
  }
  if (d.tipo_pontuacao === 'meta' && !d.meta_quantidade) {
    throw requisicaoInvalida('Informe a meta.', { meta_quantidade: 'Obrigatório para meta.' });
  }
}
 
async function criar(rallyId, dados, usuario) {
  await rallyService.exigirEditavel(rallyId);
  const { tribos = [], ...campos } = dados;
  validarConfig(campos);
  return db.transaction(async (trx) => {
    const id = await missaoRepo.criar({ ...campos, rally_id: rallyId, criado_por: usuario.id, todas_tribos: !tribos.length }, trx);
    await missaoRepo.definirTribos(id, tribos, trx);
    return id;
  });
}
 
async function atualizar(id, dados) {
  const m = await missaoRepo.obter(id);
  if (!m) throw naoEncontrado('Missão não encontrada.');
  await rallyService.exigirEditavel(m.rally_id);
  const { tribos, ...campos } = dados;
  validarConfig({ ...m, ...campos });
  await db.transaction(async (trx) => {
    if (tribos) {
      campos.todas_tribos = !tribos.length;
      await missaoRepo.definirTribos(id, tribos, trx);
    }
    if (Object.keys(campos).length) await missaoRepo.atualizar(id, campos, trx);
  });
}
 
async function aprovarInterno(entrega, missao, ajustes, usuario, trx) {
  const dados = { ...entrega, ...ajustes };
  const pontos = pontuacao.calcularPontosMissao(missao, dados);
  let detalhe = '';
  if (missao.tipo_pontuacao === 'quantidade') detalhe = ` (${dados.quantidade || 0} × ${missao.pontos})`;
  const lancamentoId = await pontuacao.sincronizarLancamento(entrega.lancamento_id, pontos ? {
    rally_id: missao.rally_id,
    rally_tribo_id: entrega.rally_tribo_id,
    categoria_id: missao.categoria_id || await pontuacao.categoriaPadrao('Missões especiais', trx),
    pontos,
    motivo: `Missão: ${missao.titulo}${detalhe}`,
    origem_tipo: 'missao',
    origem_id: entrega.id,
    data_referencia: paraData(entrega.enviado_em) || hoje(),
    motivo_alteracao: 'Entrega reavaliada',
  } : null, usuario, trx);
  await missaoRepo.atualizarEntrega(entrega.id, {
    ...ajustes, status: 'aprovada', avaliado_por: usuario.id, avaliado_em: agora(), lancamento_id: lancamentoId,
  }, trx);
  return pontos;
}
 
async function enviarEntrega(missaoId, dados, usuario, ctx) {
  const missao = await missaoRepo.obter(missaoId);
  if (!missao) throw naoEncontrado('Missão não encontrada.');
  await rallyService.exigirEditavel(missao.rally_id);
  const rallyTriboId = ctx.admin ? dados.rally_tribo_id : ctx.rallyTriboId;
  if (!rallyTriboId) throw requisicaoInvalida('Informe a tribo.');
  exigirLideranca(ctx, rallyTriboId);
  const rt = await tribosService.obterOuFalhar(rallyTriboId);
  if (rt.rally_id !== missao.rally_id) throw requisicaoInvalida('Tribo de outro rally.');
  if (!missao.todas_tribos && !(await missaoRepo.tribosDaMissao(missaoId)).includes(rt.id)) {
    throw requisicaoInvalida('Esta tribo não participa desta missão.');
  }
  if (!ctx.admin && missao.status !== 'aberta') throw conflito('Esta missão não está aberta para envios.');
  if (!ctx.admin && missao.tipo_pontuacao === 'manual') delete dados.pontos_manual;
 
  return db.transaction(async (trx) => {
    const id = await missaoRepo.criarEntrega({
      missao_id: missaoId,
      rally_tribo_id: rt.id,
      quantidade: dados.quantidade ?? null,
      pontos_manual: dados.pontos_manual ?? null,
      evidencia_url: dados.evidencia_url || null,
      observacao: dados.observacao || null,
      enviado_por: usuario.id,
      enviado_em: agora(),
    }, trx);
    const entrega = await missaoRepo.obterEntrega(id, trx);
    const aprovarAgora = ctx.admin ? dados.aprovar !== false
      : !missao.requer_aprovacao && missao.tipo_pontuacao !== 'manual';
    if (aprovarAgora) await aprovarInterno(entrega, missao, {}, usuario, trx);
    return id;
  });
}
 
async function aprovarEntrega(id, ajustes, usuario) {
  const entrega = await missaoRepo.obterEntrega(id);
  if (!entrega) throw naoEncontrado('Entrega não encontrada.');
  const missao = await missaoRepo.obter(entrega.missao_id);
  await rallyService.exigirEditavel(missao.rally_id);
  return db.transaction((trx) => aprovarInterno(entrega, missao, ajustes, usuario, trx));
}
 
async function rejeitarEntrega(id, motivo, usuario) {
  const entrega = await missaoRepo.obterEntrega(id);
  if (!entrega) throw naoEncontrado('Entrega não encontrada.');
  const missao = await missaoRepo.obter(entrega.missao_id);
  await rallyService.exigirEditavel(missao.rally_id);
  await db.transaction(async (trx) => {
    if (entrega.lancamento_id) {
      await pontuacao.cancelarLancamento(entrega.lancamento_id, `Entrega rejeitada: ${motivo || 'sem motivo'}`, usuario, trx);
    }
    await missaoRepo.atualizarEntrega(id, {
      status: 'rejeitada', avaliado_por: usuario.id, avaliado_em: agora(), observacao_admin: motivo || null,
    }, trx);
  });
}
 
async function pendentes(rallyId) {
  return missaoRepo.entregas({ 'm.rally_id': rallyId, 'e.status': 'enviada' });
}
 
module.exports = { listar, obter, criar, atualizar, enviarEntrega, aprovarEntrega, rejeitarEntrega, pendentes };
