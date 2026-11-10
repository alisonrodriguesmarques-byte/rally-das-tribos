const db = require('../database/connection');
const { proibido } = require('../utils/http');
 
/**
 * Papel do usuário dentro de um rally.
 * Retorna { admin, rallyTriboId, funcao } onde funcao = admin | cabeca | auxiliar | participante | null.
 */
async function contextoNoRally(usuario, rallyId, trx = db) {
  if (usuario.admin) return { admin: true, rallyTriboId: null, funcao: 'admin' };
  const pid = usuario.pessoa_id;
  if (!pid) return { admin: false, rallyTriboId: null, funcao: null };
 
  const lider = await trx('rally_tribos')
    .where({ rally_id: rallyId })
    .where((w) => w.where('cabeca_pessoa_id', pid).orWhere('auxiliar_pessoa_id', pid))
    .first();
  if (lider) {
    return { admin: false, rallyTriboId: lider.id, funcao: lider.cabeca_pessoa_id === pid ? 'cabeca' : 'auxiliar' };
  }
 
  const membro = await trx('membros_tribo as m')
    .join('rally_tribos as rt', 'rt.id', 'm.rally_tribo_id')
    .where({ 'rt.rally_id': rallyId, 'm.pessoa_id': pid, 'm.status': 'ativo' })
    .select('rt.id')
    .first();
  if (membro) return { admin: false, rallyTriboId: membro.id, funcao: 'participante' };
  return { admin: false, rallyTriboId: null, funcao: null };
}
 
function exigirDaTribo(ctx, rallyTriboId) {
  if (ctx.admin) return;
  if (!ctx.rallyTriboId || Number(ctx.rallyTriboId) !== Number(rallyTriboId)) {
    throw proibido('Você só pode acessar dados da sua própria tribo.');
  }
}
 
function exigirLideranca(ctx, rallyTriboId) {
  exigirDaTribo(ctx, rallyTriboId);
  if (!ctx.admin && !['cabeca', 'auxiliar'].includes(ctx.funcao)) {
    throw proibido('Apenas o cabeça ou o auxiliar da tribo podem fazer isso.');
  }
}
 
module.exports = { contextoNoRally, exigirDaTribo, exigirLideranca };
