/**
 * Rotas da API para Rallies
 */

const express = require('express');
const router = express.Router();

/**
 * Configura as rotas de rallies
 * @param {RallyController} rallyController - Instância do controller
 */
function setupRallyRoutes(rallyController) {
  // Listar todos os rallies
  router.get('/', rallyController.listar.bind(rallyController));

  // Buscar rally ativo
  router.get('/ativo', rallyController.buscarAtivo.bind(rallyController));

  // Buscar rally por ID
  router.get('/:id', rallyController.buscarPorId.bind(rallyController));

  // Criar novo rally
  router.post('/', rallyController.criar.bind(rallyController));

  // Atualizar rally
  router.patch('/:id/start', rallyController.iniciar.bind(rallyController));

  router.put('/:id/tribos', rallyController.selecionarTribos.bind(rallyController));

  router.put('/:id', rallyController.atualizar.bind(rallyController));

  // Encerrar, arquivar ou cancelar por transições explícitas
  router.patch('/:id/encerrar', rallyController.encerrar.bind(rallyController));
  router.patch('/:id/arquivar', rallyController.arquivar.bind(rallyController));
  router.patch('/:id/cancelar', rallyController.cancelar.bind(rallyController));

  // Deletar rally
  router.delete('/:id', rallyController.deletar.bind(rallyController));

  return router;
}

module.exports = setupRallyRoutes;
