const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database/connection');
const { naoAutenticado, proibido } = require('../utils/http');
 
const COOKIE = 'rally_token';
 
function extrairToken(req) {
  if (req.cookies?.[COOKIE]) return req.cookies[COOKIE];
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
 
async function autenticar(req, _res, next) {
  const token = extrairToken(req);
  if (!token) throw naoAutenticado();
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw naoAutenticado('Sessão expirada. Faça login novamente.');
  }
  const usuario = await db('usuarios')
    .select('id', 'email', 'papel', 'pessoa_id', 'ativo')
    .where({ id: payload.sub })
    .first();
  if (!usuario || !usuario.ativo) throw naoAutenticado();
  req.usuario = { ...usuario, admin: usuario.papel === 'admin' };
  next();
}
 
function exigirAdmin(req, _res, next) {
  if (!req.usuario?.admin) throw proibido('Apenas administradores podem fazer isso.');
  next();
}
 
module.exports = { autenticar, exigirAdmin, COOKIE };
