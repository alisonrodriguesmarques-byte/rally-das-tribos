const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
function listar(rallyId, { status, rallyTriboId } = {}, trx = db) {
  const q = trx('missoes as m')
    .leftJoin('categorias as c', 'c.id', 'm.categoria_id')
    .select('m.*', 'c.nome as categoria_nome')
    .where('m.rally_id', rallyId)
    .orderBy([{ column: 'm.data_inicio', order: 'desc' }, { column: 'm.id', order: 'asc' }]);
  if (status) q.whereIn('m.status', [].concat(status));
  if (rallyTriboId) {
    q.where((w) => w.where('m.todas_tribos', true)
      .orWhereExists(trx('missao_tribos as mt').whereRaw('mt.missao_id = m.id').where('mt.rally_tribo_id', rallyTriboId)));
  }
  return q;
}
 
const obter = (id, trx = db) => trx('missoes as m')
  .leftJoin('categorias as c', 'c.id', 'm.categoria_id')
  .select('m.*', 'c.nome as categoria_nome')
  .where('m.id', id).first();
const criar = (dados, trx = db) => inserir(trx, 'missoes', dados);
const atualizar = (id, dados, trx = db) => trx('missoes').where({ id }).update(dados);
 
const tribosDaMissao = (missaoId, trx = db) => trx('missao_tribos').where({ missao_id: missaoId }).pluck('rally_tribo_id');
 
async function definirTribos(missaoId, ids, trx = db) {
  await trx('missao_tribos').where({ missao_id: missaoId }).del();
  if (ids.length) await trx('missao_tribos').insert(ids.map((id) => ({ missao_id: missaoId, rally_tribo_id: id })));
}
 
function entregas(filtro, trx = db) {
  return trx('missao_entregas as e')
    .join('rally_tribos as rt', 'rt.id', 'e.rally_tribo_id')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .join('missoes as m', 'm.id', 'e.missao_id')
    .leftJoin('lancamentos as l', 'l.id', 'e.lancamento_id')
    .leftJoin('usuarios as u', 'u.id', 'e.enviado_por')
    .leftJoin('pessoas as p', 'p.id', 'u.pessoa_id')
    .select('e.*', 't.nome as tribo_nome', 't.cor as tribo_cor', 'm.titulo as missao_titulo',
      'l.pontos as pontos_lancados', 'l.status as lancamento_status',
      db.raw('COALESCE(p.apelido, p.nome_completo, u.email) as enviado_por_nome'))
    .where(filtro)
    .orderBy('e.enviado_em', 'desc');
}
 
const obterEntrega = (id, trx = db) => trx('missao_entregas').where({ id }).first();
const criarEntrega = (dados, trx = db) => inserir(trx, 'missao_entregas', dados);
const atualizarEntrega = (id, dados, trx = db) => trx('missao_entregas').where({ id }).update(dados);
 
function contagemEntregas(rallyId, trx = db) {
  return trx('missao_entregas as e')
    .join('missoes as m', 'm.id', 'e.missao_id')
    .where('m.rally_id', rallyId)
    .groupBy('e.missao_id', 'e.status')
    .select('e.missao_id', 'e.status', trx.raw('COUNT(*) as n'));
}
 
module.exports = {
  listar, obter, criar, atualizar, tribosDaMissao, definirTribos, entregas, obterEntrega,
  criarEntrega, atualizarEntrega, contagemEntregas,
};
