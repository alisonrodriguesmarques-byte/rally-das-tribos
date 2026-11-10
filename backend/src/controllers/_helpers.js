const { contextoNoRally } = require('../services/acessoService');
const { requisicaoInvalida } = require('../utils/http');
 
function idParam(req, nome = 'id') {
  const v = Number(req.params[nome]);
  if (!Number.isInteger(v) || v <= 0) throw requisicaoInvalida('Identificador inválido.');
  return v;
}
 
const contexto = (req, rallyId) => contextoNoRally(req.usuario, rallyId);
const ctxDe = (req) => (rallyId) => contextoNoRally(req.usuario, rallyId);
 
module.exports = { idParam, contexto, ctxDe };
