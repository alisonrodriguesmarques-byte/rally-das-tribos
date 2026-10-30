/**
 * Rotas da API para Tribos
 */

const express = require('express');
const router = express.Router();

/**
 * Configura as rotas de tribos
 * @param {TriboController} triboController - Instância do controller
 */
function setupTriboRoutes(triboController) {
  // Listar todas as tribos
  router.get('/', triboController.listar.bind(triboController));

  // Rotas específicas devem vir antes de rotas com parâmetros dinâmicos
  // Buscar tribos de um rally específico
  router.get('/rally/:rally_id', triboController.buscarPorRally.bind(triboController));

  // Buscar ranking de um rally
  router.get('/ranking/:rally_id', triboController.buscarRanking.bind(triboController));

  // Buscar tribo por ID
  router.get('/:id', triboController.buscarPorId.bind(triboController));

  // Buscar membros de uma tribo
  router.get('/:id/membros', triboController.buscarMembros.bind(triboController));

  // Criar nova tribo
  router.post('/', triboController.criar.bind(triboController));

  // Atualizar tribo
  router.put('/:id', triboController.atualizar.bind(triboController));

  // Deletar tribo
  router.delete('/:id', triboController.deletar.bind(triboController));

  return router;
}

module.exports = setupTriboRoutes;
