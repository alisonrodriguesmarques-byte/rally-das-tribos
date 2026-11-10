const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
function listar({ busca, ativo, rallyId, rallyTriboId, semTribo } = {}, trx = db) {
  const q = trx('pessoas as p')
    .leftJoin('usuarios as u', 'u.pessoa_id', 'p.id')
    .select('p.*', 'u.email', 'u.papel')
    .orderBy('p.nome_completo');
 
  if (rallyId) {
    q.leftJoin(
      trx('membros_tribo as m')
        .join('rally_tribos as rt', 'rt.id', 'm.rally_tribo_id')
        .join('tribos as t', 't.id', 'rt.tribo_id')
        .where({ 'rt.rally_id': rallyId, 'm.status': 'ativo' })
        .select('m.id as membro_id', 'm.pessoa_id', 'rt.id as rally_tribo_id', 't.nome as tribo_nome')
        .as('mt'),
      'mt.pessoa_id', 'p.id',
    ).select('mt.membro_id', 'mt.rally_tribo_id', 'mt.tribo_nome');
    if (rallyTriboId) q.where('mt.rally_tribo_id', rallyTriboId);
    if (semTribo) q.whereNull('mt.membro_id');
  }
  if (busca) {
    const termo = `%${busca.toLowerCase()}%`;
    q.where((w) => w.whereRaw('LOWER(p.nome_completo) LIKE ?', [termo]).orWhereRaw('LOWER(p.apelido) LIKE ?', [termo]));
  }
  if (ativo !== undefined) q.where('p.ativo', ativo);
  return q;
}
 
const obter = (id, trx = db) => trx('pessoas').where({ id }).first();
const criar = (dados, trx = db) => inserir(trx, 'pessoas', dados);
const atualizar = (id, dados, trx = db) => trx('pessoas').where({ id }).update(dados);
 
function historicoTribos(pessoaId, trx = db) {
  return trx('membros_tribo as m')
    .join('rally_tribos as rt', 'rt.id', 'm.rally_tribo_id')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .join('rallies as r', 'r.id', 'rt.rally_id')
    .select('m.*', 't.nome as tribo_nome', 'r.nome as rally_nome', 'r.id as rally_id')
    .where('m.pessoa_id', pessoaId)
    .orderBy('m.entrou_em', 'desc');
}
 
function liderancas(pessoaId, trx = db) {
  return trx('rally_tribos as rt')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .join('rallies as r', 'r.id', 'rt.rally_id')
    .select('rt.id', 'r.nome as rally_nome', 't.nome as tribo_nome',
      trx.raw("CASE WHEN rt.cabeca_pessoa_id = ? THEN 'cabeca' ELSE 'auxiliar' END as funcao", [pessoaId]))
    .where((w) => w.where('rt.cabeca_pessoa_id', pessoaId).orWhere('rt.auxiliar_pessoa_id', pessoaId));
}
 
module.exports = { listar, obter, criar, atualizar, historicoTribos, liderancas };
