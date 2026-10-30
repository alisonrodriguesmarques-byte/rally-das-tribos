/**
 * Controller de Tribos
 * Gerencia as operações de CRUD para tribos
 */

const TriboRepository = require('../repositories/triboRepository');

class TriboController {
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
      console.error('Erro ao listar tribos:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao listar tribos',
        message: error.message
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
      console.error('Erro ao buscar tribo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar tribo',
        message: error.message
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
      console.error('Erro ao buscar tribos do rally:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar tribos do rally',
        message: error.message
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
      console.error('Erro ao buscar ranking:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar ranking',
        message: error.message
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
      console.error('Erro ao buscar membros da tribo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar membros da tribo',
        message: error.message
      });
    }
  }

  /**
   * Cria uma nova tribo
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async criar(req, res) {
    try {
      const { rally_id, nome, descricao, cor } = req.body;

      // Validações
      if (!rally_id || isNaN(rally_id)) {
        return res.status(400).json({
          success: false,
          error: 'ID do rally é obrigatório'
        });
      }

      if (!nome || nome.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Nome da tribo é obrigatório'
        });
      }

      const tribo = await this.triboRepository.create({
        rally_id,
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : null,
        cor: cor || '#3B82F6'
      });

      res.status(201).json({
        success: true,
        message: 'Tribo criada com sucesso',
        data: tribo
      });
    } catch (error) {
      console.error('Erro ao criar tribo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao criar tribo',
        message: error.message
      });
    }
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
      if (descricao !== undefined) dataAtualizar.descricao = descricao.trim();
      if (cor !== undefined) dataAtualizar.cor = cor;

      const tribo = await this.triboRepository.update(id, dataAtualizar);

      res.json({
        success: true,
        message: 'Tribo atualizada com sucesso',
        data: tribo
      });
    } catch (error) {
      console.error('Erro ao atualizar tribo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar tribo',
        message: error.message
      });
    }
  }

  /**
   * Deleta uma tribo
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async deletar(req, res) {
    try {
      const { id } = req.params;

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

      await this.triboRepository.delete(id);

      res.json({
        success: true,
        message: 'Tribo deletada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar tribo:', error);

      // Se o erro for de restrição, retornar 400
      if (error.message.includes('Não é possível excluir')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erro ao deletar tribo',
        message: error.message
      });
    }
  }
}

module.exports = TriboController;
