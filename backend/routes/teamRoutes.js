'use strict';

const express = require('express');

function setupTeamRoutes(service, middleware) {
  const router = express.Router();
  router.use(middleware.requireSession, middleware.requireAdmin, middleware.requireCsrf);
  router.get('/:rallyId', async (req, res, next) => {
    try { res.json({ success: true, data: await service.getTeams(req.auth.user.id, req.params.rallyId) }); }
    catch (error) { next(error); }
  });
  router.post('/:rallyId/membros', async (req, res, next) => {
    try { res.status(201).json({ success: true, data: await service.addMember(req.auth.user.id, req.params.rallyId, req.body) }); }
    catch (error) { next(error); }
  });
  const operations = [
    ['saida', 'endMembership'], ['transferencia', 'transferMember'], ['papel', 'changeRole']
  ];
  for (const [path, method] of operations) {
    router.post('/:rallyId/membros/:id/' + path, async (req, res, next) => {
      try { res.json({ success: true, data: await service[method](req.auth.user.id, req.params.rallyId, req.params.id, req.body) }); }
      catch (error) { next(error); }
    });
  }
  return router;
}

module.exports = setupTeamRoutes;
