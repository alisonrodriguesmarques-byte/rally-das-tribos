'use strict';

const crypto = require('crypto');
const { authError } = require('../services/authService');
const COOKIE_NAME = 'rally_session';

function readSessionCookie(req) {
  const cookies = (req.headers.cookie || '').split(';').map(value => value.trim())
    .filter(value => value.startsWith(COOKIE_NAME + '='));
  if (cookies.length !== 1) return null;
  const token = cookies[0].slice(COOKIE_NAME.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function cookieOptions(req) {
  // Use the actual transport, never X-Forwarded-Proto or client-supplied roles.
  return { httpOnly: true, sameSite: 'strict', secure: req?.socket?.encrypted === true, path: '/' };
}

function clearSessionCookie(res, req) {
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
}

function createAuthMiddleware(service) {
  async function requireSession(req, res, next) {
    try {
      const auth = await service.authenticate(readSessionCookie(req));
      if (!auth) {
        clearSessionCookie(res, req);
        return next(authError(401, 'Entre na sua conta para continuar.', 'AUTH_REQUIRED'));
      }
      req.auth = auth;
      next();
    } catch (error) { next(error); }
  }

  function requireAdmin(req, res, next) {
    if (!req.auth || req.auth.user.tipo_usuario !== 'admin') return next(authError(403, 'Acesso restrito ao administrador.'));
    next();
  }

  function requireCsrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const received = req.get('X-CSRF-Token');
    const expected = req.auth?.csrfToken;
    if (typeof received !== 'string' || !/^[a-f0-9]{64}$/.test(received) ||
        typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) ||
        !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
      return next(authError(403, 'Token de protecao invalido. Atualize a sessao e tente novamente.', 'CSRF_INVALID'));
    }
    next();
  }

  return { requireSession, requireAdmin, requireCsrf };
}

module.exports = { createAuthMiddleware, readSessionCookie, clearSessionCookie, cookieOptions, COOKIE_NAME };
