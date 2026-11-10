const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
function base(trx = db) {
  return trx('dinamicas as d')
    .join('rally_tribos as rt', 'rt.id', 'd.rally_tribo_id')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .leftJoin('pessoas as p', 'p.id', 'd.responsavel_pessoa_id')
    .leftJoin('lancamentos as l', 'l.id', 'd.lancamento_id')
    .select('d.*', 't.nome as tribo_nome', 't.cor as tribo_cor',
      trx.raw('COALESCE(p.apelido, p.nome_completo) as responsavel_nome'),
      'l.pontos as pontos_lancados', 'l.status as lancamento_status');
}
 
function listar(rallyId, { rallyTriboId, status } = {}, trx = db) {
  const q = base(trx).where('d.rally_id', rallyId).orderBy([{ column: 'd.data_encontro', order: 'desc' }, { column: 'd.id', order: 'desc' }]);
  if (rallyTriboId) q.where('d.rally_tribo_id', rallyTriboId);
  if (status) q.where('d.status', status);
  return q;
}
 
const obter = (id, trx = db) => base(trx).where('d.id', id).first();
const criar = (dados, trx = db) => inserir(trx, 'dinamicas', dados);
const atualizar = (id, dados, trx = db) => trx('dinamicas').where({ id }).update(dados);
 
module.exports = { listar, obter, criar, atualizar };
