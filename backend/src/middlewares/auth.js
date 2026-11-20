const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../database/connection');
const { naoAutenticado, proibido } = require('../utils/http');
const COOKIE = 'rally_token';
const JWT_ISSUER = 'rally-das-tribos';
const JWT_AUDIENCE = 'rally-web';
function extrairToken(req) {
  if (req.cookies?.[COOKIE]) return req.cookies[COOKIE];
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
function verificarToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
}
async function autenticar(req, _res, next) {
  const token = extrairToken(req);
  if (!token) throw naoAutenticado();
  let payload;
  try { payload = verificarToken(token); } catch { throw naoAutenticado('Sessão expirada. Faça login novamente.'); }
  if (!/^\d+$/.test(String(payload.sub)) || !Number.isSafeInteger(payload.av)) throw naoAutenticado();
  const usuario = await db('usuarios as u').leftJoin('pessoas as p','p.id','u.pessoa_id')
    .select('u.id','u.email','u.papel','u.pessoa_id','u.ativo','u.auth_versao','p.excluido_em','p.ativo as pessoa_ativa')
    .where('u.id', Number(payload.sub)).first();
  if (!usuario || !usuario.ativo || usuario.excluido_em || usuario.pessoa_ativa === false || usuario.pessoa_ativa === 0 || Number(usuario.auth_versao) !== payload.av) throw naoAutenticado();
  req.usuario = { id:usuario.id,email:usuario.email,papel:usuario.papel,pessoa_id:usuario.pessoa_id,ativo:usuario.ativo,admin:usuario.papel==='admin' };
  next();
}
function exigirAdmin(req, _res, next) { if (!req.usuario?.admin) throw proibido('Apenas administradores podem fazer isso.'); next(); }
module.exports = { autenticar, exigirAdmin, COOKIE, JWT_ISSUER, JWT_AUDIENCE, verificarToken, extrairToken };
