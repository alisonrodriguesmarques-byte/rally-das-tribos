const db = require('../database/connection');
 
async function registrar({ entidade, entidadeId, acao, antes, depois, usuarioId }, trx = db) {
  await trx('auditoria').insert({
    entidade,
    entidade_id: entidadeId,
    acao,
    antes_json: antes ? JSON.stringify(antes) : null,
    depois_json: depois ? JSON.stringify(depois) : null,
    usuario_id: usuarioId || null,
  });
}
 
async function listar(entidade, ids, trx = db) {
  if (!ids.length) return [];
  return trx('auditoria as a')
    .leftJoin('usuarios as u', 'u.id', 'a.usuario_id')
    .select('a.*', 'u.email as usuario_email')
    .where('a.entidade', entidade)
    .whereIn('a.entidade_id', ids)
    .orderBy('a.em', 'desc');
}
 
module.exports = { registrar, listar };
