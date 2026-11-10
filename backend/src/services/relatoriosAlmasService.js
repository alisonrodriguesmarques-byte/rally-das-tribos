const db = require('../database/connection');
const rallyService = require('./rallyService');
const { exigirLideranca } = require('./acessoService');
const { requisicaoInvalida, conflito, naoEncontrado, proibido } = require('../utils/http');
const { inserir, agora } = require('../utils/db');
const { paraData } = require('../utils/datas');
const auditoria = require('../repositories/auditoriaRepo');
const authService = require('./authService');
const DIAS = ['segunda', 'quarta', 'quinta', 'sexta', 'sabado'];
const NOMES = ['Segunda-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
function semana(valor) {
  const d = new Date(`${valor}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor)) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor || d.getUTCDay() !== 1) throw requisicaoInvalida('Escolha uma segunda-feira como início da semana.');
  d.setUTCDate(d.getUTCDate() + 6);
  return { inicio: valor, fim: d.toISOString().slice(0, 10) };
}
function validarDias(dias) {
  if (!Array.isArray(dias) || dias.length !== DIAS.length || new Set(dias.map((d) => d?.dia)).size !== DIAS.length) throw requisicaoInvalida('Informe as cinco reuniões da semana.');
  return DIAS.map((dia) => {
    const item = dias.find((d) => d?.dia === dia);
    if (!item || !['novas', 'afastadas'].every((k) => Number.isSafeInteger(item[k]) && item[k] >= 0 && item[k] <= 1000000)) throw requisicaoInvalida('As quantidades devem ser números inteiros de zero a 1.000.000.');
    return { dia, novas: item.novas, afastadas: item.afastadas };
  });
}
const formatar = (r) => ({ ...r, semana_inicio: paraData(r.semana_inicio), semana_fim: paraData(r.semana_fim), dias: JSON.parse(r.dias_json), dias_json: undefined, total: r.novas + r.afastadas });
function consulta(trx = db) {
  return trx('relatorios_almas as r').join('rally_tribos as rt', 'rt.id', 'r.rally_tribo_id').join('tribos as t', 't.id', 'rt.tribo_id').select('r.*', 't.nome as tribo_nome', 't.cor as tribo_cor').orderBy('t.ordem');
}
async function listar(rallyId, ctx, inicio) {
  await rallyService.obter(rallyId);
  if (!ctx.admin) exigirLideranca(ctx, ctx.rallyTriboId);
  const q = consulta().where('r.rally_id', rallyId).where('r.semana_inicio', semana(inicio).inicio);
  if (!ctx.admin) q.where('r.rally_tribo_id', ctx.rallyTriboId);
  const relatorios = (await q).map(formatar);
  if (!ctx.admin) return { relatorios };
  const enviados = relatorios.filter((r) => r.status !== 'rascunho');
  const tribos = await db('rally_tribos as rt').join('tribos as t', 't.id', 'rt.tribo_id').where('rt.rally_id', rallyId).select('rt.id', 't.nome').orderBy('t.ordem');
  return { relatorios, resumo: {
    novas: enviados.reduce((s, r) => s + r.novas, 0), afastadas: enviados.reduce((s, r) => s + r.afastadas, 0), total: enviados.reduce((s, r) => s + r.total, 0),
    enviados: enviados.length, conferidos: enviados.filter((r) => r.status === 'conferido').length,
    pendentes: tribos.filter((t) => !enviados.some((r) => r.rally_tribo_id === t.id)),
  } };
}
async function salvar(rallyId, dados, ctx, usuario) {
  const rally = await rallyService.exigirEditavel(rallyId);
  const triboId = ctx.admin ? Number(dados.rally_tribo_id) : ctx.rallyTriboId;
  exigirLideranca(ctx, triboId);
  if (!(await db('rally_tribos').where({ id: triboId, rally_id: rallyId }).first())) throw requisicaoInvalida('Tribo inválida para este rally.');
  const periodo = semana(dados.semana_inicio);
  if (periodo.fim < paraData(rally.data_inicio) || periodo.inicio > paraData(rally.data_fim)) throw requisicaoInvalida('A semana precisa pertencer ao período do rally.');
  const dias = validarDias(dados.dias);
  if (!['rascunho', 'enviar'].includes(dados.acao)) throw requisicaoInvalida('Escolha salvar rascunho ou enviar.');
  const nome = (await authService.perfil(usuario.id)).nome;
  return db.transaction(async (trx) => {
    const chave = { rally_tribo_id: triboId, semana_inicio: periodo.inicio };
    const anterior = await trx('relatorios_almas').where(chave).first();
    if (anterior && anterior.status !== 'rascunho') throw conflito('Relatório já enviado. Peça ao administrador para devolver para correção.');
    const valores = { ...chave, rally_id: rallyId, semana_fim: periodo.fim, dias_json: JSON.stringify(dias), novas: dias.reduce((s, d) => s + d.novas, 0), afastadas: dias.reduce((s, d) => s + d.afastadas, 0),
      status: dados.acao === 'enviar' ? 'enviado' : 'rascunho', responsavel_id: usuario.id, responsavel_nome: nome, atualizado_em: agora(), enviado_em: dados.acao === 'enviar' ? agora() : null, avaliado_por: null, avaliado_em: null };
    const id = anterior?.id || await inserir(trx, 'relatorios_almas', valores);
    if (anterior) await trx('relatorios_almas').where({ id }).update(valores);
    await auditoria.registrar({ entidade: 'relatorios_almas', entidadeId: id, acao: valores.status === 'enviado' ? 'enviar' : 'salvar_rascunho', usuarioId: usuario.id, antes: anterior, depois: valores }, trx);
    return formatar(await consulta(trx).where('r.id', id).first());
  });
}
async function avaliar(id, dados, usuario) {
  if (!usuario.admin) throw proibido();
  if (!['conferir', 'devolver'].includes(dados.acao)) throw requisicaoInvalida('Ação inválida.');
  if (dados.acao === 'devolver' && (!String(dados.motivo || '').trim() || String(dados.motivo).length > 1000)) throw requisicaoInvalida('Informe o motivo da devolução (até 1.000 caracteres).');
  return db.transaction(async (trx) => {
    const r = await trx('relatorios_almas').where({ id }).first();
    if (!r) throw naoEncontrado('Relatório não encontrado.');
    await rallyService.exigirEditavel(r.rally_id, trx);
    if (r.status === 'rascunho') throw conflito('Aguarde o envio do relatório.');
    const dadosNovos = { status: dados.acao === 'conferir' ? 'conferido' : 'rascunho', avaliado_por: usuario.id, avaliado_em: agora(), atualizado_em: agora(), observacao_admin: dados.acao === 'devolver' ? String(dados.motivo).trim() : null };
    await trx('relatorios_almas').where({ id }).update(dadosNovos);
    await auditoria.registrar({ entidade: 'relatorios_almas', entidadeId: id, acao: dados.acao, usuarioId: usuario.id, antes: r, depois: dadosNovos }, trx);
    return { ok: true };
  });
}
function texto(rally, inicio, dados, responsavel) {
  const data = (s) => s.split('-').reverse().join('/'); const periodo = semana(inicio);
  const linhas = ['========================================================', '             RALLY DAS TRIBOS - FJU', '         RELATÓRIO SEMANAL DE ALMAS', '========================================================', '', `Rally: ${rally.nome}`, `Semana: ${data(periodo.inicio)} até ${data(periodo.fim)}`, `Responsável: ${responsavel}`, '', 'RESUMO GERAL', `Almas novas: ${dados.resumo.novas}`, `Almas afastadas: ${dados.resumo.afastadas}`, `TOTAL GERAL: ${dados.resumo.total}`, ''];
  for (const r of dados.relatorios.filter((x) => x.status !== 'rascunho')) {
    linhas.push('========================================================', `TRIBO DE ${r.tribo_nome.toUpperCase()}`, `Responsável: ${r.responsavel_nome}`, 'REUNIÃO             NOVAS       AFASTADAS      TOTAL', '--------------------------------------------------------');
    r.dias.forEach((d, i) => linhas.push(`${NOMES[i].padEnd(20)}${String(d.novas).padEnd(12)}${String(d.afastadas).padEnd(15)}${d.novas + d.afastadas}`));
    linhas.push('--------------------------------------------------------', `TOTAL               ${String(r.novas).padEnd(12)}${String(r.afastadas).padEnd(15)}${r.total}`, '');
  }
  if (dados.resumo.pendentes.length) linhas.push(`Ainda não enviados: ${dados.resumo.pendentes.map((t) => t.nome).join(', ')}`);
  return linhas.join('\n');
}
module.exports = { listar, salvar, avaliar, semana, validarDias, texto };
