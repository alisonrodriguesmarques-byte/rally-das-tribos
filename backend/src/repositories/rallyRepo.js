const db = require('../database/connection');
const { inserir } = require('../utils/db');
 
const listar = (trx = db) => trx('rallies').orderBy([{ column: 'data_inicio', order: 'desc' }, { column: 'id', order: 'desc' }]);
 
const obter = (id, trx = db) => trx('rallies').where({ id }).first();
 
async function atual(trx = db) {
  const ativo = await trx('rallies').where({ status: 'ativo' }).orderBy('data_inicio', 'desc').first();
  if (ativo) return ativo;
  return trx('rallies').orderBy([{ column: 'data_inicio', order: 'desc' }, { column: 'id', order: 'desc' }]).first();
}
 
const criar = (dados, trx = db) => inserir(trx, 'rallies', dados);
 
const atualizar = (id, dados, trx = db) => trx('rallies').where({ id }).update(dados);
 
async function anteriorA(rallyId, trx = db) {
  return trx('rallies').whereNot({ id: rallyId }).orderBy([{ column: 'data_inicio', order: 'desc' }, { column: 'id', order: 'desc' }]).first();
}
 
module.exports = { listar, obter, atual, criar, atualizar, anteriorA };
