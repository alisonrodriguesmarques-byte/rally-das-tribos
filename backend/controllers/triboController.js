/**
 * Controller de Tribos
 * Gerencia as operações de CRUD para tribos
 */

const TriboRepository = require('../repositories/triboRepository');

class TriboController {
  async catalogo(req, res) {
    try {
      const catalog = await this.triboRepository.catalog();
      return res.json({ success: true, data: catalog, total: catalog.length });
    } catch {
      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  }

  constructor(db) {
    this.triboRepository = new TriboRepository(db);
  }

  /**
   * Lista todas as tribos
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async listar(req, res) {
    try {
      const { rally_id } = req.query;
      const options = {};

      if (rally_id) {
        options.rally_id = rally_id;
      }

      const tribos = await this.triboRepository.findAll(options);

      res.json({
        success: true,
        data: tribos,
        total: tribos.length
      });
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('Erro ao listar tribos:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao listar tribos',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Busca uma tribo por ID
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async buscarPorId(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'ID inválido'
        });
      }

      const tribo = await this.triboRepository.findById(id);

      if (!tribo) {
        return res.status(404).json({
          success: false,
          error: 'Tribo não encontrada'
        });
      }

      res.json({
        success: true,
        data: tribo
      });
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('Erro ao buscar tribo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar tribo',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Busca tribos de um rally específico
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async buscarPorRally(req, res) {
    try {
      const { rally_id } = req.params;

      if (!rally_id || isNaN(rally_id)) {
        return res.status(400).json({
          success: false,
          error: 'ID do rally inválido'
        });
      }

      const tribos = await this.triboRepository.findByRally(rally_id);

      res.json({
        success: true,
        data: tribos,
        total: tribos.length
      });
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('Erro ao buscar tribos do rally:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar tribos do rally',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Busca o ranking de um rally
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async buscarRanking(req, res) {
    try {
      const { rally_id } = req.params;

      if (!rally_id || isNaN(rally_id)) {
        return res.status(400).json({
          success: false,
          error: 'ID do rally inválido'
        });
      }

      const ranking = await this.triboRepository.getRanking(rally_id);

      res.json({
        success: true,
        data: ranking,
        total: ranking.length
      });
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('Erro ao buscar ranking:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar ranking',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Busca os membros de uma tribo
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async buscarMembros(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'ID inválido'
        });
      }

      const membros = await this.triboRepository.getMembros(id);

      res.json({
        success: true,
        data: membros,
        total: membros.length
      });
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('Erro ao buscar membros da tribo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar membros da tribo',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Cria uma nova tribo
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async criar(req, res) {
    return res.status(409).json({ success: false,
      error: 'Selecione duas tribos oficiais na criação ou no planejamento do Rally; a inclusão isolada não é permitida.' });
  }

  /**
   * Atualiza uma tribo
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao, cor } = req.body;

      if (['nome', 'catalogo_id', 'rally_id'].some(field => Object.hasOwn(req.body, field))) {
        return res.status(409).json({ success: false, error: 'A identidade da tribo só pode mudar pela seleção oficial do Rally no planejamento.' });
      }
      if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
        return res.status(400).json({ success: false, error: 'A descrição deve ser texto.' });
      }
      if (cor !== undefined && (typeof cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(cor))) {
        return res.status(400).json({ success: false, error: 'Informe uma cor hexadecimal válida.' });
      }

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'ID inválido'
        });
      }

      // Verificar se tribo existe
      const triboExistente = await this.triboRepository.findById(id);
      if (!triboExistente) {
        return res.status(404).json({
          success: false,
          error: 'Tribo não encontrada'
        });
      }

      // Validações
      if (nome !== undefined && nome.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Nome da tribo não pode ser vazio'
        });
      }

      // Preparar dados para atualização
      const dataAtualizar = {};
      if (nome !== undefined) dataAtualizar.nome = nome.trim();
      if (descricao !== undefined) dataAtualizar.descricao = descricao === null ? null : descricao.trim();
      if (cor !== undefined) dataAtualizar.cor = cor;

      const tribo = await this.triboRepository.update(id, dataAtualizar);

      res.json({
        success: true,
        message: 'Tribo atualizada com sucesso',
        data: tribo
      });
    } catch (error) {
      if (Number.isInteger(error.status) && error.status >= 400 && error.status < 500) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error('Erro ao atualizar tribo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar tribo',
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Deleta uma tribo
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async deletar(req, res) {
    return res.status(409).json({ success: false,
      error: 'A participação de uma tribo não pode ser excluída isoladamente; use a seleção do Rally no planejamento.' });
  }

}

module.exports = TriboController;
