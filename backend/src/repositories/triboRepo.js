const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
const listarCatalogo = (trx = db) => trx('tribos').orderBy('ordem');
 
function baseRallyTribos(trx = db) {
  return trx('rally_tribos as rt')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .leftJoin('pessoas as pc', 'pc.id', 'rt.cabeca_pessoa_id')
    .leftJoin('pessoas as pa', 'pa.id', 'rt.auxiliar_pessoa_id')
    .select(
      'rt.id', 'rt.rally_id', 'rt.tribo_id', 'rt.cabeca_pessoa_id', 'rt.auxiliar_pessoa_id',
      't.nome', 't.slug', 't.cor', 't.ordem',
      trx.raw('COALESCE(pc.apelido, pc.nome_completo) as cabeca_nome'),
      trx.raw('COALESCE(pa.apelido, pa.nome_completo) as auxiliar_nome'),
    );
}
 
async function listarDoRally(rallyId, trx = db) {
  const tribos = await baseRallyTribos(trx).where('rt.rally_id', rallyId).orderBy('t.ordem');
  const contagens = await trx('membros_tribo as m')
    .join('rally_tribos as rt', 'rt.id', 'm.rally_tribo_id')
    .where({ 'rt.rally_id': rallyId, 'm.status': 'ativo' })
    .groupBy('m.rally_tribo_id')
    .select('m.rally_tribo_id', trx.raw('COUNT(*) as n'));
  const mapa = Object.fromEntries(contagens.map((c) => [c.rally_tribo_id, Number(c.n)]));
  return tribos.map((t) => ({ ...t, participantes: mapa[t.id] || 0 }));
}
 
const obter = (id, trx = db) => baseRallyTribos(trx).where('rt.id', id).first();
 
const criar = (dados, trx = db) => inserir(trx, 'rally_tribos', dados);
 
const atualizar = (id, dados, trx = db) => trx('rally_tribos').where({ id }).update(dados);
 
function listarMembros(rallyTriboId, trx = db) {
  return trx('membros_tribo as m')
    .join('pessoas as p', 'p.id', 'm.pessoa_id')
    .select('m.id', 'm.pessoa_id', 'm.entrou_em', 'm.status', 'p.nome_completo', 'p.apelido', 'p.foto_url', 'p.ativo')
    .where({ 'm.rally_tribo_id': rallyTriboId, 'm.status': 'ativo' })
    .orderBy('p.nome_completo');
}
 
const obterMembro = (id, trx = db) => trx('membros_tribo').where({ id }).first();
 
function membroAtivoNoRally(pessoaId, rallyId, trx = db) {
  return trx('membros_tribo as m')
    .join('rally_tribos as rt', 'rt.id', 'm.rally_tribo_id')
    .join('tribos as t', 't.id', 'rt.tribo_id')
    .select('m.*', 't.nome as tribo_nome')
    .where({ 'm.pessoa_id': pessoaId, 'rt.rally_id': rallyId, 'm.status': 'ativo' })
    .first();
}
 
const criarMembro = (dados, trx = db) => inserir(trx, 'membros_tribo', dados);
 
const atualizarMembro = (id, dados, trx = db) => trx('membros_tribo').where({ id }).update(dados);
 
function listarMembrosAtivosDoRally(rallyId, trx = db) {
  return trx('membros_tribo as m')
    .join('rally_tribos as rt', 'rt.id', 'm.rally_tribo_id')
    .select('m.pessoa_id', 'rt.tribo_id')
    .where({ 'rt.rally_id': rallyId, 'm.status': 'ativo' });
}
 
module.exports = {
  listarCatalogo, listarDoRally, obter, criar, atualizar, listarMembros, obterMembro,
  membroAtivoNoRally, criarMembro, atualizarMembro, listarMembrosAtivosDoRally,
};
