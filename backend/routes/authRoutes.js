'use strict';

const express = require('express');
const { authError } = require('../services/authService');
const { readSessionCookie, clearSessionCookie, cookieOptions, COOKIE_NAME } = require('../middleware/auth');

function setupAuthRoutes(service, middleware) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/login', async (req, res, next) => {
    try {
      if (!req.is('application/json')) throw authError(415, 'Envie as credenciais como JSON.');
      const session = await service.login(req.body?.email, req.body?.password, {
        source: req.ip, previousToken: readSessionCookie(req)
      });
      res.cookie(COOKIE_NAME, session.token, { ...cookieOptions(req), maxAge: session.expiresAt - service.now() });
      res.json({ success: true, data: { user: session.user, csrfToken: session.csrfToken } });
    } catch (error) {
      if (error.status === 429) res.set('Retry-After', '900');
      next(error);
    }
  });
  router.get('/session', middleware.requireSession, (req, res) => {
    res.json({ success: true, data: { user: req.auth.user, csrfToken: req.auth.csrfToken } });
  });
  router.post('/logout', middleware.requireSession, middleware.requireCsrf, async (req, res, next) => {
    try {
      await service.logout(readSessionCookie(req));
      clearSessionCookie(res, req);
      res.json({ success: true, data: null });
    } catch (error) { next(error); }
  });
  return router;
}

module.exports = setupAuthRoutes;
