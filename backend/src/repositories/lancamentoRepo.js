const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
function base(trx = db) {
  return trx('lancamentos as l')
    .join('rally_tribos as rt', 'rt.id', 'l.rally_tribo_id')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .leftJoin('categorias as c', 'c.id', 'l.categoria_id')
    .leftJoin('pessoas as p', 'p.id', 'l.pessoa_id')
    .leftJoin('usuarios as u', 'u.id', 'l.criado_por')
    .leftJoin('pessoas as pu', 'pu.id', 'u.pessoa_id')
    .select(
      'l.*', 't.nome as tribo_nome', 't.cor as tribo_cor', 'c.nome as categoria_nome',
      trx.raw('COALESCE(p.apelido, p.nome_completo) as pessoa_nome'),
      trx.raw('COALESCE(pu.apelido, pu.nome_completo, u.email) as criado_por_nome'),
    );
}
 
function listar(rallyId, filtros = {}, trx = db) {
  const q = base(trx).where('l.rally_id', rallyId).orderBy([{ column: 'l.data_referencia', order: 'desc' }, { column: 'l.id', order: 'desc' }]);
  if (filtros.rally_tribo_id) q.where('l.rally_tribo_id', filtros.rally_tribo_id);
  if (filtros.categoria_id) q.where('l.categoria_id', filtros.categoria_id);
  if (filtros.origem_tipo) q.where('l.origem_tipo', filtros.origem_tipo);
  if (filtros.status) q.where('l.status', filtros.status);
  if (filtros.pessoa_id) q.where('l.pessoa_id', filtros.pessoa_id);
  if (filtros.limite) q.limit(filtros.limite);
  return q;
}
 
const obter = (id, trx = db) => base(trx).where('l.id', id).first();
const criar = (dados, trx = db) => inserir(trx, 'lancamentos', dados);
const atualizar = (id, dados, trx = db) => trx('lancamentos').where({ id }).update(dados);
const registrarHistorico = (dados, trx = db) => inserir(trx, 'lancamentos_historico', dados);
 
function historico(lancamentoId, trx = db) {
  return trx('lancamentos_historico as h')
    .leftJoin('usuarios as u', 'u.id', 'h.usuario_id')
    .leftJoin('pessoas as p', 'p.id', 'u.pessoa_id')
    .select('h.*', trx.raw('COALESCE(p.apelido, p.nome_completo, u.email) as usuario_nome'))
    .where('h.lancamento_id', lancamentoId)
    .orderBy('h.id');
}
 
function totaisPorTribo(rallyId, trx = db) {
  return trx('lancamentos')
    .where({ rally_id: rallyId, status: 'ativo' })
    .groupBy('rally_tribo_id')
    .select('rally_tribo_id', trx.raw('SUM(pontos) as pontos'));
}
 
function ativosDoRally(rallyId, trx = db) {
  return trx('lancamentos')
    .where({ rally_id: rallyId, status: 'ativo' })
    .select('rally_tribo_id', 'data_referencia', 'pontos', 'categoria_id');
}
 
function porCategoria(rallyId, rallyTriboId, trx = db) {
  const q = trx('lancamentos as l')
    .leftJoin('categorias as c', 'c.id', 'l.categoria_id')
    .where({ 'l.rally_id': rallyId, 'l.status': 'ativo' })
    .groupBy('c.id', 'c.nome')
    .select('c.id as categoria_id', trx.raw("COALESCE(c.nome, 'Sem categoria') as categoria"), trx.raw('SUM(l.pontos) as pontos'))
    .orderBy('pontos', 'desc');
  if (rallyTriboId) q.where('l.rally_tribo_id', rallyTriboId);
  return q;
}
 
module.exports = {
  listar, obter, criar, atualizar, registrarHistorico, historico, totaisPorTribo, ativosDoRally, porCategoria,
};
