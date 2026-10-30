/**
 * Controller de Rallies
 * Gerencia as operações de CRUD para rallies
 */

const RallyRepository = require('../repositories/rallyRepository');
const { RALLY_STATUSES, INITIAL_RALLY_STATUS } = require('../constants/rallyStatus');

class RallyController {
  constructor(db) {
    this.rallyRepository = new RallyRepository(db);
  }

  /**
   * Lista todos os rallies
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async listar(req, res) {
    try {
      const { status } = req.query;
      const options = {};

      if (status) {
        options.status = status;
      }

      const rallies = await this.rallyRepository.findAll(options);

      res.json({
        success: true,
        data: rallies,
        total: rallies.length
      });
    } catch (error) {
      console.error('Erro ao listar rallies:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao listar rallies',
        message: error.message
      });
    }
  }

  /**
   * Busca um rally por ID
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

      const rally = await this.rallyRepository.findById(id);

      if (!rally) {
        return res.status(404).json({
          success: false,
          error: 'Rally não encontrado'
        });
      }

      res.json({
        success: true,
        data: rally
      });
    } catch (error) {
      console.error('Erro ao buscar rally:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar rally',
        message: error.message
      });
    }
  }

  /**
   * Busca o rally ativo
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async buscarAtivo(req, res) {
    try {
      const rally = await this.rallyRepository.findActive();

      if (!rally) {
        return res.status(404).json({
          success: false,
          error: 'Nenhum rally ativo encontrado'
        });
      }

      res.json({
        success: true,
        data: rally
      });
    } catch (error) {
      console.error('Erro ao buscar rally ativo:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar rally ativo',
        message: error.message
      });
    }
  }

  /**
   * Cria um novo rally
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async criar(req, res) {
    try {
      const { nome, descricao, data_inicio, data_fim, status } = req.body;

      // Validações
      if (!nome || nome.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Nome do rally é obrigatório'
        });
      }

      if (!data_inicio) {
        return res.status(400).json({
          success: false,
          error: 'Data de início é obrigatória'
        });
      }

      if (!data_fim) {
        return res.status(400).json({
          success: false,
          error: 'Data de encerramento é obrigatória'
        });
      }

      // Validar formato das datas
      const dataInicio = new Date(data_inicio);
      const dataFim = new Date(data_fim);

      if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Formato de data inválido. Use YYYY-MM-DD'
        });
      }

      if (dataFim <= dataInicio) {
        return res.status(400).json({
          success: false,
          error: 'Data de encerramento deve ser posterior à data de início'
        });
      }

      if (status !== undefined && !RALLY_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Status inválido. Valores permitidos: ${RALLY_STATUSES.join(', ')}`
        });
      }
      if (status !== undefined && status !== INITIAL_RALLY_STATUS) {
        return res.status(400).json({
          success: false,
          error: `Um novo rally deve começar em ${INITIAL_RALLY_STATUS}. Use a ação de início quando estiver pronto.`
        });
      }

      const rally = await this.rallyRepository.create({
        nome: nome.trim(),
        descricao: descricao ? descricao.trim() : null,
        data_inicio,
        data_fim
      });

      res.status(201).json({
        success: true,
        message: 'Rally criado com sucesso',
        data: rally
      });
    } catch (error) {
      console.error('Erro ao criar rally:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao criar rally',
        message: error.message
      });
    }
  }

  /**
   * Atualiza um rally
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async atualizar(req, res) {
    try {
      const { id } = req.params;
      const { nome, descricao, data_inicio, data_fim, status } = req.body;

      if (!id || isNaN(id)) {
        return res.status(400).json({
          success: false,
          error: 'ID inválido'
        });
      }

      // Verificar se rally existe
      const rallyExistente = await this.rallyRepository.findById(id);
      if (!rallyExistente) {
        return res.status(404).json({
          success: false,
          error: 'Rally não encontrado'
        });
      }

      // Validações
      if (nome !== undefined && nome.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Nome do rally não pode ser vazio'
        });
      }

      if (data_inicio) {
        const dataInicio = new Date(data_inicio);
        if (isNaN(dataInicio.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Formato de data de início inválido. Use YYYY-MM-DD'
          });
        }
      }

      if (data_fim) {
        const dataFim = new Date(data_fim);
        if (isNaN(dataFim.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Formato de data de encerramento inválido. Use YYYY-MM-DD'
          });
        }
      }

      // Validar datas se ambas fornecidas
      if (data_inicio && data_fim) {
        const dataInicio = new Date(data_inicio);
        const dataFim = new Date(data_fim);
        if (dataFim <= dataInicio) {
          return res.status(400).json({
            success: false,
            error: 'Data de encerramento deve ser posterior à data de início'
          });
        }
      }

      if (status !== undefined) {
        return res.status(400).json({
          success: false,
          error: 'O status não pode ser alterado pela atualização geral. Use a ação específica para a transição desejada.'
        });
      }

      // Preparar dados para atualização
      const dataAtualizar = {};
      if (nome !== undefined) dataAtualizar.nome = nome.trim();
      if (descricao !== undefined) dataAtualizar.descricao = descricao.trim();
      if (data_inicio !== undefined) dataAtualizar.data_inicio = data_inicio;
      if (data_fim !== undefined) dataAtualizar.data_fim = data_fim;

      const rally = await this.rallyRepository.update(id, dataAtualizar);

      res.json({
        success: true,
        message: 'Rally atualizado com sucesso',
        data: rally
      });
    } catch (error) {
      console.error('Erro ao atualizar rally:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao atualizar rally',
        message: error.message
      });
    }
  }

  /**
   * Inicia explicitamente um rally em planejamento.
   * @param {Object} req - Request do Express
   * @param {Object} res - Response do Express
   */
  async iniciar(req, res) {
    const { id } = req.params;
    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido'
      });
    }

    try {
      const rally = await this.rallyRepository.start(Number(id));
      return res.json({
        success: true,
        message: 'Rally iniciado com sucesso',
        data: rally
      });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({
          success: false,
          error: error.message
        });
      }
      console.error('Erro ao iniciar rally:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao iniciar rally',
        message: error.message
      });
    }
  }

  /**
   * Arquiva um rally encerrado.
   */
  async arquivar(req, res) {
    return this.executarTransicao(req, res, 'archive', 'Rally arquivado com sucesso');
  }

  /**
   * Encerra um rally ativo.
   */
  async encerrar(req, res) {
    return this.executarTransicao(req, res, 'close', 'Rally encerrado com sucesso');
  }

  /**
   * Cancela um rally em planejamento.
   */
  async cancelar(req, res) {
    return this.executarTransicao(req, res, 'cancel', 'Rally cancelado com sucesso');
  }

  async executarTransicao(req, res, metodo, mensagem) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }

    try {
      const rally = await this.rallyRepository[metodo](id);
      return res.json({ success: true, message: mensagem, data: rally });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ success: false, error: error.message });
      }
      console.error(`Erro ao executar transição ${metodo} do rally:`, error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao atualizar status do rally',
        message: error.message
      });
    }
  }

  /**
   * Deleta um rally (apenas se não tiver dados)
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

      // Verificar se rally existe
      const rallyExistente = await this.rallyRepository.findById(id);
      if (!rallyExistente) {
        return res.status(404).json({
          success: false,
          error: 'Rally não encontrado'
        });
      }

      await this.rallyRepository.delete(id);

      res.json({
        success: true,
        message: 'Rally deletado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao deletar rally:', error);

      // Se o erro for de restrição, retornar 400
      if (error.message.includes('Não é possível excluir')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erro ao deletar rally',
        message: error.message
      });
    }
  }
}

module.exports = RallyController;
