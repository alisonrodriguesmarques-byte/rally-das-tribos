'use strict';

const express = require('express');

function setupParticipantRoutes(service, middleware) {
  const router = express.Router();
  router.use(middleware.requireSession, middleware.requireAdmin, middleware.requireCsrf);
  router.get('/', async (req, res, next) => {
    try { res.json({ success: true, data: await service.listParticipants(req.auth.user.id, req.query) }); }
    catch (error) { next(error); }
  });
  router.post('/', async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await service.createParticipant(req.auth.user.id, req.body) }); }
    catch (error) { next(error); }
  });
  router.put('/:id', async (req, res, next) => {
    try { res.json({ success: true, data: await service.updateParticipant(req.auth.user.id, req.params.id, req.body) }); }
    catch (error) { next(error); }
  });
  return router;
}

module.exports = setupParticipantRoutes;
