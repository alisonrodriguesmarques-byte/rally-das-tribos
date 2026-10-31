'use strict';

const express = require('express');

function setupUserRoutes(service, middleware) {
  const router = express.Router();
  router.use(middleware.requireSession, middleware.requireAdmin, middleware.requireCsrf);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/', async (req, res, next) => {
    try { res.json({ success: true, data: await service.listUsers(req.auth.user.id) }); }
    catch (error) { next(error); }
  });
  router.post('/', async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await service.createUser(req.auth.user.id, req.body) }); }
    catch (error) { next(error); }
  });
  router.patch('/:id/approval', async (req, res, next) => {
    try { res.json({ success: true, data: await service.reviewUser(req.auth.user.id, req.params.id, req.body?.aprovacao, req.body?.motivo) }); }
    catch (error) { next(error); }
  });
  router.patch('/:id/status', async (req, res, next) => {
    try { res.json({ success: true, data: await service.setUserStatus(req.auth.user.id, req.params.id, req.body?.status, req.body?.motivo) }); }
    catch (error) { next(error); }
  });
  return router;
}

module.exports = setupUserRoutes;
