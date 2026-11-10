const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
function listar(rallyId, { status, rallyTriboId } = {}, trx = db) {
  const q = trx('provas as p')
    .leftJoin('categorias as c', 'c.id', 'p.categoria_id')
    .select('p.*', 'c.nome as categoria_nome')
    .select(trx.raw('(SELECT COUNT(*) FROM questoes q WHERE q.prova_id = p.id AND q.removida = ?) as total_questoes', [false]))
    .select(trx.raw('(SELECT COALESCE(SUM(q.pontos), 0) FROM questoes q WHERE q.prova_id = p.id AND q.removida = ?) as pontuacao_maxima', [false]))
    .select(trx.raw("(SELECT COUNT(*) FROM tentativas tt WHERE tt.prova_id = p.id AND tt.status <> 'anulada') as total_tentativas"))
    .where('p.rally_id', rallyId)
    .orderBy('p.id', 'desc');
  if (status) q.whereIn('p.status', [].concat(status));
  if (rallyTriboId) {
    q.where((w) => w.where('p.todas_tribos', true)
      .orWhereExists(trx('prova_tribos as pt').whereRaw('pt.prova_id = p.id').where('pt.rally_tribo_id', rallyTriboId)));
  }
  return q;
}
 
const obter = (id, trx = db) => trx('provas as p')
  .leftJoin('categorias as c', 'c.id', 'p.categoria_id')
  .select('p.*', 'c.nome as categoria_nome')
  .where('p.id', id).first();
const criar = (dados, trx = db) => inserir(trx, 'provas', dados);
const atualizar = (id, dados, trx = db) => trx('provas').where({ id }).update(dados);
 
const tribosDaProva = (provaId, trx = db) => trx('prova_tribos').where({ prova_id: provaId }).pluck('rally_tribo_id');
async function definirTribos(provaId, ids, trx = db) {
  await trx('prova_tribos').where({ prova_id: provaId }).del();
  if (ids.length) await trx('prova_tribos').insert(ids.map((id) => ({ prova_id: provaId, rally_tribo_id: id })));
}
 
const questoes = (provaId, trx = db) => trx('questoes').where({ prova_id: provaId, removida: false }).orderBy(['ordem', 'id']);
const obterQuestao = (id, trx = db) => trx('questoes').where({ id }).first();
const criarQuestao = (dados, trx = db) => inserir(trx, 'questoes', dados);
const atualizarQuestao = (id, dados, trx = db) => trx('questoes').where({ id }).update(dados);
 
async function alternativasDe(questaoIds, trx = db) {
  if (!questaoIds.length) return [];
  return trx('alternativas').whereIn('questao_id', questaoIds).orderBy(['questao_id', 'ordem', 'id']);
}
async function aceitasDe(questaoIds, trx = db) {
  if (!questaoIds.length) return [];
  return trx('respostas_aceitas').whereIn('questao_id', questaoIds).orderBy('id');
}
 
async function substituirItens(questaoId, alternativas, aceitas, trx = db) {
  await trx('alternativas').where({ questao_id: questaoId }).del();
  await trx('respostas_aceitas').where({ questao_id: questaoId }).del();
  if (alternativas.length) await trx('alternativas').insert(alternativas.map((a) => ({ ...a, questao_id: questaoId })));
  if (aceitas.length) await trx('respostas_aceitas').insert(aceitas.map((texto) => ({ texto, questao_id: questaoId })));
}
 
async function excluirQuestao(id, trx = db) {
  await trx('alternativas').where({ questao_id: id }).del();
  await trx('respostas_aceitas').where({ questao_id: id }).del();
  await trx('questoes').where({ id }).del();
}
 
async function contarTentativas(provaId, trx = db) {
  const r = await trx('tentativas').where({ prova_id: provaId }).count({ n: '*' }).first();
  return Number(r.n);
}
 
function baseTentativas(trx = db) {
  return trx('tentativas as tt')
    .join('rally_tribos as rt', 'rt.id', 'tt.rally_tribo_id')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .leftJoin('pessoas as p', 'p.id', 'tt.pessoa_id')
    .select('tt.*', 't.nome as tribo_nome', 't.cor as tribo_cor', trx.raw('COALESCE(p.apelido, p.nome_completo) as pessoa_nome'));
}
 
const tentativas = (filtro, trx = db) => baseTentativas(trx).where(filtro).orderBy('tt.id', 'desc');
const obterTentativa = (id, trx = db) => baseTentativas(trx).where('tt.id', id).first();
const criarTentativa = (dados, trx = db) => inserir(trx, 'tentativas', dados);
const atualizarTentativa = (id, dados, trx = db) => trx('tentativas').where({ id }).update(dados);
 
const respostasDe = (tentativaId, trx = db) => trx('respostas').where({ tentativa_id: tentativaId });
const obterResposta = (id, trx = db) => trx('respostas').where({ id }).first();
const atualizarResposta = (id, dados, trx = db) => trx('respostas').where({ id }).update(dados);
async function inserirRespostas(linhas, trx = db) {
  if (linhas.length) await trx('respostas').insert(linhas);
}
 
const resultado = (provaId, rallyTriboId, trx = db) => trx('prova_resultados').where({ prova_id: provaId, rally_tribo_id: rallyTriboId }).first();
const criarResultado = (dados, trx = db) => inserir(trx, 'prova_resultados', dados);
const atualizarResultado = (id, dados, trx = db) => trx('prova_resultados').where({ id }).update(dados);
function resultados(provaId, trx = db) {
  return trx('prova_resultados as r')
    .join('rally_tribos as rt', 'rt.id', 'r.rally_tribo_id')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .select('r.*', 't.nome as tribo_nome', 't.cor as tribo_cor')
    .where('r.prova_id', provaId)
    .orderBy('r.pontos', 'desc');
}
function resultadosDoRally(rallyId, trx = db) {
  return trx('prova_resultados as r')
    .join('provas as p', 'p.id', 'r.prova_id')
    .where('p.rally_id', rallyId)
    .select('r.prova_id', 'r.rally_tribo_id', 'r.pontos', 'p.titulo');
}
 
module.exports = {
  listar, obter, criar, atualizar, tribosDaProva, definirTribos, questoes, obterQuestao, criarQuestao,
  atualizarQuestao, alternativasDe, aceitasDe, substituirItens, excluirQuestao, contarTentativas,
  tentativas, obterTentativa, criarTentativa, atualizarTentativa, respostasDe, obterResposta,
  atualizarResposta, inserirRespostas, resultado, criarResultado, atualizarResultado, resultados, resultadosDoRally,
};
