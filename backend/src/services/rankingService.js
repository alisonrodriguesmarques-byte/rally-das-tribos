const db = require('../database/connection');
const triboRepo = require('../repositories/triboRepo');
const lancamentoRepo = require('../repositories/lancamentoRepo');
const provaRepo = require('../repositories/provaRepo');
const rallyRepo = require('../repositories/rallyRepo');
const { naoEncontrado } = require('../utils/http');
const { hoje, paraData, diasEntre, semanaDoRally } = require('../utils/datas');
const { num } = require('../utils/db');
 
/** Ranking sempre calculado a partir dos lançamentos ativos. Empates dividem a posição. */
async function ranking(rallyId, trx = db) {
  const [tribos, totais] = await Promise.all([
    triboRepo.listarDoRally(rallyId, trx),
    lancamentoRepo.totaisPorTribo(rallyId, trx),
  ]);
  const mapa = Object.fromEntries(totais.map((t) => [t.rally_tribo_id, num(t.pontos)]));
  const lista = tribos
    .map((t) => ({
      rally_tribo_id: t.id, tribo: t.nome, slug: t.slug, cor: t.cor, ordem: t.ordem,
      cabeca_nome: t.cabeca_nome, auxiliar_nome: t.auxiliar_nome, participantes: t.participantes,
      pontos: mapa[t.id] || 0,
    }))
    .sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem);
  lista.forEach((t, i) => {
    t.posicao = i > 0 && lista[i - 1].pontos === t.pontos ? lista[i - 1].posicao : i + 1;
  });
  return lista;
}
 
/** Pontos por semana do rally, por tribo (semanal e acumulado). */
async function semanas(rallyId) {
  const rally = await rallyRepo.obter(rallyId);
  if (!rally) throw naoEncontrado('Rally não encontrado.');
  const inicio = paraData(rally.data_inicio);
  const fim = paraData(rally.data_fim);
  const [tribos, lancs] = await Promise.all([triboRepo.listarDoRally(rallyId), lancamentoRepo.ativosDoRally(rallyId)]);
  const ate = hoje() < fim ? hoje() : fim;
  let total = Math.max(1, semanaDoRally(inicio, ate < inicio ? inicio : ate));
  for (const l of lancs) total = Math.max(total, semanaDoRally(inicio, l.data_referencia));
 
  const series = tribos.map((t) => ({ rally_tribo_id: t.id, tribo: t.nome, cor: t.cor, semanal: Array(total).fill(0) }));
  const idx = Object.fromEntries(series.map((s, i) => [s.rally_tribo_id, i]));
  for (const l of lancs) {
    const s = series[idx[l.rally_tribo_id]];
    if (s) s.semanal[semanaDoRally(inicio, l.data_referencia) - 1] += num(l.pontos);
  }
  for (const s of series) {
    let acc = 0;
    s.acumulado = s.semanal.map((v) => (acc += v));
  }
  const rotulos = Array.from({ length: total }, (_, i) => `Semana ${i + 1}`);
  return { rotulos, series };
}
 
async function porCategoria(rallyId, rallyTriboId) {
  const linhas = await lancamentoRepo.porCategoria(rallyId, rallyTriboId);
  return linhas.map((l) => ({ ...l, pontos: num(l.pontos) }));
}
 
async function dashboard(rallyId) {
  const rally = await rallyRepo.obter(rallyId);
  if (!rally) throw naoEncontrado('Rally não encontrado.');
  const contar = async (q) => num((await q.count({ n: '*' }).first()).n);
  const [rank, sem, cats, participantes, missoes, provas, pendentes, resultadosProvas, provasLista] = await Promise.all([
    ranking(rallyId),
    semanas(rallyId),
    porCategoria(rallyId),
    contar(db('membros_tribo as m').join('rally_tribos as rt', 'rt.id', 'm.rally_tribo_id').where({ 'rt.rally_id': rallyId, 'm.status': 'ativo' })),
    contar(db('missoes').where({ rally_id: rallyId }).whereNot({ status: 'cancelada' })),
    contar(db('provas').where({ rally_id: rallyId }).whereNot({ status: 'cancelada' })),
    contar(db('missao_entregas as e').join('missoes as m', 'm.id', 'e.missao_id').where({ 'm.rally_id': rallyId, 'e.status': 'enviada' })),
    provaRepo.resultadosDoRally(rallyId),
    provaRepo.listar(rallyId),
  ]);
  const maxPorProva = Object.fromEntries(provasLista.map((p) => [p.id, num(p.pontuacao_maxima)]));
  const desempenho = {};
  for (const r of resultadosProvas) {
    const d = (desempenho[r.prova_id] ||= { prova: r.titulo, soma: 0, n: 0, maximo: maxPorProva[r.prova_id] || 0 });
    d.soma += num(r.pontos);
    d.n += 1;
  }
  const inicio = paraData(rally.data_inicio);
  const fim = paraData(rally.data_fim);
  const semanasTotais = sem.rotulos.map((rotulo, i) => ({ rotulo, pontos: sem.series.reduce((a, s) => a + s.semanal[i], 0) }));
  return {
    rally: { ...rally, data_inicio: inicio, data_fim: fim },
    dias_restantes: Math.max(0, diasEntre(hoje(), fim)),
    dias_totais: diasEntre(inicio, fim),
    totais: {
      tribos: rank.length,
      participantes,
      missoes,
      provas,
      entregas_pendentes: pendentes,
      pontos_distribuidos: rank.reduce((a, t) => a + t.pontos, 0),
    },
    ranking: rank,
    semanas: sem,
    pontos_por_semana: semanasTotais,
    por_categoria: cats,
    desempenho_provas: Object.values(desempenho).map((d) => ({
      prova: d.prova,
      media: Math.round(d.soma / d.n),
      maximo: d.maximo,
      percentual: d.maximo ? Math.round((d.soma / d.n / d.maximo) * 100) : null,
    })),
  };
}
 
module.exports = { ranking, semanas, porCategoria, dashboard };
